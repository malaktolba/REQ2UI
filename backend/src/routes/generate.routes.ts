import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";
import { runPipeline } from "../services/pipeline.service";

const router = Router();

const genLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Generation limit reached (10/hour). Please try again later." },
});

// GET /api/projects/:id/generate  (SSE)
router.get("/:id/generate", requireAuth, genLimiter, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const { id } = req.params;

  const rows = await sql`
    SELECT id, name, description, status FROM projects
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];

  if (!rows.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const project = rows[0];

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await runPipeline(
      project.id,
      project.name,
      project.description,
      (stageEvent) => send("stage", stageEvent)
    );
    send("done", { message: "Pipeline complete" });
  } catch (err: any) {
    send("error", { error: err?.message ?? "Pipeline failed" });
  } finally {
    res.end();
  }
});

// GET /api/projects/:id/artifacts
router.get("/:id/artifacts", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const { id } = req.params;

  const projectRows = await sql`
    SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];

  if (!projectRows.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const artifacts = await sql`
    SELECT type, content, version, updated_at FROM artifacts WHERE project_id = ${id}
  ` as any[];

  res.json({ artifacts });
});

// GET /api/projects/:id/artifacts/:type
router.get("/:id/artifacts/:type", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const { id, type } = req.params;

  const projectRows = await sql`
    SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];

  if (!projectRows.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const rows = await sql`
    SELECT type, content, version, updated_at FROM artifacts
    WHERE project_id = ${id} AND type = ${type}
  ` as any[];

  if (!rows.length) {
    res.status(404).json({ error: "Artifact not found" });
    return;
  }

  res.json({ artifact: rows[0] });
});

export default router;
