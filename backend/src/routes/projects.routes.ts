import { Router, Request, Response } from "express";
import { z } from "zod";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth.middleware";
import { UI_PREFERENCE_OPTIONS } from "../config/uiPreferences";
import {
  applyRefinement,
  discardRefinement,
  listRevisions,
  restoreRevision,
  suggestImprovements,
} from "../services/refinement.service";

const router = Router();
router.use(requireAuth);

// Optional UI design preferences captured before generation. Enum fields are
// constrained to the configured option lists; free-form fields are length-
// capped. Every field optional — blanks are dropped before storage.
const uiPreferencesSchema = z.object({
  theme: z.enum(UI_PREFERENCE_OPTIONS.theme).optional(),
  color_mode: z.enum(UI_PREFERENCE_OPTIONS.color_mode).optional(),
  primary_color: z.string().max(40).optional(),
  layout_density: z.enum(UI_PREFERENCE_OPTIONS.layout_density).optional(),
  navigation: z.enum(UI_PREFERENCE_OPTIONS.navigation).optional(),
  content_style: z.enum(UI_PREFERENCE_OPTIONS.content_style).optional(),
  button_style: z.enum(UI_PREFERENCE_OPTIONS.button_style).optional(),
  card_style: z.enum(UI_PREFERENCE_OPTIONS.card_style).optional(),
  animations: z.enum(UI_PREFERENCE_OPTIONS.animations).optional(),
  custom_instructions: z.string().max(2000).optional(),
});

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
  ui_preferences: uiPreferencesSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000).optional(),
  metadata: metadataSchema.optional(),
  ui_preferences: uiPreferencesSchema.optional(),
});

/** Drops empty/blank fields so a JSONB column only ever stores real values. */
function cleanObject(obj?: Record<string, unknown>): Record<string, string> {
  if (!obj) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

const cleanMetadata = cleanObject;
const cleanUIPreferences = cleanObject;

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
  const uiPreferences = cleanUIPreferences(parsed.data.ui_preferences);

  const rows = await sql`
    INSERT INTO projects (user_id, name, description, metadata, ui_preferences)
    VALUES (${userId}, ${name}, ${description}, ${JSON.stringify(metadata)}, ${JSON.stringify(uiPreferences)})
    RETURNING id, name, description, metadata, ui_preferences, status, created_at, updated_at
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
  // When `metadata` / `ui_preferences` is sent the form submits the full field
  // set, so we replace the stored object with the cleaned one (blank fields are
  // dropped, letting the user clear a value). Omit the param to leave it as-is.
  const metadata = parsed.data.metadata ? cleanMetadata(parsed.data.metadata) : null;
  const uiPreferences = parsed.data.ui_preferences ? cleanUIPreferences(parsed.data.ui_preferences) : null;

  const rows = await sql`
    UPDATE projects
    SET
      name = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      metadata = CASE WHEN ${metadata !== null}
                   THEN ${JSON.stringify(metadata ?? {})}::jsonb
                   ELSE metadata END,
      ui_preferences = CASE WHEN ${uiPreferences !== null}
                   THEN ${JSON.stringify(uiPreferences ?? {})}::jsonb
                   ELSE ui_preferences END,
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, name, description, metadata, ui_preferences, status, created_at, updated_at
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

// ── AI UI Refinement: apply / discard a staged preview, history, suggestions ──

// POST /api/projects/:id/ui-code/apply — commit the staged refinement preview.
router.post("/:id/ui-code/apply", async (req: Request, res: Response): Promise<void> => {
  try {
    await applyRefinement(req.params.id as string, req.user!.sub);
    res.json({ message: "Changes applied" });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to apply changes" });
  }
});

// POST /api/projects/:id/ui-code/discard — drop the staged refinement preview.
router.post("/:id/ui-code/discard", async (req: Request, res: Response): Promise<void> => {
  try {
    await discardRefinement(req.params.id as string, req.user!.sub);
    res.json({ message: "Changes discarded" });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to discard changes" });
  }
});

// GET /api/projects/:id/ui-code/revisions — version history.
router.get("/:id/ui-code/revisions", async (req: Request, res: Response): Promise<void> => {
  try {
    const revisions = await listRevisions(req.params.id as string, req.user!.sub);
    res.json({ revisions });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to load history" });
  }
});

// POST /api/projects/:id/ui-code/revisions/:version/restore — restore a past state.
router.post("/:id/ui-code/revisions/:version/restore", async (req: Request, res: Response): Promise<void> => {
  const version = parseInt(req.params.version as string, 10);
  if (!Number.isFinite(version)) {
    res.status(400).json({ error: "Invalid revision" });
    return;
  }
  try {
    await restoreRevision(req.params.id as string, req.user!.sub, version);
    res.json({ message: "Revision restored" });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to restore revision" });
  }
});

// GET /api/projects/:id/ui-code/suggestions — AI-suggested improvements.
router.get("/:id/ui-code/suggestions", async (req: Request, res: Response): Promise<void> => {
  try {
    const suggestions = await suggestImprovements(req.params.id as string, req.user!.sub);
    res.json({ suggestions });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Failed to load suggestions" });
  }
});

export default router;
