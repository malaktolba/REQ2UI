import {
  aggregateArtifact,
  aggregateOverall,
  gevalEvaluator,
  type ArtifactScore,
  type EvaluationInput,
  type JudgeOutput,
} from "../services/evaluation.service";
import {
  rubricFor,
  scoreToPercentage,
  gradeForScore,
  ARTIFACT_WEIGHTS,
} from "../config/evaluation";
import { SAMPLE_SRS } from "./fixtures/sample-srs";

// The judge is an LLM call (callGroq). Mock it so these tests exercise the pure
// scoring/aggregation logic deterministically, with no network.
jest.mock("../services/groq.service", () => ({
  GROQ_HEAVY: "heavy",
  callGroq: jest.fn(),
}));
import { callGroq } from "../services/groq.service";
const mockCallGroq = callGroq as jest.MockedFunction<typeof callGroq>;

describe("config helpers", () => {
  it("maps 1-5 scores onto 0-100 percentages", () => {
    expect(scoreToPercentage(1)).toBe(0);
    expect(scoreToPercentage(3)).toBe(50);
    expect(scoreToPercentage(5)).toBe(100);
    expect(scoreToPercentage(4.5)).toBe(88); // (3.5/4)*100 rounded
  });

  it("clamps out-of-range scores", () => {
    expect(scoreToPercentage(0)).toBe(0);
    expect(scoreToPercentage(7)).toBe(100);
  });

  it("grades percentages by threshold", () => {
    expect(gradeForScore(95)).toBe("Excellent");
    expect(gradeForScore(80)).toBe("Good");
    expect(gradeForScore(65)).toBe("Acceptable");
    expect(gradeForScore(50)).toBe("Poor");
    expect(gradeForScore(10)).toBe("Failed");
  });

  it("artifact weights sum to 1", () => {
    const sum = Object.values(ARTIFACT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("aggregateArtifact", () => {
  const rubric = rubricFor("srs");

  it("computes the weighted criterion mean and maps it to a percentage", () => {
    const judged: JudgeOutput = {
      criteria: [
        { key: "coverage", score: 5, justification: "all covered" }, // w 0.4
        { key: "correctness", score: 4, justification: "accurate" }, // w 0.3
        { key: "completeness", score: 4, justification: "complete" }, // w 0.2
        { key: "clarity", score: 3, justification: "ok" }, // w 0.1
      ],
      strengths: ["thorough"],
      issues: ["minor clarity gaps"],
      recommendations: ["tighten phrasing"],
    };
    const out = aggregateArtifact(rubric, judged);
    // 5*.4 + 4*.3 + 4*.2 + 3*.1 = 2 + 1.2 + 0.8 + 0.3 = 4.3
    expect(out.score).toBeCloseTo(4.3, 2);
    expect(out.percentage).toBe(scoreToPercentage(4.3));
    expect(out.evaluated).toBe(true);
    expect(out.criteria).toHaveLength(4);
    expect(out.strengths).toEqual(["thorough"]);
  });

  it("clamps illegal scores and defaults missing criteria to neutral 3", () => {
    const judged: JudgeOutput = {
      criteria: [
        { key: "coverage", score: 99 }, // clamps to 5
        { key: "correctness", score: 0 }, // clamps to 1
        // completeness + clarity omitted → default 3
      ],
    };
    const out = aggregateArtifact(rubric, judged);
    const cov = out.criteria.find((c) => c.key === "coverage")!;
    const corr = out.criteria.find((c) => c.key === "correctness")!;
    const comp = out.criteria.find((c) => c.key === "completeness")!;
    expect(cov.score).toBe(5);
    expect(corr.score).toBe(1);
    expect(comp.score).toBe(3);
    // 5*.4 + 1*.3 + 3*.2 + 3*.1 = 2 + 0.3 + 0.6 + 0.3 = 3.2
    expect(out.score).toBeCloseTo(3.2, 2);
  });
});

describe("aggregateOverall", () => {
  const mk = (key: any, percentage: number | null, weight: number, evaluated = true): ArtifactScore => ({
    key,
    label: key,
    weight,
    score: percentage == null ? null : 4,
    percentage,
    rating: null,
    evaluated,
    criteria: [],
    strengths: [],
    issues: [],
    recommendations: [],
  });

  it("weights evaluated artifacts by their configured share", () => {
    const scores = [
      mk("srs", 90, 0.3),
      mk("ui", 84, 0.35),
      mk("uml", 94, 0.2),
      mk("tests", 76, 0.15),
    ];
    const { overallScore, grade } = aggregateOverall(scores);
    // 90*.3 + 84*.35 + 94*.2 + 76*.15 = 27 + 29.4 + 18.8 + 11.4 = 86.6 → 87
    expect(overallScore).toBe(87);
    expect(grade).toBe("Good");
  });

  it("re-normalises weights when a dimension was not evaluated", () => {
    const scores = [
      mk("srs", 80, 0.3),
      mk("ui", null, 0.35, false), // not generated
      mk("uml", 90, 0.2),
      mk("tests", 70, 0.15),
    ];
    const { overallScore } = aggregateOverall(scores);
    // present weight = .3+.2+.15 = .65 → (80*.3 + 90*.2 + 70*.15)/.65 = (24+18+10.5)/.65 = 80.77 → 81
    expect(overallScore).toBe(81);
  });

  it("returns 0/Failed when nothing was evaluated", () => {
    const scores = [mk("srs", null, 0.3, false)];
    expect(aggregateOverall(scores)).toEqual({ overallScore: 0, grade: "Failed" });
  });
});

describe("gevalEvaluator.evaluate", () => {
  beforeEach(() => mockCallGroq.mockReset());

  const fullInput = (): EvaluationInput => ({
    originalRequirements: "A task management app for teams.",
    generatedSRS: {
      extraction: SAMPLE_SRS.extraction,
      functional_requirements: SAMPLE_SRS.functional_requirements,
      non_functional_requirements: SAMPLE_SRS.non_functional_requirements,
      security_requirements: SAMPLE_SRS.security_requirements,
    },
    generatedUML: SAMPLE_SRS.uml_diagrams,
    generatedUI: SAMPLE_SRS.ui_code,
    generatedTestCases: {
      functional: SAMPLE_SRS.functional_test_cases,
      security: SAMPLE_SRS.security_test_cases,
    },
  });

  it("produces the required report shape with all four dimensions", async () => {
    // Every judge call returns a high, well-formed verdict.
    mockCallGroq.mockImplementation(async (system: string) => {
      const keys = [...system.matchAll(/"([a-z_]+)" —/g)].map((m) => m[1]);
      return {
        criteria: keys.map((key) => ({ key, score: 5, justification: "excellent" })),
        strengths: ["solid"],
        issues: [],
        recommendations: ["keep it up"],
      };
    });

    const report = await gevalEvaluator.evaluate(fullInput());
    expect(report.method).toBe("geval");
    expect(report.overallScore).toBe(100);
    expect(report.grade).toBe("Excellent");
    expect(Object.keys(report.scores).sort()).toEqual(["srs", "tests", "ui", "uml"]);
    for (const key of ["srs", "ui", "uml", "tests"] as const) {
      expect(report.scores[key].evaluated).toBe(true);
      expect(report.scores[key].score).toBe(5);
    }
    expect(mockCallGroq).toHaveBeenCalledTimes(4);
  });

  it("marks a missing artifact as not-evaluated without calling the judge for it", async () => {
    mockCallGroq.mockImplementation(async (system: string) => {
      const keys = [...system.matchAll(/"([a-z_]+)" —/g)].map((m) => m[1]);
      return { criteria: keys.map((key) => ({ key, score: 4 })), strengths: [], issues: [], recommendations: [] };
    });

    const input = fullInput();
    input.generatedUI = null; // no UI generated yet

    const report = await gevalEvaluator.evaluate(input);
    expect(report.scores.ui.evaluated).toBe(false);
    expect(report.scores.ui.score).toBeNull();
    // Only the 3 present dimensions hit the judge.
    expect(mockCallGroq).toHaveBeenCalledTimes(3);
    expect(report.overallScore).toBeGreaterThan(0);
  });

  it("degrades gracefully when a judge call throws", async () => {
    mockCallGroq.mockRejectedValue(new Error("rate limit"));
    const report = await gevalEvaluator.evaluate(fullInput());
    for (const key of ["srs", "ui", "uml", "tests"] as const) {
      expect(report.scores[key].evaluated).toBe(false);
    }
    expect(report.overallScore).toBe(0);
    expect(report.grade).toBe("Failed");
  });
});
