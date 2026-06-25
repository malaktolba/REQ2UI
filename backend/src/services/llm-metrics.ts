/**
 * In-process LLM API-latency collector (NFR2 — API latency).
 *
 * Each individual provider call (Groq / Gemini), success or failure, records the
 * wall-clock latency of the network round-trip here. The benchmark harness resets
 * the buffer before a run and reads `latencySummary()` afterwards to report
 * p50/p95/max per provider — the accurate source of the API-latency numbers for
 * the thesis testing chapter.
 *
 * The buffer is bounded (a ring buffer) so a long-running server never grows
 * memory unbounded; recording is cheap (a push) and dependency-free.
 */
import { performance } from "perf_hooks";

export type LLMProvider = "groq" | "gemini";

export interface LatencySample {
  provider: LLMProvider;
  ms: number;
  ok: boolean;
  /** Model name, when known — lets a report break latency down by model. */
  model?: string;
}

export interface ProviderLatency {
  provider: LLMProvider;
  count: number;
  failures: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

// Keep at most this many recent samples in memory.
const MAX_SAMPLES = 2000;
let samples: LatencySample[] = [];

/** Record one provider call's latency. */
export function recordLatency(s: LatencySample): void {
  samples.push(s);
  if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
}

/** Clear all collected samples (call before a benchmark run). */
export function resetLatency(): void {
  samples = [];
}

/** Raw snapshot of the current samples. */
export function getLatencySamples(): LatencySample[] {
  return samples.slice();
}

/**
 * Time an async provider call and record its latency under `provider`/`model`,
 * whether it resolves or rejects. Returns/rethrows the original result/error.
 */
export async function timeLLMCall<T>(
  provider: LLMProvider,
  model: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = performance.now();
  try {
    const out = await fn();
    recordLatency({ provider, model, ms: performance.now() - t0, ok: true });
    return out;
  } catch (err) {
    recordLatency({ provider, model, ms: performance.now() - t0, ok: false });
    throw err;
  }
}

/** Nearest-rank percentile (p in [0,100]) over a numeric array. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Per-provider latency aggregates over the collected samples (in milliseconds). */
export function latencySummary(): ProviderLatency[] {
  const providers: LLMProvider[] = ["groq", "gemini"];
  const out: ProviderLatency[] = [];
  for (const provider of providers) {
    const subset = samples.filter((s) => s.provider === provider);
    if (!subset.length) continue;
    const ms = subset.map((s) => s.ms);
    out.push({
      provider,
      count: subset.length,
      failures: subset.filter((s) => !s.ok).length,
      mean: mean(ms),
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      max: Math.max(...ms),
    });
  }
  return out;
}
