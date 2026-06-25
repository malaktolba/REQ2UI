import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { timeLLMCall } from "./llm-metrics";

const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// gemini-2.5-flash free tier is tiny (5 req/min AND only 20 req/day), which the
// multi-call UI stage exhausts quickly. flash-lite has much higher free limits
// (~15 req/min, far larger daily cap) and is plenty for HTML generation. Override
// the primary with GEMINI_MODEL (e.g. back to gemini-2.5-flash on a paid tier).
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";

// Model fallback chain. Gemini frequently returns 503 ("model overloaded" / "high
// demand") during traffic spikes — that's per-model, so switching to a sibling
// model (which has its own capacity pool and quota) usually succeeds where a
// plain backoff on the same model would not. Each model is tried in turn; the
// chain is deduped so an unset/duplicate GEMINI_MODEL doesn't repeat work.
const MODEL_CHAIN: string[] = Array.from(
  new Set([
    MODEL,
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash-lite",
  ])
);

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
  retries: number
): Promise<string> {
  let lastError: unknown;
  // Outer loop: walk the model fallback chain. Inner loop: retry the current
  // model on transient errors (honouring server backoff), then move on.
  for (const model of MODEL_CHAIN) {
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
              // gemini-2.5-flash is a thinking model and thinking tokens count
              // against maxOutputTokens — leave it on and a low cap starves the
              // visible output (truncated/unterminated JSON). UI/HTML gen doesn't
              // need reasoning, so disable it for predictable, complete output.
              thinkingConfig: { thinkingBudget: 0 },
            },
          })
        );
        const raw = res.text;
        if (!raw) throw new Error("Empty response from Gemini");
        return raw;
      } catch (err) {
        lastError = err;
        const backoff = retryDelayMs(err, attempt);
        // Transient (429/503) with retries left → wait and retry the SAME model,
        // since its capacity may free up. Otherwise stop retrying this model and
        // fall through to the next model in the chain.
        if (backoff !== null && attempt < retries) {
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
  const raw = await generate(systemPrompt, userPrompt, maxTokens, 0.3, true, retries);
  return JSON.parse(raw);
}

/** Like callGroqText: returns raw text — used for HTML output. */
export async function callGeminiText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8000,
  retries = 5
): Promise<string> {
  const raw = await generate(systemPrompt, userPrompt, maxTokens, 0.4, false, retries);
  // Strip markdown code fences if present
  return raw.replace(/^```(?:html)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}
