import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import {
  evaluateProject,
  getLatestEvaluation,
  listEvaluations,
} from "../services/evaluation.service";

const router = Router();
router.use(requireAuth);

// Evaluation fires several LLM judge calls, so cap it like generation does.
const evalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Evaluation limit reached (20/hour). Please try again later." },
});

// POST /api/projects/:id/evaluate — run a fresh GEval evaluation (synchronous).
router.post("/:id/evaluate", evalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluation = await evaluateProject(req.params.id as string, req.user!.sub);
    res.status(201).json({ evaluation });
  } catch (err: any) {
    const msg = err?.message ?? "Evaluation failed";
    res.status(msg === "Project not found" ? 404 : 400).json({ error: msg });
  }
});

// GET /api/projects/:id/evaluation — latest stored evaluation (or null).
router.get("/:id/evaluation", async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluation = await getLatestEvaluation(req.params.id as string, req.user!.sub);
    res.json({ evaluation });
  } catch (err: any) {
    res.status(err?.message === "Project not found" ? 404 : 400).json({ error: err?.message ?? "Failed to load evaluation" });
  }
});

// GET /api/projects/:id/evaluations — full evaluation history (newest first).
router.get("/:id/evaluations", async (req: Request, res: Response): Promise<void> => {
  try {
    const evaluations = await listEvaluations(req.params.id as string, req.user!.sub);
    res.json({ evaluations });
  } catch (err: any) {
    res.status(err?.message === "Project not found" ? 404 : 400).json({ error: err?.message ?? "Failed to load history" });
  }
});

export default router;
