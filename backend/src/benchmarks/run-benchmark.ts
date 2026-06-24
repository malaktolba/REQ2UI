/**
 * Live pipeline benchmark — the accurate source of generation-time numbers for
 * the thesis testing chapter.
 *
 * Unlike the DB report (which reads historical, possibly resume-contaminated
 * timings), this runs the pipeline fresh and times each stage in-process with a
 * monotonic high-resolution clock via the StageEvent stream. It then scores the
 * freshly generated SRS with the metrics engine, so a single run yields both
 * accuracy and timing.
 *
 * ⚠ This makes real Groq + Gemini calls and consumes API budget.
 *
 * Usage:
 *   npm run bench -- <projectId>          re-generate an existing project (force) and time it
 *   npm run bench -- <projectId> --runs=3 average over 3 fresh runs (3× the token cost)
 *
 * Writes backend/reports/benchmark-report.json and .md.
 */
import { performance } from "perf_hooks";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { sql } from "../db/client";
import { runPipeline } from "../services/pipeline.service";
import type { StageEvent } from "../services/pipeline.service";
import { evaluateSRS, type ArtifactMap } from "../services/metrics.service";

const STAGE_NAMES = [
  "Requirement Extraction", "Functional Requirements", "Non-Functional Requirements",
  "Security Requirements", "Functional Test Cases", "Security Test Cases",
  "UI Wireframe Descriptions", "Traceability Matrix", "UML Diagrams", "UI Code Generation",
];

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Times one full pipeline run, returning per-stage seconds and the total. */
async function timedRun(id: string, name: string, description: string) {
  const start = new Map<number, number>();
  const durations: Record<number, number> = {};

  const emit = (e: StageEvent) => {
    if (e.status === "running" && !start.has(e.stage)) start.set(e.stage, performance.now());
    if (e.status === "completed" && start.has(e.stage)) {
      durations[e.stage] = (performance.now() - start.get(e.stage)!) / 1000;
    }
    const detail = e.detail ? ` — ${e.detail}` : "";
    process.stderr.write(`  [stage ${e.stage}] ${e.status}${detail}\n`);
  };

  const t0 = performance.now();
  await runPipeline(id, name, description, emit, { force: true });
  const totalSeconds = (performance.now() - t0) / 1000;
  return { durations, totalSeconds };
}

async function main() {
  const projectId = process.argv[2];
  if (!projectId || projectId.startsWith("--")) {
    console.error("Usage: npm run bench -- <projectId> [--runs=N]");
    process.exit(1);
  }
  const runsArg = process.argv.find((a) => a.startsWith("--runs="));
  const runs = runsArg ? Math.max(1, parseInt(runsArg.split("=")[1], 10)) : 1;

  const rows = (await sql`SELECT id, name, description FROM projects WHERE id = ${projectId}`) as any[];
  if (!rows.length) {
    console.error(`Project ${projectId} not found.`);
    process.exit(1);
  }
  const { id, name, description } = rows[0];

  console.error(`Benchmarking "${name}" over ${runs} run(s) — this calls the real LLMs.\n`);

  const perRun: { durations: Record<number, number>; totalSeconds: number }[] = [];
  for (let r = 1; r <= runs; r++) {
    console.error(`── Run ${r}/${runs} ──`);
    perRun.push(await timedRun(id, name, description));
  }

  // Accuracy of the final generated SRS.
  const artifactRows = (await sql`SELECT type, content FROM artifacts WHERE project_id = ${id}`) as any[];
  const artifacts: ArtifactMap = Object.fromEntries(artifactRows.map((a) => [a.type, a.content]));
  const accuracy = evaluateSRS(artifacts);

  // ── Build report ────────────────────────────────────────────────────────
  const lines: string[] = [];
  lines.push(`# REQ2UI — Live Benchmark: ${name}`, "");
  lines.push(`Generated ${new Date().toISOString()} over **${runs}** fresh run(s).`, "");

  lines.push("## Generation time per stage", "");
  lines.push("| # | Stage | Mean (s) | Min (s) | Max (s) |", "|---:|---|---:|---:|---:|");
  for (let stage = 1; stage <= 10; stage++) {
    const xs = perRun.map((p) => p.durations[stage]).filter((x): x is number => typeof x === "number");
    if (!xs.length) { lines.push(`| ${stage} | ${STAGE_NAMES[stage - 1]} | — | — | — |`); continue; }
    lines.push(`| ${stage} | ${STAGE_NAMES[stage - 1]} | ${mean(xs).toFixed(2)} | ${Math.min(...xs).toFixed(2)} | ${Math.max(...xs).toFixed(2)} |`);
  }
  const totals = perRun.map((p) => p.totalSeconds);
  lines.push(`| | **End-to-end total** | **${mean(totals).toFixed(2)}** | ${Math.min(...totals).toFixed(2)} | ${Math.max(...totals).toFixed(2)} |`, "");

  lines.push("## Accuracy of generated SRS", "");
  lines.push(`Overall accuracy: **${(accuracy.overall * 100).toFixed(1)}%**`, "");
  lines.push("| Dimension | Score |", "|---|---:|");
  for (const cat of ["completeness", "conformance", "coverage", "validity"]) {
    lines.push(`| ${cat[0].toUpperCase() + cat.slice(1)} | ${(accuracy.byCategory[cat] * 100).toFixed(1)}% |`);
  }
  lines.push("");
  const md = lines.join("\n");

  const outDir = join(__dirname, "..", "..", "reports");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "benchmark-report.json"), JSON.stringify({
    project: { id, name }, runs, perRun, accuracy,
    meanTotalSeconds: mean(totals), generatedAt: new Date().toISOString(),
  }, null, 2));
  writeFileSync(join(outDir, "benchmark-report.md"), md);

  console.log("\n" + md);
  console.error("Wrote reports/benchmark-report.json and .md");
}

main().catch((err) => { console.error("Benchmark failed:", err); process.exit(1); });
