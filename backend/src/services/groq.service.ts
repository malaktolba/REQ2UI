import Groq from "groq-sdk";
import { env } from "../config/env";
import { timeLLMCall } from "./llm-metrics";
import { getLlmOverride } from "./llm/context";
import { byokJSON, byokText } from "./llm/byok";

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// Model tiers. Heavy = best reasoning (scarce daily quota); light = fast and
// has far more generous limits — used for easier, structured stages so the
// heavy model's budget is saved for the stages that actually need it.
export const GROQ_HEAVY = "llama-3.3-70b-versatile";
export const GROQ_LIGHT = "llama-3.1-8b-instant";
const GROQ_XL = "openai/gpt-oss-120b";

// Global fallback order. When a model returns a rate-limit error (429) we fall
// through to the next one, which has its own independent quota on Groq.
const MODEL_CHAIN = [GROQ_HEAVY, GROQ_LIGHT, GROQ_XL];

// Builds the per-call model order: the caller's preferred model first, then the
// rest of the chain as rate-limit fallbacks (so a throttled light stage still
// falls back to the heavy model, which has a separate quota, and vice versa).
function chainFrom(preferred?: string): string[] {
  if (!preferred || !MODEL_CHAIN.includes(preferred)) return MODEL_CHAIN;
  return [preferred, ...MODEL_CHAIN.filter((m) => m !== preferred)];
}

// A rate-limit (429) or quota-exhausted error means retrying the *same* model is
// pointless — we should switch models instead of backing off.
function isRateLimit(err: unknown): boolean {
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  if (status === 429) return true;
  const code = (err as any)?.code ?? (err as any)?.error?.code;
  if (code === "rate_limit_exceeded") return true;
  const msg = String((err as any)?.message ?? "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("quota");
}

// Appended to the system prompt after a truncated response so the model returns
// a smaller, complete JSON document on the retry instead of overrunning the cap.
const CONCISE_NUDGE =
  "\n\nIMPORTANT: Your previous response was cut off before the JSON closed. " +
  "Return COMPLETE, valid JSON that fits the token budget — reduce the number of " +
  "items and shorten descriptions as needed. Never output truncated JSON.";

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  model?: string,
  retries = 3
): Promise<any> {
  // BYOK: when the user has configured their own provider, route every call to
  // it (their key/model), bypassing the built-in Groq routing entirely.
  const override = getLlmOverride();
  if (override) return byokJSON(override, systemPrompt, userPrompt, maxTokens);

  let lastError: unknown;
  let nudge = ""; // grows to CONCISE_NUDGE once we see a length-truncated reply
  const chain = chainFrom(model);
  let modelIndex = 0; // advances through `chain` on rate-limit errors
  for (let attempt = 0; attempt <= retries; attempt++) {
    const model = chain[modelIndex];
    try {
      const completion = await timeLLMCall("groq", model, () =>
        groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt + nudge },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: maxTokens,
        })
      );
      const choice = completion.choices[0];
      const raw = choice.message.content;
      if (!raw) throw new Error("Empty response from Groq");
      try {
        return JSON.parse(raw);
      } catch (parseErr) {
        // A `length` finish reason means the model hit max_tokens mid-JSON, so
        // the parse failure is truncation rather than a malformed structure —
        // nudge it to be more compact on the next attempt.
        if (choice.finish_reason === "length") nudge = CONCISE_NUDGE;
        throw parseErr;
      }
    } catch (err) {
      lastError = err;
      // On a rate limit, switch to the next fallback model immediately (no
      // backoff) and don't burn a retry — the current model just won't recover.
      if (isRateLimit(err) && modelIndex < chain.length - 1) {
        modelIndex++;
        attempt--;
        continue;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
      }
    }
  }
  throw lastError;
}

/** Like callGroq but returns raw text — used when the model output is not JSON (e.g. HTML). */
export async function callGroqText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  model?: string,
  retries = 3
): Promise<string> {
  const override = getLlmOverride();
  if (override) return byokText(override, systemPrompt, userPrompt, maxTokens);

  let lastError: unknown;
  const chain = chainFrom(model);
  let modelIndex = 0; // advances through `chain` on rate-limit errors
  for (let attempt = 0; attempt <= retries; attempt++) {
    const model = chain[modelIndex];
    try {
      const completion = await timeLLMCall("groq", model, () =>
        groq.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: maxTokens,
        })
      );
      const raw = completion.choices[0].message.content;
      if (!raw) throw new Error("Empty response from Groq");
      // Strip markdown code fences if present
      return raw.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    } catch (err) {
      lastError = err;
      // On a rate limit, fall through to the next model without backoff.
      if (isRateLimit(err) && modelIndex < chain.length - 1) {
        modelIndex++;
        attempt--;
        continue;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
      }
    }
  }
  throw lastError as any;
}
