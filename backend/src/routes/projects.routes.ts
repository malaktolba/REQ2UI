import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
});

// POST /api/projects
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, description } = parsed.data;
  const userId = req.user!.sub;

  const rows = await sql`
    INSERT INTO projects (user_id, name, description)
    VALUES (${userId}, ${name}, ${description})
    RETURNING id, name, description, status, created_at, updated_at
  ` as any[];

  res.status(201).json({ project: rows[0] });
});

// GET /api/projects
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;

  const rows = await sql`
    SELECT
      p.id, p.name, p.description, p.status, p.created_at, p.updated_at,
      COUNT(a.id)::int AS artifact_count
    FROM projects p
    LEFT JOIN artifacts a ON a.project_id = p.id
    WHERE p.user_id = ${userId} AND p.deleted_at IS NULL
    GROUP BY p.id
    ORDER BY p.created_at DESC
  ` as any[];

  res.json({ projects: rows });
});

// GET /api/projects/:id
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const { id } = req.params;

  const rows = await sql`
    SELECT p.*, COUNT(a.id)::int AS artifact_count
    FROM projects p
    LEFT JOIN artifacts a ON a.project_id = p.id
    WHERE p.id = ${id} AND p.user_id = ${userId} AND p.deleted_at IS NULL
    GROUP BY p.id
  ` as any[];

  if (!rows.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Include pipeline stages if they exist
  const stages = await sql`
    SELECT stage, name, status, error, started_at, finished_at
    FROM pipeline_stages
    WHERE project_id = ${id}
    ORDER BY stage ASC
  ` as any[];

  res.json({ project: rows[0], stages });
});

// PUT /api/projects/:id
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const userId = req.user!.sub;
  const { id } = req.params;

  const existing = await sql`
    SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];

  if (!existing.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { name, description } = parsed.data;

  const rows = await sql`
    UPDATE projects
    SET
      name = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, description, status, created_at, updated_at
  ` as any[];

  res.json({ project: rows[0] });
});

// DELETE /api/projects/:id (soft delete)
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const { id } = req.params;

  const result = await sql`
    UPDATE projects
    SET deleted_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND deleted_at IS NULL
    RETURNING id
  ` as any[];

  if (!result.length) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ message: "Project deleted" });
});

export default router;
