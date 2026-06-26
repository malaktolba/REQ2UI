import { Router, Request, Response } from "express";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";
import { compileLaTeX, generateDOCX, generateCSV, generateLaTeX, generateLaTeXZip } from "../services/export.service";

const router = Router();

async function getArtifacts(projectId: string, userId: string) {
  const project = await sql`
    SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];
  if (!project.length) return null;
  return sql`SELECT type, content FROM artifacts WHERE project_id = ${projectId}` as any;
}

/**
 * Stored project metadata merged with account defaults for the document control
 * fields, so the title page always has an author, contact, and version even when
 * the user left them blank at creation.
 */
function effectiveMeta(row: any, user: { name: string; email: string }) {
  const m = row?.metadata ?? {};
  return {
    ...m,
    author: m.author || user.name,
    contact_email: m.contact_email || user.email,
    version: m.version || "1.0",
  };
}

// POST /api/projects/:id/export/pdf  (accepts { diagramSvgs? } in body)
router.post("/:id/export/pdf", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;
  const diagramSvgs: Record<string, string> | undefined = req.body?.diagramSvgs;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name, metadata FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  let buf: Buffer;
  try {
    buf = await compileLaTeX(name, artifacts, effectiveMeta(projectRows[0], req.user!), diagramSvgs);
  } catch (err) {
    console.error("[export/pdf]", err);
    res.status(502).json({ error: "PDF generation failed. The LaTeX document could not be compiled." });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.pdf"`);
  res.send(buf);
});

// GET /api/projects/:id/export/pdf (legacy — no diagram images)
router.get("/:id/export/pdf", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name, metadata FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  let buf: Buffer;
  try {
    buf = await compileLaTeX(name, artifacts, effectiveMeta(projectRows[0], req.user!));
  } catch (err) {
    console.error("[export/pdf]", err);
    res.status(502).json({ error: "PDF generation failed. The LaTeX document could not be compiled." });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.pdf"`);
  res.send(buf);
});

// GET /api/projects/:id/export/docx
router.get("/:id/export/docx", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name, metadata FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  const buf = await generateDOCX(name, artifacts, effectiveMeta(projectRows[0], req.user!));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.docx"`);
  res.send(buf);
});

// GET /api/projects/:id/export/latex
router.get("/:id/export/latex", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name, metadata FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  const tex = generateLaTeX(name, artifacts, effectiveMeta(projectRows[0], req.user!));

  res.setHeader("Content-Type", "application/x-latex");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui.tex"`);
  res.send(tex);
});

// POST /api/projects/:id/export/latex-zip  (accepts { diagramSvgs? } in body)
// Returns an Overleaf-ready .zip: main.tex + figures/ with the rendered UML PNGs.
router.post("/:id/export/latex-zip", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const userId = req.user!.sub;
  const diagramSvgs: Record<string, string> | undefined = req.body?.diagramSvgs;

  const [projectRows, artifacts] = await Promise.all([
    sql`SELECT name, metadata FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL` as any,
    getArtifacts(id, userId),
  ]);

  if (!artifacts) { res.status(404).json({ error: "Project not found" }); return; }

  const name = projectRows[0]?.name ?? "Project";
  let buf: Buffer;
  try {
    buf = await generateLaTeXZip(name, artifacts, effectiveMeta(projectRows[0], req.user!), diagramSvgs);
  } catch (err) {
    console.error("[export/latex-zip]", err);
    res.status(500).json({ error: "Failed to build the LaTeX bundle." });
    return;
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^a-z0-9]/gi, "_")}_req2ui_latex.zip"`);
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
