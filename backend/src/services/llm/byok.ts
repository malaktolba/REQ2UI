/**
 * BYOK provider dispatcher.
 *
 * Given a user's `UserLlmConfig` (provider + model + key), runs a single
 * completion against that provider. Two surface functions mirror the built-in
 * ones used across the pipeline:
 *   - `byokJSON`  → parsed JSON (structured stages)
 *   - `byokText`  → raw text (HTML / prose stages)
 *
 * Anthropic and OpenAI are called over plain `fetch` (no new dependencies);
 * Gemini and Groq reuse their already-installed SDKs but with a fresh,
 * user-keyed client. Each provider path is defensive about the small API
 * differences that otherwise make "it works on my model" fragile — JSON modes,
 * `max_tokens` vs `max_completion_tokens`, and models that reject a custom
 * temperature.
 */
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import type { UserLlmConfig } from "./context";

/** Best-effort extraction of a JSON value from a (possibly fenced) text blob. */
export function extractJson(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(t);
  } catch {
    // Fall back to the outermost {...} or [...] span — handles a stray preamble
    // or trailing note that some models add around otherwise-valid JSON.
    const firstObj = t.indexOf("{");
    const firstArr = t.indexOf("[");
    const candidates = [firstObj, firstArr].filter((i) => i !== -1);
    if (!candidates.length) throw new Error("No JSON found in provider response");
    const start = Math.min(...candidates);
    const close = t[start] === "{" ? "}" : "]";
    const end = t.lastIndexOf(close);
    if (end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Could not parse JSON from provider response");
  }
}

/** Strip markdown code fences from a text/HTML reply. */
function stripFences(text: string): string {
  return text.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

// ── Anthropic (Claude) ──────────────────────────────────────────────────────

async function callAnthropic(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean
): Promise<string> {
  const sys = json
    ? `${system}\n\nReturn ONLY valid JSON — no markdown, no code fences, no commentary.`
    : system;

  // Some Claude models cap output at 8192 unless higher limits are enabled; if a
  // large request is rejected for that reason, retry once clamped so the stage
  // still completes (possibly shorter) instead of hard-failing.
  let cap = maxTokens;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cap,
        temperature,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (res.ok) {
      const data: any = await res.json();
      const text = (data.content ?? [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("");
      if (!text) throw new Error("Empty response from Anthropic");
      return text;
    }
    const errText = await res.text();
    if (res.status === 400 && /max_tokens/i.test(errText) && cap > 8192) {
      cap = 8192;
      continue;
    }
    throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 500)}`);
  }
  throw new Error("Anthropic request failed after adjusting max_tokens");
}

// ── OpenAI (ChatGPT) ────────────────────────────────────────────────────────

async function callOpenAI(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean
): Promise<string> {
  // Newer model families (o-series, gpt-5*) use `max_completion_tokens` and only
  // accept the default temperature. We start with the legacy-compatible shape and
  // adapt on the specific 400s those models return, so one code path serves both.
  let useCompletionTokens = /^(o\d|gpt-5|gpt-4\.1|o[1-9])/i.test(cfg.model);
  let sendTemperature = true;
  let sendJsonMode = json;

  for (let attempt = 0; attempt < 4; attempt++) {
    const body: any = {
      model: cfg.model,
      messages: [
        { role: "system", content: json ? `${system}\n\nReturn ONLY valid JSON.` : system },
        { role: "user", content: user },
      ],
    };
    if (useCompletionTokens) body.max_completion_tokens = maxTokens;
    else body.max_tokens = maxTokens;
    if (sendTemperature) body.temperature = temperature;
    if (sendJsonMode) body.response_format = { type: "json_object" };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data: any = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("Empty response from OpenAI");
      return text;
    }
    const errText = await res.text();
    const lower = errText.toLowerCase();
    if (lower.includes("max_tokens") && !useCompletionTokens) {
      useCompletionTokens = true;
      continue;
    }
    if (lower.includes("temperature") && sendTemperature) {
      sendTemperature = false;
      continue;
    }
    if (lower.includes("response_format") && sendJsonMode) {
      sendJsonMode = false; // fall back to prompt-instructed JSON + extractJson
      continue;
    }
    throw new Error(`OpenAI API error ${res.status}: ${errText.slice(0, 500)}`);
  }
  throw new Error("OpenAI request failed after parameter adjustments");
}

// ── Gemini (user key) ───────────────────────────────────────────────────────

async function callGeminiByok(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: cfg.apiKey });
  const baseConfig: any = {
    systemInstruction: system,
    temperature,
    maxOutputTokens: maxTokens,
    ...(json ? { responseMimeType: "application/json" } : {}),
  };
  // Disable thinking so reasoning tokens don't eat the output budget. Thinking-
  // only models (e.g. *-pro) reject thinkingBudget:0 — retry without it then.
  for (const cfgVariant of [{ ...baseConfig, thinkingConfig: { thinkingBudget: 0 } }, baseConfig]) {
    try {
      const res = await client.models.generateContent({
        model: cfg.model,
        contents: user,
        config: cfgVariant,
      });
      const text = res.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    } catch (err: any) {
      if (cfgVariant.thinkingConfig && /thinking/i.test(err?.message ?? "")) continue;
      throw new Error(`Gemini API error: ${err?.message ?? String(err)}`);
    }
  }
  throw new Error("Gemini request failed");
}

// ── Groq (user key) ─────────────────────────────────────────────────────────

async function callGroqByok(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean
): Promise<string> {
  const client = new Groq({ apiKey: cfg.apiKey });
  const completion = await client.chat.completions.create({
    model: cfg.model,
    messages: [
      { role: "system", content: json ? `${system}\n\nReturn ONLY valid JSON.` : system },
      { role: "user", content: user },
    ],
    ...(json ? { response_format: { type: "json_object" } } : {}),
    temperature,
    max_tokens: maxTokens,
  });
  const text = completion.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq");
  return text;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PROVIDER_LABEL: Record<UserLlmConfig["provider"], string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI (ChatGPT)",
  gemini: "Google Gemini",
  groq: "Groq",
};

/**
 * Backoff (ms) for a transient/retryable provider error, or null when the error
 * is permanent (bad key, bad model, malformed request) and retrying is pointless.
 * Covers all four providers via both HTTP status and message text, since the SDK
 * vs fetch paths surface errors differently. Honours an explicit retry hint
 * ("retryDelay":"5s" / Retry-After) when the provider gives one.
 */
function transientBackoffMs(err: unknown, attempt: number): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status ?? (err as any)?.response?.status;

  // Explicit server-provided delay (Gemini "retryDelay":"23s", or "retry in 5s").
  const hint = msg.match(/retry(?:[-\s]?after|delay)?["']?\s*[:=]?\s*["']?\s*(?:in\s*)?([\d.]+)\s*s/i);
  if (hint) return Math.min(parseFloat(hint[1]) + 1, 60) * 1000;

  const retryable =
    status === 429 || status === 500 || status === 502 || status === 503 || status === 504 ||
    /\b(429|500|502|503|504)\b/.test(msg) ||
    /UNAVAILABLE|high demand|overloaded|rate.?limit|RESOURCE_EXHAUSTED|quota|temporarily|server error|timeout|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i.test(msg);
  if (!retryable) return null;

  // Capacity spikes (503 "high demand") can last 20-30s — wait a growing few
  // seconds rather than a short exponential; everything else backs off normally.
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
    return Math.min(4000 + attempt * 4000, 20000);
  }
  return Math.min(2000 * Math.pow(2, attempt), 30000);
}

/**
 * Turns an exhausted-retries error into an actionable message. Generation is
 * resumable — a failed stage leaves the project un-completed, so re-running picks
 * up exactly where it stopped (it skips already-finished stages). We say so here
 * so the user knows a transient overload doesn't cost them the whole run.
 */
function describeFinalError(err: unknown, cfg: UserLlmConfig): Error {
  const raw = (err instanceof Error ? err.message : String(err)).slice(0, 300);
  const label = `${PROVIDER_LABEL[cfg.provider]} · ${cfg.model}`;
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(raw)) {
    return new Error(
      `${label} is temporarily overloaded and didn't recover after several retries. ` +
        `This is usually brief — wait a moment and re-run to continue from where it stopped. ` +
        `(provider said: ${raw})`
    );
  }
  if (/429|rate.?limit|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return new Error(
      `${label} hit a rate or quota limit on your API key. ` +
        `Wait a little or check your provider plan, then re-run to continue. ` +
        `(provider said: ${raw})`
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

/** Dispatch one raw completion to the user's chosen provider (single attempt). */
function dispatch(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean
): Promise<string> {
  switch (cfg.provider) {
    case "anthropic":
      return callAnthropic(cfg, system, user, maxTokens, temperature, json);
    case "openai":
      return callOpenAI(cfg, system, user, maxTokens, temperature, json);
    case "gemini":
      return callGeminiByok(cfg, system, user, maxTokens, temperature, json);
    case "groq":
      return callGroqByok(cfg, system, user, maxTokens, temperature, json);
    default:
      throw new Error(`Unsupported AI provider: ${(cfg as any).provider}`);
  }
}

/**
 * Dispatch with resilience: retries transient provider errors (503 "high
 * demand", 429 rate limits, network blips) with honoured/backed-off delays so a
 * momentary outage on the user's provider doesn't fail the stage. Permanent
 * errors (bad key/model) fail fast. `retries` is the max extra attempts.
 */
async function byokRaw(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
  json: boolean,
  retries = 4
): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await dispatch(cfg, system, user, maxTokens, temperature, json);
    } catch (err) {
      lastErr = err;
      const backoff = transientBackoffMs(err, attempt);
      if (backoff !== null && attempt < retries) {
        console.warn(
          `[byok] ${cfg.provider}/${cfg.model} transient error (attempt ${attempt + 1}/${retries + 1}), ` +
            `retrying in ${Math.round(backoff / 1000)}s:`,
          (err as any)?.message
        );
        await sleep(backoff);
        continue;
      }
      throw describeFinalError(err, cfg);
    }
  }
  throw describeFinalError(lastErr, cfg);
}

/** Structured-JSON call on the user's provider (mirrors callGroq/callGeminiJSON). */
export async function byokJSON(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens = 8000
): Promise<any> {
  const raw = await byokRaw(cfg, system, user, maxTokens, 0.3, true);
  return extractJson(raw);
}

/** Raw-text call on the user's provider (mirrors callGroqText/callGeminiText). */
export async function byokText(
  cfg: UserLlmConfig,
  system: string,
  user: string,
  maxTokens = 8000
): Promise<string> {
  const raw = await byokRaw(cfg, system, user, maxTokens, 0.4, false);
  return stripFences(raw);
}

/**
 * Lightweight credential check used by the "Test connection" button: a tiny
 * prompt that should return promptly on a valid key/model. Throws on failure
 * with the provider's error message. Uses a single quick retry — a connection
 * test shouldn't hang through the full backoff schedule on an overloaded model.
 */
export async function byokPing(cfg: UserLlmConfig): Promise<void> {
  await byokRaw(cfg, "You are a connection test.", "Reply with the single word: OK", 16, 0, false, 1);
}
