import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { timeLLMCall } from "./llm-metrics";
import { getLlmOverride } from "./llm/context";
import { byokJSON, byokText } from "./llm/byok";

const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// "flash-lite" tiers have the largest free quotas (high RPM + big daily cap) and
// are plenty for HTML generation, so we lead with the current GA flash-lite. The
// older gemini-2.0-* models were SHUT DOWN on 2026-06-01 and gemini-2.5-* is
// legacy (deprecation window mid-2026) — keep 2.5 only as a trailing fallback.
// Override the primary with GEMINI_MODEL (e.g. a more capable model on a paid tier).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

// The lead generation model (for analytics/telemetry). The runtime may fall back
// across the model chain on outages, but this is the model a built-in
// Gemini-routed stage normally runs on — recorded per stage for speed analytics.
export const GEMINI_GEN_MODEL = MODEL;

// Model fallback chain. Two failure modes drive this:
//   1. 503 ("model overloaded" / "high demand") during traffic spikes — per-model,
//      so switching to a sibling (its own capacity pool + quota) often succeeds
//      where a plain same-model backoff would not.
//   2. 404 NOT_FOUND when Google deprecates/shuts down a model — non-retryable, so
//      generate() breaks out and falls straight to the next live model.
// Ordered newest/cheapest → legacy. Only models confirmed live as of 2026-06 are
// listed; the chain is deduped so an unset/duplicate GEMINI_MODEL doesn't repeat
// work. Add new GA models to the front as they ship.
const MODEL_CHAIN: string[] = Array.from(
  new Set([
    MODEL,
    "gemini-3.1-flash-lite", // GA, optimized for speed/scale/cost
    "gemini-3.5-flash",      // GA, recommended replacement for deprecated models
    "gemini-3-flash-preview",
    "gemini-2.5-flash-lite", // legacy fallback (deprecating mid-2026)
    "gemini-2.5-flash",      // legacy fallback
    "gemini-2.5-pro",        // legacy, most capable — last resort
  ])
);

// The chain order is fixed, but after the first success we remember the winning
// model and try it first on subsequent calls. This avoids wasting a throttle
// cycle (MIN_INTERVAL_MS) hitting a dead/overloaded primary on every single call
// once we've learned which model actually responds.
let preferredModel = MODEL;

// Stage 10 fires many calls (design system + one per screen), so we serialize
// them through a single queue with minimum spacing to stay under the per-minute
// quota. ~4.5s ≈ 13/min, safely under flash-lite's 15 RPM. Override via
// GEMINI_MIN_INTERVAL_MS if you move to a paid tier with higher limits.
const MIN_INTERVAL_MS = parseInt(process.env.GEMINI_MIN_INTERVAL_MS ?? "4500", 10);

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

/** Serializes callers and enforces MIN_INTERVAL_MS spacing between requests. */
function throttle(): Promise<void> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  });
  queue = run.catch(() => {});
  return run;
}

/** Backoff (ms) for a retryable Gemini error, or null if it's not retryable. */
function retryDelayMs(err: unknown, attempt: number): number | null {
  const msg = typeof err === "string" ? err : (err as any)?.message ?? JSON.stringify(err ?? "");
  // 503 capacity spikes ("high demand"/overloaded) are transient but can last
  // 20–30s, longer than a plain exponential backoff — wait a growing few seconds.
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(msg)) {
    return Math.min(4000 + attempt * 4000, 20000);
  }
  if (/429|RESOURCE_EXHAUSTED/i.test(msg)) {
    const m = msg.match(/retry(?:Delay)?["']?\s*[:=]?\s*["']?\s*(?:in\s*)?([\d.]+)\s*s/i);
    const secs = m ? parseFloat(m[1]) : 30; // default if unparseable but clearly a 429
    return Math.min(secs + 1, 60) * 1000; // honor it, capped at 60s
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generate(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number,
  json: boolean,
  retries: number,
  opts: { chain?: string[]; thinking?: boolean; failFast?: boolean } = {}
): Promise<string> {
  let lastError: unknown;
  // Normally try the last model that worked first. A caller can pass its own
  // `chain` (the GEval judge leads with the most capable models); the global
  // chain is appended as a last resort. When an override chain is used we don't
  // update `preferredModel`, so the cheap generation flow isn't dragged onto the
  // expensive judge model afterwards.
  const override = !!opts.chain?.length;
  const chain = override
    ? Array.from(new Set([...opts.chain!, ...MODEL_CHAIN]))
    : Array.from(new Set([preferredModel, ...MODEL_CHAIN]));
  // Outer loop: walk the model fallback chain. Inner loop: retry the current
  // model on transient errors (honouring server backoff), then move on.
  for (const model of chain) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await throttle();
        const res = await timeLLMCall("gemini", model, () =>
          gemini.models.generateContent({
            model,
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              ...(json ? { responseMimeType: "application/json" } : {}),
              temperature,
              maxOutputTokens: maxTokens,
              // Thinking tokens count against maxOutputTokens — a low cap with
              // thinking on starves the visible output (truncated/unterminated
              // JSON). UI/HTML gen doesn't need reasoning, so it's disabled by
              // default. The GEval judge opts in (`thinking: true`) because the
              // most capable model (gemini-2.5-pro) ONLY runs in thinking mode
              // and reasoning improves judgement quality; it pairs this with a
              // higher token cap so the JSON verdict still completes.
              ...(opts.thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
            },
          })
        );
        const raw = res.text;
        if (!raw) throw new Error("Empty response from Gemini");
        if (!override) preferredModel = model; // remember the winner for the next call
        return raw;
      } catch (err) {
        lastError = err;
        const backoff = retryDelayMs(err, attempt);
        // In fail-fast mode (the judge), a transient error on a non-last model
        // skips the same-model backoff and drops straight to the next model in
        // the chain — so a persistently overloaded preferred model (e.g. a 503
        // on gemini-3.5-flash) costs one quick attempt, not a long backoff loop,
        // before falling back. The last model still backs off, as it has nowhere
        // left to fall.
        const isLastModel = model === chain[chain.length - 1];
        const canRetrySameModel = !opts.failFast || isLastModel;
        // Transient (429/503) with retries left → wait and retry the SAME model,
        // since its capacity may free up. Otherwise stop retrying this model and
        // fall through to the next model in the chain.
        if (backoff !== null && attempt < retries && canRetrySameModel) {
          await sleep(backoff);
          continue;
        }
        break;
      }
    }
    // current model exhausted — try the next one in the chain
  }
  throw lastError;
}

/** Like callGroq: returns parsed JSON. Used for the design-system pass. */
export async function callGeminiJSON(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 5
): Promise<any> {
  // BYOK: a user-configured provider serves every generation call.
  const override = getLlmOverride();
  if (override) return byokJSON(override, systemPrompt, userPrompt, maxTokens);

  const raw = await generate(systemPrompt, userPrompt, maxTokens, 0.3, true, retries);
  return JSON.parse(raw);
}

// Fallback chain for the GEval judge. Leads with gemini-3.5-flash (newest flash,
// preferred), then gemini-2.5-pro (the most capable model — a strong, reliable
// fallback when 3.5-flash is overloaded). Both are thinking-capable, and
// gemini-2.5-pro ONLY runs in thinking mode, so the judge enables thinking.
// callGeminiJudge runs fail-fast, so when the lead model is 503 it drops to the
// next one immediately rather than backing off. Override the lead via
// GEMINI_JUDGE_MODEL.
const JUDGE_CHAIN = Array.from(
  new Set(
    [
      process.env.GEMINI_JUDGE_MODEL,
      "gemini-3.5-flash",      // preferred — newest flash
      "gemini-2.5-pro",        // most capable (thinking-only) — reliable fallback
      "gemini-2.5-flash",      // capable + reliably available
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite", // cheapest — last resort
    ].filter(Boolean) as string[]
  )
);

/** Model leading the judge chain (for docs/telemetry). */
export const GEMINI_JUDGE_MODEL = JUDGE_CHAIN[0];

/** JSON judge call on the best available Gemini model — used by the GEval evaluator. */
export async function callGeminiJudge(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 4
): Promise<any> {
  // Thinking enabled (required by gemini-2.5-pro and improves judgement); low
  // temperature for consistent, repeatable scoring; generous token cap so the
  // JSON verdict survives the thinking-token spend; fail-fast so an overloaded
  // lead model falls through to the next without a long backoff.
  const raw = await generate(systemPrompt, userPrompt, maxTokens, 0.2, true, retries, {
    chain: JUDGE_CHAIN,
    thinking: true,
    failFast: true,
  });
  return JSON.parse(raw);
}

/** Like callGroqText: returns raw text — used for HTML output. */
export async function callGeminiText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 5
): Promise<string> {
  const override = getLlmOverride();
  if (override) return byokText(override, systemPrompt, userPrompt, maxTokens);

  const raw = await generate(systemPrompt, userPrompt, maxTokens, 0.4, false, retries);
  // Strip markdown code fences if present
  return raw.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}
