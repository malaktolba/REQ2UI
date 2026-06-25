import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";
import { runPipeline, regenerateUICode } from "../services/pipeline.service";
import { refineUI, RefinementScope } from "../services/refinement.service";
import { evaluateProject } from "../services/evaluation.service";

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
    SELECT id, name, description, status, metadata, ui_preferences FROM projects
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

  // Guard against running the full pipeline on input too thin to yield a real
  // SRS — only obvious non-input like "todo app". The Stage 2 floor check is the
  // real safety net; this just avoids burning API budget on clear garbage. Only
  // enforced on a never-run project, so it never blocks a resume/re-generate.
  // Emitted as an SSE error (not a 4xx) because the client is an EventSource,
  // which can't read a non-2xx response body.
  const wordCount = (project.description ?? "").trim().split(/\s+/).filter(Boolean).length;
  if (project.status === "pending" && wordCount < 6) {
    send("error", {
      error:
        "Project description is too short to generate from. Add a sentence or two " +
        "about the system, its users, and what it should do, then try again.",
    });
    res.end();
    return;
  }

  try {
    await runPipeline(
      project.id,
      project.name,
      project.description,
      (stageEvent) => send("stage", stageEvent),
      // A completed project means the user explicitly clicked "Re-generate" —
      // redo every stage. Any other status (pending/failed/interrupted) resumes,
      // skipping stages whose artifacts already exist.
      {
        force: project.status === "completed",
        metadata: project.metadata ?? undefined,
        uiPreferences: project.ui_preferences ?? undefined,
      }
    );

    // GEval quality evaluation runs after generation as an independent step.
    // It must NEVER block or fail the pipeline result — any error here is caught
    // and reported as an evaluation event, while "done" still fires normally.
    try {
      send("evaluation", { status: "running" });
      const evaluation = await evaluateProject(project.id, userId);
      send("evaluation", { status: "completed", evaluation });
    } catch (evalErr: any) {
      send("evaluation", { status: "failed", error: evalErr?.message ?? "Evaluation failed" });
    }

    send("done", { message: "Pipeline complete" });
  } catch (err: any) {
    send("error", { error: err?.message ?? "Pipeline failed" });
  } finally {
    res.end();
  }
});

// GET /api/projects/:id/generate/ui-code  (SSE — re-runs Stage 10 only)
router.get("/:id/generate/ui-code", requireAuth, genLimiter, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await regenerateUICode(req.params.id as string, req.user!.sub, (ev) => send("stage", ev));
    send("done", { message: "UI code generation complete" });
  } catch (err: any) {
    send("error", { error: err?.message ?? "Generation failed" });
  } finally {
    res.end();
  }
});

// GET /api/projects/:id/refine  (SSE — targeted AI UI refinement, stages a preview)
// prompt/scope/screens arrive as query params because EventSource can only GET.
router.get("/:id/refine", requireAuth, genLimiter, async (req: Request, res: Response): Promise<void> => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const prompt = String(req.query.prompt ?? "");
  const scope = String(req.query.scope ?? "page") as RefinementScope;
  const screensParam = String(req.query.screens ?? "");
  const screenIds = screensParam ? screensParam.split(",").filter(Boolean) : [];

  try {
    const result = await refineUI(
      req.params.id as string,
      req.user!.sub,
      { prompt, scope, screenIds },
      (ev) => send("stage", ev)
    );
    send("result", result);
    send("done", { message: "Refinement ready to preview" });
  } catch (err: any) {
    send("error", { error: err?.message ?? "Refinement failed" });
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
