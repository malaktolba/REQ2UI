/**
 * GEval quality-evaluation service (LLM-as-a-Judge).
 *
 * After the pipeline generates a project's artifacts, this service grades their
 * QUALITY — independently of generation. It bundles the original requirements and
 * each generated artifact, asks an LLM judge to score them against the rubric in
 * `config/evaluation.ts` (1-5 per criterion), then aggregates those into per-
 * artifact and overall percentage scores plus strengths, issues and
 * recommendations.
 *
 * Design notes (per spec):
 *  - The evaluator ONLY analyses quality; it never generates or modifies artifacts.
 *  - Evaluation is independent of generation and must NOT block it — callers wrap
 *    `evaluateProject` in try/catch; a failed judge call for one dimension degrades
 *    gracefully (that dimension is marked un-evaluated) rather than failing the run.
 *  - The rubric/criteria/weights/prompts are all version-controlled config.
 *  - History is persisted per project in the `evaluations` table.
 *  - The `Evaluator` interface leaves room for future methods (human review,
 *    automated UI testing, model/prompt comparison) without reworking the schema.
 */

import { sql } from "../db/client";
import { callGroq, GROQ_HEAVY } from "./groq.service";
import {
  ArtifactKey,
  ArtifactRubric,
  EVALUATION_CONFIG_VERSION,
  EvaluationMethod,
  RUBRICS,
  SCORE_LABELS,
  SCORE_SCALE,
  buildJudgeSystemPrompt,
  gradeForScore,
  rubricFor,
  scoreToPercentage,
} from "../config/evaluation";
import { hasUIPreferences, uiPreferencesPromptBlock, UIPreferences } from "../config/uiPreferences";

// ── Report shapes ─────────────────────────────────────────────────────────────

export interface CriterionScore {
  key: string;
  label: string;
  weight: number;
  /** 1-5, or null when the dimension could not be evaluated. */
  score: number | null;
  justification: string;
}

export interface ArtifactScore {
  key: ArtifactKey;
  label: string;
  /** Share of the overall score. */
  weight: number;
  /** Weighted mean of criteria, 1-5; null when not evaluated. */
  score: number | null;
  /** score mapped to 0-100; null when not evaluated. */
  percentage: number | null;
  /** "Excellent".."Failed" for `score`, or null. */
  rating: string | null;
  /** Whether this dimension was actually judged (source artifact present + judge ran). */
  evaluated: boolean;
  criteria: CriterionScore[];
  strengths: string[];
  issues: string[];
  recommendations: string[];
}

export interface EvaluationReport {
  version: string;
  method: EvaluationMethod;
  /** Overall quality, 0-100, weighted across evaluated artifacts. */
  overallScore: number;
  grade: string;
  scores: Record<ArtifactKey, ArtifactScore>;
  /** Top recommendations aggregated across all dimensions. */
  recommendations: string[];
  generatedAt: string;
}

/** The bundle a method evaluates. Mirrors the spec's evaluator input. */
export interface EvaluationInput {
  originalRequirements: string;
  generatedSRS: any;
  generatedUML: any;
  generatedUI: any;
  generatedTestCases: any;
  userPreferences?: UIPreferences;
}

/** Pluggable evaluation method. New methods implement this and produce a report. */
export interface Evaluator {
  method: EvaluationMethod;
  evaluate(input: EvaluationInput): Promise<EvaluationReport>;
}

// ── Serialization helpers (keep the judge prompt within token budget) ──────────

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const truncate = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + "…[truncated]" : s);

/** Compact text view of the SRS artifacts for the judge. */
function serializeSRS(srs: any): string {
  if (!srs) return "(no SRS generated)";
  const ext = srs.extraction ?? {};
  const fr = arr(srs.functional_requirements?.requirements);
  const nfr = arr(srs.non_functional_requirements?.requirements);
  const sr = arr(srs.security_requirements?.requirements);
  const lines: string[] = [];
  if (ext.system_summary) lines.push(`System summary: ${ext.system_summary}`);
  if (arr(ext.actors).length) lines.push(`Actors: ${ext.actors.join(", ")}`);
  if (arr(ext.constraints).length) lines.push(`Constraints: ${ext.constraints.join("; ")}`);
  if (arr(ext.assumptions).length) lines.push(`Assumptions: ${ext.assumptions.join("; ")}`);
  lines.push(`\nFunctional requirements (${fr.length}):`);
  lines.push(...fr.map((r: any) => `  ${r.id} [${r.priority}] ${r.title}: ${r.description}`));
  lines.push(`\nNon-functional requirements (${nfr.length}):`);
  lines.push(...nfr.map((r: any) => `  ${r.id} [${r.category}] ${r.title}: ${r.description}`));
  lines.push(`\nSecurity requirements (${sr.length}):`);
  lines.push(...sr.map((r: any) => `  ${r.id} [${r.owasp_category}] ${r.title}: ${r.description}`));
  return truncate(lines.join("\n"), 9000);
}

/** Compact text view of the UI code (component lists + truncated HTML per screen). */
function serializeUI(ui: any): string {
  const screens = arr(ui?.screens);
  if (!screens.length) return "(no UI generated)";
  const ds = ui.design_system ? `Shared design system present (navbar/footer/body classes).\n` : "";
  const blocks = screens.map((s: any) => {
    const html = typeof s.html === "string" ? truncate(s.html, 1400) : "(no html)";
    return `### Screen ${s.id} — ${s.name}${s.route ? ` (${s.route})` : ""}\n${
      s.description ? s.description + "\n" : ""
    }HTML:\n${html}`;
  });
  return truncate(ds + blocks.join("\n\n"), 11000);
}

/** Compact text view of the UML diagrams (Mermaid source). */
function serializeUML(uml: any): string {
  const diagrams = arr(uml?.diagrams);
  if (!diagrams.length) return "(no UML generated)";
  return truncate(
    diagrams
      .map((d: any) => `### ${d.title} (${d.type})\n${d.description ?? ""}\n${d.mermaid ?? ""}`)
      .join("\n\n"),
    7000
  );
}

/** Compact text view of functional + security test cases. */
function serializeTests(tests: any): string {
  const fn = arr(tests?.functional?.test_cases);
  const sec = arr(tests?.security?.test_cases);
  if (!fn.length && !sec.length) return "(no test cases generated)";
  const lines: string[] = [`Functional test cases (${fn.length}):`];
  lines.push(
    ...fn.map(
      (t: any) =>
        `  ${t.id} → ${t.fr_id ?? "?"} [${t.priority}] ${t.title}; steps: ${arr(t.steps).length}; expected: ${t.expected_result ?? ""}`
    )
  );
  lines.push(`\nSecurity test cases (${sec.length}):`);
  lines.push(
    ...sec.map(
      (t: any) =>
        `  ${t.id} → ${t.sr_id ?? "?"} [${t.severity}] ${t.title}; vector: ${t.attack_vector ?? ""}; expected: ${t.expected_result ?? ""}`
    )
  );
  return truncate(lines.join("\n"), 9000);
}

function serializeFor(key: ArtifactKey, input: EvaluationInput): string {
  switch (key) {
    case "srs": return serializeSRS(input.generatedSRS);
    case "ui": return serializeUI(input.generatedUI);
    case "uml": return serializeUML(input.generatedUML);
    case "tests": return serializeTests(input.generatedTestCases);
  }
}

/** True when the source artifact for a dimension actually exists. */
function hasContent(key: ArtifactKey, input: EvaluationInput): boolean {
  switch (key) {
    case "srs": return arr(input.generatedSRS?.functional_requirements?.requirements).length > 0;
    case "ui": return arr(input.generatedUI?.screens).length > 0;
    case "uml": return arr(input.generatedUML?.diagrams).length > 0;
    case "tests":
      return (
        arr(input.generatedTestCases?.functional?.test_cases).length > 0 ||
        arr(input.generatedTestCases?.security?.test_cases).length > 0
      );
  }
}

// ── Pure aggregation (exported for unit testing) ──────────────────────────────

const clampScore = (n: unknown): number => {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return SCORE_SCALE.min;
  return Math.max(SCORE_SCALE.min, Math.min(SCORE_SCALE.max, v));
};

/** Raw judge output for one artifact dimension. */
export interface JudgeOutput {
  criteria: { key: string; score: number; justification?: string }[];
  strengths?: string[];
  issues?: string[];
  recommendations?: string[];
}

/**
 * Combines a rubric with the judge's raw output into a scored ArtifactScore.
 * Criteria are matched by key; a criterion the judge omitted defaults to a neutral
 * 3 ("Acceptable") so a malformed response degrades gracefully rather than throwing.
 */
export function aggregateArtifact(rubric: ArtifactRubric, judged: JudgeOutput): ArtifactScore {
  const byKey = new Map((judged.criteria ?? []).map((c) => [c.key, c]));
  const criteria: CriterionScore[] = rubric.criteria.map((c) => {
    const j = byKey.get(c.key);
    const score = j ? clampScore(j.score) : 3;
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score,
      justification: j?.justification?.trim() || (j ? "" : "Not assessed; assumed acceptable."),
    };
  });

  const totalWeight = rubric.criteria.reduce((s, c) => s + c.weight, 0) || 1;
  const weighted = criteria.reduce((s, c) => s + (c.score ?? 0) * c.weight, 0) / totalWeight;
  const score = Math.round(weighted * 100) / 100;

  return {
    key: rubric.key,
    label: rubric.label,
    weight: rubric.weight,
    score,
    percentage: scoreToPercentage(score),
    rating: SCORE_LABELS[Math.round(score)] ?? null,
    evaluated: true,
    criteria,
    strengths: (judged.strengths ?? []).filter((x) => typeof x === "string").slice(0, 4),
    issues: (judged.issues ?? []).filter((x) => typeof x === "string").slice(0, 4),
    recommendations: (judged.recommendations ?? []).filter((x) => typeof x === "string").slice(0, 3),
  };
}

/** A placeholder score for a dimension that has no source artifact or failed to judge. */
function unevaluatedArtifact(rubric: ArtifactRubric, reason: string): ArtifactScore {
  return {
    key: rubric.key,
    label: rubric.label,
    weight: rubric.weight,
    score: null,
    percentage: null,
    rating: null,
    evaluated: false,
    criteria: rubric.criteria.map((c) => ({
      key: c.key,
      label: c.label,
      weight: c.weight,
      score: null,
      justification: reason,
    })),
    strengths: [],
    issues: [reason],
    recommendations: [],
  };
}

/**
 * Aggregates per-artifact scores into the overall percentage. Only evaluated
 * dimensions count; their weights are re-normalised so a project evaluated before
 * (say) UI generation still yields a meaningful overall over the present artifacts.
 */
export function aggregateOverall(scores: ArtifactScore[]): { overallScore: number; grade: string } {
  const evaluated = scores.filter((s) => s.evaluated && s.percentage != null);
  if (!evaluated.length) return { overallScore: 0, grade: "Failed" };
  const totalWeight = evaluated.reduce((s, a) => s + a.weight, 0) || 1;
  const overall = evaluated.reduce((s, a) => s + (a.percentage as number) * a.weight, 0) / totalWeight;
  const overallScore = Math.round(overall);
  return { overallScore, grade: gradeForScore(overallScore) };
}

/** Picks the most relevant recommendations across dimensions, lowest scores first. */
function topRecommendations(scores: ArtifactScore[], limit = 6): string[] {
  const ordered = [...scores]
    .filter((s) => s.recommendations.length)
    .sort((a, b) => (a.percentage ?? 0) - (b.percentage ?? 0));
  const out: string[] = [];
  for (const s of ordered) {
    for (const r of s.recommendations) {
      if (!out.includes(r)) out.push(`${s.label}: ${r}`);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

// ── The GEval evaluator ───────────────────────────────────────────────────────

/** Runs the LLM judge for one artifact dimension. */
async function judgeArtifact(rubric: ArtifactRubric, input: EvaluationInput): Promise<ArtifactScore> {
  if (!hasContent(rubric.key, input)) {
    return unevaluatedArtifact(rubric, "Artifact not generated — nothing to evaluate.");
  }

  const system = buildJudgeSystemPrompt(rubric);
  const prefsBlock =
    rubric.key === "ui" && hasUIPreferences(input.userPreferences)
      ? `\n\nThe user specified these UI design preferences — judge "preference_match" against them:${uiPreferencesPromptBlock(
          input.userPreferences
        )}`
      : rubric.key === "ui"
      ? "\n\nThe user specified NO UI design preferences — judge \"preference_match\" on sensible default design choices."
      : "";

  const user = `ORIGINAL USER REQUIREMENTS:
${truncate(input.originalRequirements || "(none provided)", 4000)}
${prefsBlock}

GENERATED ${rubric.label.toUpperCase()} TO EVALUATE:
${serializeFor(rubric.key, input)}`;

  try {
    // Heavy model first: judging requires reasoning. The Groq client falls back
    // across tiers on rate limits, and max_tokens is capped for a compact verdict.
    const raw = await callGroq(system, user, 2000, GROQ_HEAVY);
    return aggregateArtifact(rubric, raw as JudgeOutput);
  } catch (err: any) {
    return unevaluatedArtifact(rubric, `Evaluation unavailable (${err?.message ?? "judge error"}).`);
  }
}

export const gevalEvaluator: Evaluator = {
  method: "geval",
  async evaluate(input: EvaluationInput): Promise<EvaluationReport> {
    // Judge every dimension in parallel; the Groq client absorbs rate-limit bursts.
    const scoreList = await Promise.all(RUBRICS.map((r) => judgeArtifact(r, input)));
    const scores = Object.fromEntries(scoreList.map((s) => [s.key, s])) as Record<ArtifactKey, ArtifactScore>;
    const { overallScore, grade } = aggregateOverall(scoreList);

    return {
      version: EVALUATION_CONFIG_VERSION,
      method: "geval",
      overallScore,
      grade,
      scores,
      recommendations: topRecommendations(scoreList),
      generatedAt: new Date().toISOString(),
    };
  },
};

// ── Orchestration + persistence ───────────────────────────────────────────────

/** Map of artifact type → content for a project. */
async function loadArtifacts(projectId: string): Promise<Record<string, any>> {
  const rows = (await sql`SELECT type, content FROM artifacts WHERE project_id = ${projectId}`) as any[];
  return Object.fromEntries(rows.map((a: any) => [a.type, a.content]));
}

/** Assembles the evaluator input bundle from a project's stored artifacts. */
function buildInput(
  description: string,
  artifacts: Record<string, any>,
  userPreferences?: UIPreferences
): EvaluationInput {
  return {
    originalRequirements: description,
    generatedSRS: {
      extraction: artifacts.extraction,
      functional_requirements: artifacts.functional_requirements,
      non_functional_requirements: artifacts.non_functional_requirements,
      security_requirements: artifacts.security_requirements,
    },
    generatedUML: artifacts.uml_diagrams,
    generatedUI: artifacts.ui_code,
    generatedTestCases: {
      functional: artifacts.functional_test_cases,
      security: artifacts.security_test_cases,
    },
    userPreferences,
  };
}

async function persistEvaluation(projectId: string, report: EvaluationReport): Promise<string> {
  const rows = (await sql`
    INSERT INTO evaluations (project_id, method, version, overall_score, grade, report)
    VALUES (${projectId}, ${report.method}, ${report.version}, ${report.overallScore}, ${report.grade}, ${JSON.stringify(
    report
  )})
    RETURNING id
  `) as any[];
  return rows[0].id as string;
}

export interface StoredEvaluation {
  id: string;
  method: string;
  version: string;
  overall_score: number;
  grade: string;
  report: EvaluationReport;
  created_at: string;
}

/**
 * Evaluates a project's current artifacts and stores the result. Verifies project
 * ownership. Returns the stored row (report + metadata). The selected method
 * defaults to GEval; the parameter leaves room for future evaluators.
 */
export async function evaluateProject(
  projectId: string,
  userId: string,
  method: EvaluationMethod = "geval"
): Promise<StoredEvaluation> {
  const projectRows = (await sql`
    SELECT description, ui_preferences FROM projects
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  `) as any[];
  if (!projectRows.length) throw new Error("Project not found");

  const artifacts = await loadArtifacts(projectId);
  if (!arr(artifacts.functional_requirements?.requirements).length) {
    throw new Error("Generate the project artifacts first, then run evaluation.");
  }

  const input = buildInput(
    projectRows[0].description,
    artifacts,
    projectRows[0].ui_preferences ?? undefined
  );

  const evaluator = method === "geval" ? gevalEvaluator : gevalEvaluator;
  const report = await evaluator.evaluate(input);
  const id = await persistEvaluation(projectId, report);

  return {
    id,
    method: report.method,
    version: report.version,
    overall_score: report.overallScore,
    grade: report.grade,
    report,
    created_at: report.generatedAt,
  };
}

/** Latest stored evaluation for a project, or null if none. Verifies ownership. */
export async function getLatestEvaluation(projectId: string, userId: string): Promise<StoredEvaluation | null> {
  await assertOwnership(projectId, userId);
  const rows = (await sql`
    SELECT id, method, version, overall_score, grade, report, created_at
    FROM evaluations WHERE project_id = ${projectId}
    ORDER BY created_at DESC LIMIT 1
  `) as any[];
  return rows.length ? (rows[0] as StoredEvaluation) : null;
}

/** Full evaluation history for a project (newest first). Verifies ownership. */
export async function listEvaluations(projectId: string, userId: string): Promise<StoredEvaluation[]> {
  await assertOwnership(projectId, userId);
  const rows = (await sql`
    SELECT id, method, version, overall_score, grade, report, created_at
    FROM evaluations WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `) as any[];
  return rows as StoredEvaluation[];
}

async function assertOwnership(projectId: string, userId: string): Promise<void> {
  const rows = (await sql`
    SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  `) as any[];
  if (!rows.length) throw new Error("Project not found");
}
