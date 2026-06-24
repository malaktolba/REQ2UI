/**
 * SRS quality-metrics engine.
 *
 * Scores a generated SRS (the map of artifact type → content that the pipeline
 * persists) against a set of measurable, IEEE-830/829-derived rubrics. Each
 * rubric is a "metric": a passed/total count and a 0..1 score. The mean of the
 * metric scores is reported as the overall *accuracy* of a generated SRS.
 *
 * This is deliberately pure and dependency-free so it can run in three places:
 *   1. Unit tests (against golden + degraded fixtures) — proves the rubric.
 *   2. The DB report tool (against real generated projects) — produces the
 *      accuracy numbers for the thesis testing chapter.
 *   3. Ad-hoc, on a single artifact set.
 */

/** A single quality dimension scored over a generated SRS. */
export interface MetricResult {
  id: string;
  category: "completeness" | "conformance" | "coverage" | "validity";
  description: string;
  passed: number;
  total: number;
  /** passed / total, in [0,1]. A metric with nothing to evaluate scores 0. */
  score: number;
  detail?: string;
}

export interface AccuracyReport {
  metrics: MetricResult[];
  /** Mean of all metric scores, 0..1. */
  overall: number;
  /** Mean metric score within each category, 0..1. */
  byCategory: Record<string, number>;
}

/** Artifact map: { extraction: {...}, functional_requirements: {...}, ... } */
export type ArtifactMap = Record<string, any>;

const FR_ID = /^FR-\d{2,}$/;
const NFR_ID = /^NFR-\d{2,}$/;
const SR_ID = /^SR-\d{2,}$/;
const TC_ID = /^TC-\d{2,}$/;
const STC_ID = /^STC-\d{2,}$/;
const OWASP = /^A\d{2}:2021/;
const VALID_PRIORITY = new Set(["Critical", "High", "Medium", "Low"]);
const VALID_NFR_CATEGORY = new Set([
  "Performance", "Security", "Usability", "Reliability",
  "Scalability", "Maintainability", "Portability",
]);
// Mermaid diagram headers we expect from Stage 9.
const MERMAID_HEADER = /^(flowchart|graph|classDiagram|sequenceDiagram|stateDiagram|erDiagram)\b/m;

const nonEmptyStr = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** ratio of items satisfying `pred`, as a passed/total metric. */
function ratio(
  id: string,
  category: MetricResult["category"],
  description: string,
  items: any[],
  pred: (item: any) => boolean,
  detail?: string
): MetricResult {
  const passed = items.filter(pred).length;
  const total = items.length;
  return { id, category, description, passed, total, score: total ? passed / total : 0, detail };
}

/** boolean metric (1/1 or 0/1). */
function bool(
  id: string,
  category: MetricResult["category"],
  description: string,
  ok: boolean,
  detail?: string
): MetricResult {
  return { id, category, description, passed: ok ? 1 : 0, total: 1, score: ok ? 1 : 0, detail };
}

/** A count-floor metric: scored as min(actual/floor, 1). */
function floor(
  id: string,
  category: MetricResult["category"],
  description: string,
  actual: number,
  required: number
): MetricResult {
  const score = required ? Math.min(actual / required, 1) : 0;
  return {
    id, category, description,
    passed: Math.min(actual, required), total: required, score,
    detail: `${actual} of ≥${required} expected`,
  };
}

// ── Per-stage evaluators ──────────────────────────────────────────────────────

export function evaluateExtraction(content: any): MetricResult[] {
  const prose = ["system_summary", "abstract", "motivation", "problem_statement", "scope", "product_perspective"];
  const presentProse = prose.filter((k) => nonEmptyStr(content?.[k])).length;
  const extracted = arr(content?.extracted);
  return [
    {
      id: "EXT-prose", category: "completeness",
      description: "SRS front-matter prose fields present",
      passed: presentProse, total: prose.length, score: presentProse / prose.length,
    },
    bool("EXT-actors", "completeness", "At least one actor identified", arr(content?.actors).length >= 1),
    bool("EXT-objectives", "completeness", "Project objectives listed", arr(content?.objectives).length >= 1),
    floor("EXT-extracted", "completeness", "Extracted requirement statements", extracted.length, 10),
  ];
}

export function evaluateFunctional(content: any): MetricResult[] {
  const reqs = arr(content?.requirements);
  return [
    floor("FR-count", "completeness", "Functional requirements generated", reqs.length, 10),
    ratio("FR-schema", "conformance", "FR has id, title, description & acceptance criteria", reqs,
      (r) => nonEmptyStr(r.id) && nonEmptyStr(r.title) && nonEmptyStr(r.description) && arr(r.acceptance_criteria).length > 0),
    ratio("FR-id", "conformance", "FR id matches FR-NNN format", reqs, (r) => FR_ID.test(r.id ?? "")),
    ratio("FR-shall", "conformance", "FR uses IEEE-830 'The system shall' phrasing", reqs,
      (r) => /the system shall/i.test(r.description ?? "")),
    ratio("FR-priority", "validity", "FR priority is a valid level", reqs, (r) => VALID_PRIORITY.has(r.priority)),
  ];
}

export function evaluateNonFunctional(content: any): MetricResult[] {
  const reqs = arr(content?.requirements);
  return [
    floor("NFR-count", "completeness", "Non-functional requirements generated", reqs.length, 8),
    ratio("NFR-schema", "conformance", "NFR has id, title, description & metric", reqs,
      (r) => nonEmptyStr(r.id) && nonEmptyStr(r.title) && nonEmptyStr(r.description) && nonEmptyStr(r.metric)),
    ratio("NFR-id", "conformance", "NFR id matches NFR-NNN format", reqs, (r) => NFR_ID.test(r.id ?? "")),
    ratio("NFR-category", "validity", "NFR category is a recognised quality attribute", reqs,
      (r) => VALID_NFR_CATEGORY.has(r.category)),
  ];
}

export function evaluateSecurity(content: any): MetricResult[] {
  const reqs = arr(content?.requirements);
  return [
    floor("SR-count", "completeness", "Security requirements generated", reqs.length, 8),
    ratio("SR-schema", "conformance", "SR has id, title, description & controls", reqs,
      (r) => nonEmptyStr(r.id) && nonEmptyStr(r.title) && nonEmptyStr(r.description) && arr(r.controls).length > 0),
    ratio("SR-id", "conformance", "SR id matches SR-NNN format", reqs, (r) => SR_ID.test(r.id ?? "")),
    ratio("SR-owasp", "validity", "SR maps to a valid OWASP 2021 category", reqs,
      (r) => OWASP.test(r.owasp_category ?? "")),
  ];
}

export function evaluateFunctionalTests(content: any, fr: any): MetricResult[] {
  const tcs = arr(content?.test_cases);
  const frIds = new Set(arr(fr?.requirements).map((r: any) => r.id));
  const frCount = frIds.size || arr(fr?.requirements).length;
  const out: MetricResult[] = [
    ratio("TC-schema", "conformance", "Test case has id, steps & expected result", tcs,
      (t) => nonEmptyStr(t.id) && arr(t.steps).length > 0 && nonEmptyStr(t.expected_result)),
    ratio("TC-id", "conformance", "Test case id matches TC-NNN format", tcs, (t) => TC_ID.test(t.id ?? "")),
  ];
  // Coverage: every FR should be referenced by ≥1 test case.
  if (frCount > 0) {
    const referenced = new Set(tcs.map((t) => t.fr_id).filter((x) => frIds.has(x)));
    out.push({
      id: "TC-coverage", category: "coverage",
      description: "Functional requirements covered by ≥1 test case",
      passed: referenced.size, total: frCount, score: referenced.size / frCount,
      detail: `${referenced.size}/${frCount} FRs covered`,
    });
    out.push(floor("TC-density", "coverage", "Test cases per functional requirement (≥2×)", tcs.length, frCount * 2));
  }
  return out;
}

export function evaluateSecurityTests(content: any, sr: any): MetricResult[] {
  const tcs = arr(content?.test_cases);
  const srIds = new Set(arr(sr?.requirements).map((r: any) => r.id));
  const out: MetricResult[] = [
    ratio("STC-schema", "conformance", "Security test has id, steps & expected result", tcs,
      (t) => nonEmptyStr(t.id) && arr(t.steps).length > 0 && nonEmptyStr(t.expected_result)),
    ratio("STC-id", "conformance", "Security test id matches STC-NNN format", tcs, (t) => STC_ID.test(t.id ?? "")),
  ];
  if (srIds.size > 0) {
    const referenced = new Set(tcs.map((t) => t.sr_id).filter((x) => srIds.has(x)));
    out.push({
      id: "STC-coverage", category: "coverage",
      description: "Security requirements covered by ≥1 security test",
      passed: referenced.size, total: srIds.size, score: referenced.size / srIds.size,
      detail: `${referenced.size}/${srIds.size} SRs covered`,
    });
  }
  return out;
}

export function evaluateWireframes(content: any): MetricResult[] {
  const screens = arr(content?.screens);
  return [
    bool("WF-present", "completeness", "At least one screen described", screens.length >= 1),
    ratio("WF-schema", "conformance", "Screen has name, route & components", screens,
      (s) => nonEmptyStr(s.name) && nonEmptyStr(s.route) && arr(s.components).length > 0),
  ];
}

export function evaluateTraceability(content: any, fr: any): MetricResult[] {
  const matrix = arr(content?.matrix);
  const frIds = new Set(arr(fr?.requirements).map((r: any) => r.id));
  const frCount = frIds.size || arr(fr?.requirements).length;
  const out: MetricResult[] = [
    ratio("TR-links", "coverage", "Matrix rows link FR to ≥1 test case", matrix,
      (m) => arr(m.test_cases).length > 0),
  ];
  if (frCount > 0) {
    const present = new Set(matrix.map((m) => m.fr_id).filter((x) => frIds.has(x)));
    out.push({
      id: "TR-completeness", category: "coverage",
      description: "Every functional requirement appears in the traceability matrix",
      passed: present.size, total: frCount, score: present.size / frCount,
      detail: `${present.size}/${frCount} FRs traced`,
    });
  }
  return out;
}

export function evaluateUml(content: any): MetricResult[] {
  const diagrams = arr(content?.diagrams);
  return [
    floor("UML-count", "completeness", "UML diagrams generated", diagrams.length, 3),
    ratio("UML-mermaid", "validity", "Diagram contains valid Mermaid header", diagrams,
      (d) => typeof d.mermaid === "string" && MERMAID_HEADER.test(d.mermaid.trim())),
  ];
}

export function evaluateUiCode(content: any): MetricResult[] {
  const screens = arr(content?.screens);
  return [
    bool("UI-present", "completeness", "At least one UI screen generated", screens.length >= 1),
    ratio("UI-html", "validity", "Screen HTML is a complete document with a body", screens,
      (s) => typeof s.html === "string" && /<body[\s>]/i.test(s.html) && /<\/html>/i.test(s.html)),
  ];
}

/**
 * Evaluate a full artifact map and produce an accuracy report. Stages whose
 * artifact is missing contribute a single 0-scored "present" metric, so an
 * incomplete SRS is penalised rather than silently skipped.
 */
export function evaluateSRS(artifacts: ArtifactMap): AccuracyReport {
  const metrics: MetricResult[] = [];
  const stage = (type: string, label: string, evalFn: (c: any) => MetricResult[]) => {
    if (artifacts[type] == null) {
      metrics.push(bool(`${type}-present`, "completeness", `${label} artifact present`, false, "missing"));
    } else {
      metrics.push(...evalFn(artifacts[type]));
    }
  };

  stage("extraction", "Requirement extraction", evaluateExtraction);
  stage("functional_requirements", "Functional requirements", evaluateFunctional);
  stage("non_functional_requirements", "Non-functional requirements", evaluateNonFunctional);
  stage("security_requirements", "Security requirements", evaluateSecurity);
  if (artifacts.functional_test_cases != null)
    metrics.push(...evaluateFunctionalTests(artifacts.functional_test_cases, artifacts.functional_requirements));
  else metrics.push(bool("functional_test_cases-present", "completeness", "Functional test cases artifact present", false, "missing"));
  if (artifacts.security_test_cases != null)
    metrics.push(...evaluateSecurityTests(artifacts.security_test_cases, artifacts.security_requirements));
  else metrics.push(bool("security_test_cases-present", "completeness", "Security test cases artifact present", false, "missing"));
  stage("wireframes", "UI wireframes", evaluateWireframes);
  if (artifacts.traceability_matrix != null)
    metrics.push(...evaluateTraceability(artifacts.traceability_matrix, artifacts.functional_requirements));
  else metrics.push(bool("traceability_matrix-present", "completeness", "Traceability matrix artifact present", false, "missing"));
  stage("uml_diagrams", "UML diagrams", evaluateUml);
  stage("ui_code", "UI code", evaluateUiCode);

  const overall = metrics.length ? metrics.reduce((s, m) => s + m.score, 0) / metrics.length : 0;

  const byCategory: Record<string, number> = {};
  for (const cat of ["completeness", "conformance", "coverage", "validity"]) {
    const ms = metrics.filter((m) => m.category === cat);
    byCategory[cat] = ms.length ? ms.reduce((s, m) => s + m.score, 0) / ms.length : 0;
  }

  return { metrics, overall, byCategory };
}

/** Format an accuracy report as a markdown table — handy for the thesis. */
export function reportToMarkdown(report: AccuracyReport): string {
  const lines = [
    "| Metric | Category | Score | Detail |",
    "|---|---|---:|---|",
  ];
  for (const m of report.metrics) {
    const pct = (m.score * 100).toFixed(0);
    lines.push(`| ${m.id} — ${m.description} | ${m.category} | ${pct}% | ${m.detail ?? `${m.passed}/${m.total}`} |`);
  }
  lines.push(`| **Overall accuracy** | | **${(report.overall * 100).toFixed(1)}%** | |`);
  return lines.join("\n");
}
