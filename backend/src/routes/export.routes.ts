import { Router, Request, Response } from "express";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";
import { generatePDF, generateDOCX, generateCSV } from "../services/export.service";

const router = Router();

async function getArtifacts(projectId: string, userId: string) {
  const project = await sql`
    SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];
  if (!project.length) return null;
  return sql`SELECT type, content FROM artifacts WHERE project_id = ${projectId}` as any;
}

// GET /api/projects/:id/export/pdf
router.get("/:id/export/pdf", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  const buf = await generatePDF(name, artifacts);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.pdf"`);
  res.send(buf);
});

// GET /api/projects/:id/export/docx
router.get("/:id/export/docx", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  const buf = await generateDOCX(name, artifacts);

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.docx"`);
  res.send(buf);
});

// GET /api/projects/:id/export/csv
router.get("/:id/export/csv", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  const csv = generateCSV(artifacts);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.csv"`);
  res.send(csv);
});

export default router;
