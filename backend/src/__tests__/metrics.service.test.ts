import {
  evaluateSRS,
  evaluateFunctional,
  evaluateSecurity,
  evaluateUml,
  reportToMarkdown,
  type ArtifactMap,
} from "../services/metrics.service";
import { SAMPLE_SRS } from "./fixtures/sample-srs";

/** Deep clone so each test can degrade a copy without touching the golden set. */
const clone = (): ArtifactMap => JSON.parse(JSON.stringify(SAMPLE_SRS));

describe("evaluateSRS — golden SRS", () => {
  const report = evaluateSRS(SAMPLE_SRS);

  it("scores a well-formed SRS at or near 100% accuracy", () => {
    expect(report.overall).toBeGreaterThanOrEqual(0.99);
  });

  it("scores every quality category highly", () => {
    for (const cat of ["completeness", "conformance", "coverage", "validity"]) {
      expect(report.byCategory[cat]).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("evaluates all ten pipeline stages", () => {
    const ids = report.metrics.map((m) => m.id).join(" ");
    for (const prefix of ["EXT", "FR", "NFR", "SR-", "TC", "STC", "WF", "TR", "UML", "UI"]) {
      expect(ids).toContain(prefix);
    }
  });

  it("renders a markdown table with an overall accuracy row", () => {
    const md = reportToMarkdown(report);
    expect(md).toContain("| Metric | Category | Score | Detail |");
    expect(md).toMatch(/Overall accuracy.*\d+\.\d%/);
  });
});

describe("evaluateSRS — degraded inputs lower the score", () => {
  it("penalises a missing artifact", () => {
    const a = clone();
    delete a.uml_diagrams;
    const report = evaluateSRS(a);
    const uml = report.metrics.find((m) => m.id === "uml_diagrams-present");
    expect(uml?.score).toBe(0);
    expect(report.overall).toBeLessThan(evaluateSRS(SAMPLE_SRS).overall);
  });

  it("penalises too few functional requirements", () => {
    const a = clone();
    a.functional_requirements.requirements = a.functional_requirements.requirements.slice(0, 4);
    const m = evaluateFunctional(a.functional_requirements).find((x) => x.id === "FR-count")!;
    expect(m.score).toBeCloseTo(4 / 10, 5);
  });

  it("flags FRs that drop the IEEE-830 'shall' phrasing", () => {
    const a = clone();
    a.functional_requirements.requirements[0].description = "Users can log in.";
    const m = evaluateFunctional(a.functional_requirements).find((x) => x.id === "FR-shall")!;
    expect(m.passed).toBe(m.total - 1);
  });

  it("flags malformed requirement IDs", () => {
    const a = clone();
    a.functional_requirements.requirements[0].id = "REQ_1";
    const m = evaluateFunctional(a.functional_requirements).find((x) => x.id === "FR-id")!;
    expect(m.score).toBeLessThan(1);
  });

  it("flags security requirements not mapped to OWASP categories", () => {
    const a = clone();
    a.security_requirements.requirements[0].owasp_category = "General";
    const m = evaluateSecurity(a.security_requirements).find((x) => x.id === "SR-owasp")!;
    expect(m.passed).toBe(m.total - 1);
  });

  it("flags broken Mermaid diagrams", () => {
    const a = clone();
    a.uml_diagrams.diagrams[0].mermaid = "this is not mermaid";
    const m = evaluateUml(a.uml_diagrams).find((x) => x.id === "UML-mermaid")!;
    expect(m.passed).toBe(m.total - 1);
  });

  it("drops traceability coverage when a test case references an unknown FR", () => {
    const a = clone();
    // Make half the FRs uncovered by pointing their test cases elsewhere.
    a.functional_test_cases.test_cases = a.functional_test_cases.test_cases.map((t: any) => ({
      ...t,
      fr_id: "FR-999",
    }));
    const report = evaluateSRS(a);
    const cov = report.metrics.find((m) => m.id === "TC-coverage")!;
    expect(cov.score).toBe(0);
  });
});

describe("evaluateSRS — empty input", () => {
  it("scores an empty artifact map at 0 without throwing", () => {
    const report = evaluateSRS({});
    expect(report.overall).toBe(0);
    expect(report.metrics.every((m) => m.score === 0)).toBe(true);
  });
});
