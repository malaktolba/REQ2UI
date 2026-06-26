import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/admin.middleware";
import { getAdminStats } from "../services/admin.service";
import {
  getLatestEvaluationById,
  listEvaluationsById,
  evaluateProjectAdmin,
} from "../services/evaluation.service";

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/stats — platform-wide analytics for the admin dashboard.
router.get("/stats", async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getAdminStats();
    res.json({ stats });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load admin stats" });
  }
});

// GET /api/admin/projects/:id/evaluation — latest GEval report for any project.
router.get("/projects/:id/evaluation", async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluation = await getLatestEvaluationById(req.params.id as string);
    res.json({ evaluation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load evaluation" });
  }
});

// GET /api/admin/projects/:id/evaluations — full GEval history for any project.
router.get("/projects/:id/evaluations", async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluations = await listEvaluationsById(req.params.id as string);
    res.json({ evaluations });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load history" });
  }
});

// POST /api/admin/projects/:id/evaluate — run a fresh GEval on demand (admin).
router.post("/projects/:id/evaluate", async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluation = await evaluateProjectAdmin(req.params.id as string);
    res.status(201).json({ evaluation });
  } catch (err: any) {
    const msg = err?.message ?? "Evaluation failed";
    res.status(msg === "Project not found" ? 404 : 400).json({ error: msg });
  }
});

export default router;
