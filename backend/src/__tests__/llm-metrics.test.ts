import {
  recordLatency,
  resetLatency,
  getLatencySamples,
  latencySummary,
  percentile,
  timeLLMCall,
} from "../services/llm-metrics";

beforeEach(() => resetLatency());

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 95)).toBe(0);
  });

  it("computes nearest-rank percentiles", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile(xs, 100)).toBe(100);
  });

  it("is order-independent", () => {
    expect(percentile([100, 10, 50, 30], 50)).toBe(percentile([10, 30, 50, 100], 50));
  });
});

describe("recordLatency / latencySummary", () => {
  it("aggregates per provider with counts, failures and percentiles", () => {
    for (const ms of [100, 200, 300, 400, 500]) recordLatency({ provider: "groq", ms, ok: true });
    recordLatency({ provider: "groq", ms: 900, ok: false });
    recordLatency({ provider: "gemini", ms: 1000, ok: true });

    const summary = latencySummary();
    const groq = summary.find((s) => s.provider === "groq")!;
    const gemini = summary.find((s) => s.provider === "gemini")!;

    expect(groq.count).toBe(6);
    expect(groq.failures).toBe(1);
    expect(groq.max).toBe(900);
    expect(groq.p50).toBeGreaterThan(0);
    expect(gemini.count).toBe(1);
    expect(gemini.max).toBe(1000);
  });

  it("omits providers with no samples", () => {
    recordLatency({ provider: "groq", ms: 100, ok: true });
    const summary = latencySummary();
    expect(summary.map((s) => s.provider)).toEqual(["groq"]);
  });

  it("resetLatency clears the buffer", () => {
    recordLatency({ provider: "groq", ms: 100, ok: true });
    resetLatency();
    expect(getLatencySamples()).toHaveLength(0);
    expect(latencySummary()).toEqual([]);
  });

  it("bounds the buffer so memory does not grow unbounded", () => {
    for (let i = 0; i < 2500; i++) recordLatency({ provider: "groq", ms: i, ok: true });
    expect(getLatencySamples().length).toBeLessThanOrEqual(2000);
  });
});

describe("timeLLMCall", () => {
  it("records a successful call and returns its value", async () => {
    const out = await timeLLMCall("groq", "model-x", async () => 42);
    expect(out).toBe(42);
    const [s] = getLatencySamples();
    expect(s.ok).toBe(true);
    expect(s.provider).toBe("groq");
    expect(s.model).toBe("model-x");
    expect(s.ms).toBeGreaterThanOrEqual(0);
  });

  it("records a failed call and rethrows", async () => {
    await expect(
      timeLLMCall("gemini", "model-y", async () => { throw new Error("boom"); })
    ).rejects.toThrow("boom");
    const [s] = getLatencySamples();
    expect(s.ok).toBe(false);
    expect(s.provider).toBe("gemini");
  });
});
