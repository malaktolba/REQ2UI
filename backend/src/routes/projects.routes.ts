import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.use(requireAuth);

// Optional client/document context used to enrich the generated SRS (prose +
// title pages). Every field is optional — blanks are simply omitted downstream.
const metadataSchema = z.object({
  organization: z.string().max(200).optional(),
  industry: z.string().max(120).optional(),
  audience: z.string().max(400).optional(),
  author: z.string().max(200).optional(),
  contact_email: z.string().email().max(200).optional().or(z.literal("")),
  version: z.string().max(40).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  metadata: metadataSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  metadata: metadataSchema.optional(),
});

/** Drops empty/blank fields so `metadata` only ever stores meaningful values. */
function cleanMetadata(meta?: Record<string, unknown>): Record<string, string> {
  if (!meta) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

// POST /api/projects
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, description } = parsed.data;
  const userId = req.user!.sub;
  const metadata = cleanMetadata(parsed.data.metadata);

  const rows = await sql`
    INSERT INTO projects (user_id, name, description, metadata)
    VALUES (${userId}, ${name}, ${description}, ${JSON.stringify(metadata)})
    RETURNING id, name, description, metadata, status, created_at, updated_at
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
  // When `metadata` is sent the edit form submits the full field set, so we
  // replace stored metadata with the cleaned object (blank fields are dropped,
  // letting the user clear a value). Omit the param to leave metadata untouched.
  const metadata = parsed.data.metadata ? cleanMetadata(parsed.data.metadata) : null;

  const rows = await sql`
    UPDATE projects
    SET
      name = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      metadata = CASE WHEN ${metadata !== null}
                   THEN ${JSON.stringify(metadata ?? {})}::jsonb
                   ELSE metadata END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, description, metadata, status, created_at, updated_at
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
