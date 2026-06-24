/**
 * SRS quality & performance report — the data source for the thesis testing
 * chapter.
 *
 * Reads every completed project already in the database (no LLM calls, no token
 * cost), then for each one:
 *   • scores SRS *accuracy* with the metrics engine, and
 *   • derives real *generation time* per stage from pipeline_stages
 *     started_at / finished_at (recorded by the pipeline during the live run).
 *
 * It aggregates across projects and writes:
 *   • backend/reports/srs-quality-report.json   (machine-readable)
 *   • backend/reports/srs-quality-report.md      (paste-ready tables)
 *
 * Run with:  npm run report           (all completed projects)
 *            npm run report -- <id>    (a single project by id)
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { sql } from "../db/client";
import { evaluateSRS, type ArtifactMap, type AccuracyReport } from "../services/metrics.service";

const STAGE_NAMES = [
  "Requirement Extraction", "Functional Requirements", "Non-Functional Requirements",
  "Security Requirements", "Functional Test Cases", "Security Test Cases",
  "UI Wireframe Descriptions", "Traceability Matrix", "UML Diagrams", "UI Code Generation",
];

// A pipeline_stages row's finished_at - started_at is only true generation time
// when the stage ran in a single uninterrupted pass. Resumed runs keep the
// original started_at but stamp a later finished_at, inflating the span to hours
// or days. Any duration beyond this ceiling is treated as resume-contaminated
// and excluded from the timing aggregates. For accurate timing use `npm run bench`.
const MAX_PLAUSIBLE_STAGE_SECONDS = 300;

interface StageRow { stage: number; started_at: string | null; finished_at: string | null; status: string }
interface ProjectEval {
  id: string;
  name: string;
  accuracy: AccuracyReport;
  stageDurations: Record<number, number>; // stage → seconds
  totalSeconds: number;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

async function loadProjects(filterId?: string): Promise<{ id: string; name: string }[]> {
  if (filterId) {
    return (await sql`SELECT id, name FROM projects WHERE id = ${filterId}`) as any[];
  }
  return (await sql`
    SELECT id, name FROM projects
    WHERE status = 'completed' AND deleted_at IS NULL
    ORDER BY created_at ASC
  `) as any[];
}

async function evalProject(id: string, name: string): Promise<ProjectEval> {
  const artifactRows = (await sql`SELECT type, content FROM artifacts WHERE project_id = ${id}`) as any[];
  const artifacts: ArtifactMap = Object.fromEntries(artifactRows.map((a) => [a.type, a.content]));

  const stageRows = (await sql`
    SELECT stage, started_at, finished_at, status FROM pipeline_stages WHERE project_id = ${id}
  `) as StageRow[];

  const stageDurations: Record<number, number> = {};
  for (const s of stageRows) {
    if (s.started_at && s.finished_at && s.status === "completed") {
      const secs = (new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 1000;
      // Drop negatives and resume-contaminated spans; keep only plausible single-pass timings.
      if (secs >= 0 && secs <= MAX_PLAUSIBLE_STAGE_SECONDS) stageDurations[s.stage] = secs;
    }
  }
  const totalSeconds = Object.values(stageDurations).reduce((a, b) => a + b, 0);

  return { id, name, accuracy: evaluateSRS(artifacts), stageDurations, totalSeconds };
}

function buildMarkdown(evals: ProjectEval[]): string {
  const lines: string[] = [];
  lines.push("# REQ2UI — SRS Quality & Performance Report", "");
  lines.push(`Generated ${new Date().toISOString()} over **${evals.length}** completed project(s).`, "");

  // ── Accuracy summary ────────────────────────────────────────────────────
  const overallAcc = mean(evals.map((e) => e.accuracy.overall)) * 100;
  lines.push("## 1. Accuracy", "");
  lines.push(`Mean SRS accuracy across all projects: **${overallAcc.toFixed(1)}%**`, "");
  lines.push("### 1.1 Accuracy by quality dimension", "");
  lines.push("| Dimension | Mean score |", "|---|---:|");
  for (const cat of ["completeness", "conformance", "coverage", "validity"]) {
    const v = mean(evals.map((e) => e.accuracy.byCategory[cat])) * 100;
    lines.push(`| ${cat[0].toUpperCase() + cat.slice(1)} | ${v.toFixed(1)}% |`);
  }
  lines.push("");

  lines.push("### 1.2 Accuracy per project", "");
  lines.push("| Project | Accuracy | Completeness | Conformance | Coverage | Validity |", "|---|---:|---:|---:|---:|---:|");
  for (const e of evals) {
    const c = e.accuracy.byCategory;
    lines.push(
      `| ${e.name} | ${(e.accuracy.overall * 100).toFixed(1)}% | ` +
      `${(c.completeness * 100).toFixed(0)}% | ${(c.conformance * 100).toFixed(0)}% | ` +
      `${(c.coverage * 100).toFixed(0)}% | ${(c.validity * 100).toFixed(0)}% |`
    );
  }
  lines.push("");

  // ── Per-metric averages (which rubrics the model passes/fails most) ──────
  lines.push("### 1.3 Mean score per rubric", "");
  lines.push("| Rubric | Description | Mean score |", "|---|---|---:|");
  const byMetric = new Map<string, { desc: string; scores: number[] }>();
  for (const e of evals) {
    for (const m of e.accuracy.metrics) {
      if (!byMetric.has(m.id)) byMetric.set(m.id, { desc: m.description, scores: [] });
      byMetric.get(m.id)!.scores.push(m.score);
    }
  }
  for (const [id, { desc, scores }] of byMetric) {
    lines.push(`| ${id} | ${desc} | ${(mean(scores) * 100).toFixed(0)}% |`);
  }
  lines.push("");

  // ── Performance / generation time ───────────────────────────────────────
  lines.push("## 2. Generation time", "");
  const totals = evals.map((e) => e.totalSeconds).filter((t) => t > 0);
  if (totals.length) {
    lines.push(
      `Mean end-to-end generation time: **${mean(totals).toFixed(1)} s** ` +
      `(min ${Math.min(...totals).toFixed(1)} s, max ${Math.max(...totals).toFixed(1)} s) ` +
      `over ${totals.length} project(s).`, ""
    );
  } else {
    lines.push(
      "_No plausible single-pass stage timing was found (durations were either absent " +
      "or resume-contaminated). Run `npm run bench` for accurate generation timing._", ""
    );
  }
  lines.push(
    `> Timing counts only stages that completed in a single pass (≤ ${MAX_PLAUSIBLE_STAGE_SECONDS}s); ` +
    "resume-inflated spans are excluded. For dedicated timing runs use `npm run bench`.", ""
  );

  lines.push("### 2.1 Average time per stage", "");
  lines.push("| # | Stage | Mean (s) | Min (s) | Max (s) | Samples |", "|---:|---|---:|---:|---:|---:|");
  for (let stage = 1; stage <= 10; stage++) {
    const xs = evals.map((e) => e.stageDurations[stage]).filter((x): x is number => typeof x === "number");
    if (!xs.length) {
      lines.push(`| ${stage} | ${STAGE_NAMES[stage - 1]} | — | — | — | 0 |`);
      continue;
    }
    lines.push(
      `| ${stage} | ${STAGE_NAMES[stage - 1]} | ${mean(xs).toFixed(1)} | ` +
      `${Math.min(...xs).toFixed(1)} | ${Math.max(...xs).toFixed(1)} | ${xs.length} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const filterId = process.argv[2];
  const projects = await loadProjects(filterId);
  if (!projects.length) {
    console.error("No completed projects found to evaluate.");
    process.exit(1);
  }

  console.error(`Evaluating ${projects.length} project(s)…`);
  const evals: ProjectEval[] = [];
  for (const p of projects) {
    evals.push(await evalProject(p.id, p.name));
  }

  const outDir = join(__dirname, "..", "..", "reports");
  mkdirSync(outDir, { recursive: true });

  const json = {
    generatedAt: new Date().toISOString(),
    projectCount: evals.length,
    meanAccuracy: mean(evals.map((e) => e.accuracy.overall)),
    meanTotalSeconds: mean(evals.map((e) => e.totalSeconds).filter((t) => t > 0)),
    projects: evals,
  };
  writeFileSync(join(outDir, "srs-quality-report.json"), JSON.stringify(json, null, 2));

  const md = buildMarkdown(evals);
  writeFileSync(join(outDir, "srs-quality-report.md"), md);

  console.log(md);
  console.error(`\nWrote reports/srs-quality-report.json and .md`);
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
