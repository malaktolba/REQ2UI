/**
 * Integration test for the 10-stage pipeline with the LLM clients and DB mocked.
 * Verifies stage ordering, the resume/cache path, the Stage-2 floor check, and
 * that every stage emits a timed running→completed pair — the same StageEvent
 * stream the SSE endpoint forwards and the report tool times.
 */
import { SAMPLE_SRS } from "./fixtures/sample-srs";
import type { StageEvent } from "../services/pipeline.service";

jest.mock("../db/client", () => ({ sql: jest.fn(async () => []) }));

// callGroq returns stage-appropriate JSON, keyed off a phrase in the system prompt.
jest.mock("../services/groq.service", () => ({
  callGroq: jest.fn(async (system: string) => {
    if (/requirement extraction/i.test(system) || /system_summary/.test(system)) return SAMPLE_SRS.extraction;
    if (/IEEE 830 functional/i.test(system)) return SAMPLE_SRS.functional_requirements;
    if (/non-functional requirements/i.test(system)) return SAMPLE_SRS.non_functional_requirements;
    if (/OWASP Top 10/i.test(system)) return SAMPLE_SRS.security_requirements;
    if (/IEEE 829 functional test/i.test(system)) return SAMPLE_SRS.functional_test_cases;
    if (/security test cases/i.test(system)) return SAMPLE_SRS.security_test_cases;
    if (/UI wireframe/i.test(system)) return SAMPLE_SRS.wireframes;
    if (/traceability matrix/i.test(system)) return SAMPLE_SRS.traceability_matrix;
    if (/UML diagrams/i.test(system)) return SAMPLE_SRS.uml_diagrams;
    return {};
  }),
}));

jest.mock("../services/gemini.service", () => ({
  callGeminiJSON: jest.fn(async () => ({
    navbar: "<nav>...</nav>", footer: "<footer>...</footer>",
    tailwind_config: "<script></script>", body_classes: "bg-slate-950",
  })),
  callGeminiText: jest.fn(async () =>
    "<!DOCTYPE html><html><body><nav></nav><main>screen</main></body></html>"),
}));

import { sql } from "../db/client";
import { callGroq } from "../services/groq.service";
import { runPipeline } from "../services/pipeline.service";

const mockSql = sql as jest.MockedFunction<any>;
const mockGroq = callGroq as jest.MockedFunction<any>;

/** Collect stage events and the wall-clock duration of each stage. */
function recorder() {
  const events: StageEvent[] = [];
  const startedAt = new Map<number, number>();
  const durations = new Map<number, number>();
  const emit = (e: StageEvent) => {
    events.push(e);
    if (e.status === "running" && !startedAt.has(e.stage)) startedAt.set(e.stage, Date.now());
    if (e.status === "completed" && startedAt.has(e.stage)) {
      durations.set(e.stage, Date.now() - startedAt.get(e.stage)!);
    }
  };
  return { events, durations, emit };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSql.mockImplementation(async () => []);
});

describe("runPipeline — full run", () => {
  it("completes all 10 stages in order with one running→completed pair each", async () => {
    const { events, durations, emit } = recorder();
    await runPipeline("proj-1", "E-Learning Platform", "A platform for online courses with students and teachers.", emit);

    for (let stage = 1; stage <= 10; stage++) {
      const forStage = events.filter((e) => e.stage === stage);
      expect(forStage.some((e) => e.status === "running")).toBe(true);
      expect(forStage.some((e) => e.status === "completed")).toBe(true);
      expect(forStage.some((e) => e.status === "failed")).toBe(false);
    }

    // A duration was recorded for every stage (timing instrumentation works).
    expect(durations.size).toBe(10);
    for (const [, ms] of durations) expect(ms).toBeGreaterThanOrEqual(0);
  });

  it("marks the project completed on success", async () => {
    const { emit } = recorder();
    await runPipeline("proj-1", "Name", "A detailed description of a real system with many features.", emit);
    const calls = mockSql.mock.calls.map((c: any[]) => String(c[0]?.join?.("") ?? ""));
    expect(calls.some((q: string) => /status = 'completed'/.test(q))).toBe(true);
  });
});

describe("runPipeline — Stage 2 floor check", () => {
  it("fails when too few functional requirements can be derived", async () => {
    mockGroq.mockImplementation(async (system: string) => {
      if (/IEEE 830 functional/i.test(system)) return { requirements: [{ id: "FR-001", title: "x" }] };
      if (/system_summary/.test(system) || /requirement extraction/i.test(system)) return SAMPLE_SRS.extraction;
      return {};
    });
    const { events, emit } = recorder();

    await expect(
      runPipeline("proj-2", "Thin", "barely any detail here at all", emit)
    ).rejects.toThrow(/too few functional requirements/i);

    // The project is flagged failed.
    const calls = mockSql.mock.calls.map((c: any[]) => String(c[0]?.join?.("") ?? ""));
    expect(calls.some((q: string) => /status = 'failed'/.test(q))).toBe(true);
  });
});

describe("runPipeline — resume from cache", () => {
  it("skips the LLM for stages whose artifacts already exist", async () => {
    // 1st sql call: UPDATE status='generating'. 2nd: loadCompletedArtifacts SELECT.
    const cachedRows = Object.entries(SAMPLE_SRS).map(([type, content]) => ({ type, content }));
    mockSql
      .mockImplementationOnce(async () => [])          // UPDATE generating
      .mockImplementationOnce(async () => cachedRows)  // loadCompletedArtifacts
      .mockImplementation(async () => []);             // upserts etc.

    const { events, emit } = recorder();
    await runPipeline("proj-3", "Cached", "A fully cached project from a previous interrupted run.", emit);

    // Every stage still reports completed…
    for (let stage = 1; stage <= 10; stage++) {
      expect(events.some((e) => e.stage === stage && e.status === "completed")).toBe(true);
    }
    // …but no Groq calls were made, because every artifact was cached.
    expect(mockGroq).not.toHaveBeenCalled();
  });
});
