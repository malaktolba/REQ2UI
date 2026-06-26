import { sql } from "./db/client";
import { evaluateProjectAdmin } from "./services/evaluation.service";
(async () => {
  const projs = (await sql`
    SELECT DISTINCT p.id, p.name
    FROM projects p
    JOIN artifacts a ON a.project_id = p.id AND a.type = 'functional_requirements'
    WHERE p.status = 'completed' AND p.deleted_at IS NULL
    ORDER BY p.name
  `) as any[];
  console.log(`Backfilling v4 evaluations for ${projs.length} completed projects…\n`);
  for (const p of projs) {
    const t0 = Date.now();
    try {
      const e = await evaluateProjectAdmin(p.id);
      console.log(`OK   ${p.name}: ${e.overall_score}% (${e.grade})  [${((Date.now()-t0)/1000).toFixed(0)}s]`);
    } catch (err: any) {
      console.log(`FAIL ${p.name}: ${err?.message ?? err}`);
    }
  }
  console.log("\nBackfill complete.");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
