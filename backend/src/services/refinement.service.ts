import { sql } from "../db/client";
import { callGeminiText } from "./gemini.service";
import { callGroq, GROQ_LIGHT } from "./groq.service";
import { UIPreferences, uiPreferencesPromptBlock } from "../config/uiPreferences";

/**
 * AI-powered UI refinement — targeted, post-generation edits to the `ui_code`
 * artifact. Instead of re-running Stage 10, we send each affected screen's
 * existing HTML plus the user's natural-language change request to Gemini and
 * get back the full updated document, preserving everything unrelated. The
 * result is staged as a non-committed preview (`ui_code_pending`) so the user
 * can Apply / Discard. Committed states are snapshotted into `ui_revisions`
 * for undo/restore.
 */

export type RefinementScope = "page" | "pages" | "design_system";

export interface RefineRequest {
  prompt: string;
  scope: RefinementScope;
  screenIds?: string[];
}

export interface RefineEvent {
  status: "running" | "completed" | "failed";
  detail?: string;
  error?: string;
  progress?: { current: number; total: number };
}

type Emit = (event: RefineEvent) => void;

// Shape of a committed UI-code artifact (from the Stage 10 multipass).
interface UICode {
  design_system?: { navbar?: string; footer?: string; body_classes?: string };
  screens: Array<{ id: string; name: string; route?: string; description?: string; html: string }>;
}

// ── Small data helpers ────────────────────────────────────────────────────────

/** Verifies the project belongs to the user and returns name + ui_preferences. */
async function loadProject(projectId: string, userId: string): Promise<{ name: string; ui_preferences?: UIPreferences }> {
  const rows = await sql`
    SELECT name, ui_preferences FROM projects
    WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];
  if (!rows.length) throw new Error("Project not found");
  return { name: rows[0].name, ui_preferences: rows[0].ui_preferences ?? undefined };
}

/** Map of artifact type → content for the project. */
async function loadArtifacts(projectId: string): Promise<Record<string, any>> {
  const rows = await sql`SELECT type, content FROM artifacts WHERE project_id = ${projectId}` as any[];
  return Object.fromEntries(rows.map((a: any) => [a.type, a.content]));
}

async function upsertArtifact(projectId: string, type: string, content: any): Promise<void> {
  await sql`
    INSERT INTO artifacts (project_id, type, content)
    VALUES (${projectId}, ${type}, ${JSON.stringify(content)})
    ON CONFLICT (project_id, type) DO UPDATE SET
      content = EXCLUDED.content,
      version = artifacts.version + 1,
      updated_at = NOW()
  `;
}

async function deleteArtifact(projectId: string, type: string): Promise<void> {
  await sql`DELETE FROM artifacts WHERE project_id = ${projectId} AND type = ${type}`;
}

/** Recent refinement labels (newest first) — fed to the model as change history. */
async function recentRevisionLabels(projectId: string, limit = 5): Promise<string[]> {
  const rows = await sql`
    SELECT label FROM ui_revisions WHERE project_id = ${projectId}
    ORDER BY version DESC LIMIT ${limit}
  ` as any[];
  return rows.map((r: any) => r.label);
}

// ── Prompt context helpers ────────────────────────────────────────────────────

/** Functional requirements likely relevant to a screen (mirrors Stage 10 matching). */
function relevantFRs(screen: any, frs: any[]): string[] {
  return (frs ?? [])
    .filter((r: any) =>
      screen.components?.some((c: any) =>
        r.title?.toLowerCase().split(" ").some((w: string) =>
          c.label?.toLowerCase().includes(w) || c.purpose?.toLowerCase().includes(w)
        )
      )
    )
    .slice(0, 4)
    .map((r: any) => `${r.id}: ${r.title}`);
}

// ── Core: refine ──────────────────────────────────────────────────────────────

/**
 * Applies a targeted edit to the affected screens and stages the result as a
 * non-committed `ui_code_pending` artifact. Returns the change summary and the
 * ids of the screens that were re-rendered.
 */
export async function refineUI(
  projectId: string,
  userId: string,
  req: RefineRequest,
  emit: Emit
): Promise<{ summary: string[]; screensChanged: string[] }> {
  const prompt = (req.prompt ?? "").trim();
  if (!prompt) throw new Error("Describe the change you want to make.");

  const project = await loadProject(projectId, userId);
  const artifacts = await loadArtifacts(projectId);
  const uiCode: UICode | undefined = artifacts.ui_code;
  if (!uiCode || !Array.isArray(uiCode.screens) || !uiCode.screens.length) {
    throw new Error("Generate the UI code first, then refine it.");
  }

  // Resolve which screens this change targets.
  let targets: UICode["screens"];
  if (req.scope === "design_system") {
    targets = uiCode.screens;
  } else {
    const wanted = new Set(req.screenIds ?? []);
    targets = uiCode.screens.filter((s) => wanted.has(s.id));
    if (!targets.length) throw new Error("Select at least one page to change.");
  }

  const ext = artifacts.extraction ?? {};
  const frs = artifacts.functional_requirements?.requirements ?? [];
  const wireScreens = artifacts.wireframes?.screens ?? [];
  const prefsBlock = uiPreferencesPromptBlock(project.ui_preferences);
  const history = await recentRevisionLabels(projectId);
  const historyBlock = history.length
    ? `\n\nPrior changes already applied (for continuity, do not undo them):\n${history.map((h) => `- ${h}`).join("\n")}`
    : "";

  const scopeNote =
    req.scope === "design_system"
      ? "This is a GLOBAL design-system change: apply it consistently to this page as you would to every other page (navbar, footer, shared components, colours, spacing)."
      : "This change targets THIS page only. Keep the shared navbar/footer and global styling consistent with the rest of the app.";

  const total = targets.length;
  emit({ status: "running", detail: "Analysing change…", progress: { current: 0, total } });

  // Re-render each targeted screen with Gemini. Batches of 3 mirror Stage 10 and
  // keep the per-screen calls flowing through the shared Gemini throttle.
  const edited = new Map<string, string>();
  let done = 0;
  const BATCH = 3;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (sc) => {
        const wire = wireScreens.find((w: any) => w.id === sc.id);
        const frLines = wire ? relevantFRs(wire, frs) : [];
        const updated = await callGeminiText(
          `You are an expert frontend developer editing an EXISTING HTML page. You will be given the
current COMPLETE HTML document and a change request. Apply ONLY the requested change.

STRICT RULES:
1. Output ONLY the complete, updated HTML document — no markdown, no explanation, no code fences.
2. Preserve EVERYTHING not mentioned by the request: the navbar, footer, unrelated <head> content
   (Tailwind CDN + <style> blocks), existing realistic data, and all unrelated markup. EXCEPTION:
   if the request is about colour/branding/theme, DO change the accent — update the \`brand\` colour
   in the Tailwind config script (theme.extend.colors.brand) and/or the relevant \`brand-*\`/neutral
   classes — so the new colour actually takes effect.
3. Keep it mobile-responsive (Tailwind sm:/md:/lg: prefixes) and keep existing hover/focus states
   and JavaScript interactions working.
4. Do not introduce broken links — keep existing href values.
5. ${scopeNote}${prefsBlock}${historyBlock}`,
          `Page: ${sc.name}${sc.route ? ` (${sc.route})` : ""}
Project: ${project.name}
System: ${ext.system_summary ?? ""}
${frLines.length ? `Related functional requirements:\n${frLines.join("\n")}\n` : ""}
CHANGE REQUEST: ${prompt}

CURRENT HTML:
${sc.html}`
        );
        edited.set(sc.id, updated);
        done++;
        emit({ status: "running", detail: `Updated ${sc.name}`, progress: { current: done, total } });
      })
    );
  }

  // Merge edits back into the full ui_code shape.
  const nextScreens = uiCode.screens.map((s) =>
    edited.has(s.id) ? { ...s, html: edited.get(s.id)! } : s
  );

  // Cheap, request-derived change summary (avoids expensive HTML diffing).
  const summary = await summarizeChange(prompt, req.scope, targets.map((s) => s.name));

  const pending = {
    design_system: uiCode.design_system,
    screens: nextScreens,
    __refinement: {
      prompt,
      scope: req.scope,
      summary,
      screensChanged: targets.map((s) => s.id),
      created_at: new Date().toISOString(),
    },
  };
  await upsertArtifact(projectId, "ui_code_pending", pending);

  emit({ status: "completed", progress: { current: total, total } });
  return { summary, screensChanged: targets.map((s) => s.id) };
}

/** Turns the request into 2–4 checklist bullets for the change preview. */
async function summarizeChange(prompt: string, scope: RefinementScope, screenNames: string[]): Promise<string[]> {
  const scopeLabel =
    scope === "design_system" ? "the entire design system (all pages)" : `these pages: ${screenNames.join(", ")}`;
  try {
    const res = await callGroq(
      `You summarise a UI change request into a short checklist of concrete changes the developer
will see. Return JSON: { "changes": ["short past-tense item", ...] } with 2-4 items. Each item is a
brief phrase (no trailing period), describing a specific visible change.`,
      `Scope: ${scopeLabel}\nChange request: ${prompt}`,
      600,
      GROQ_LIGHT
    );
    const changes = Array.isArray(res?.changes) ? res.changes.filter((c: any) => typeof c === "string") : [];
    if (changes.length) return changes.slice(0, 4);
  } catch {
    /* fall through to a generic summary if the light model is unavailable */
  }
  return [`Applied "${prompt}" to ${scope === "design_system" ? "all pages" : screenNames.join(", ")}`];
}

// ── Apply / discard ───────────────────────────────────────────────────────────

/** Next version number for this project's revision history. */
async function nextRevisionVersion(projectId: string): Promise<number> {
  const rows = await sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next FROM ui_revisions WHERE project_id = ${projectId}
  ` as any[];
  return rows[0].next as number;
}

async function snapshotCurrent(projectId: string, content: any, label: string, scope: string): Promise<void> {
  const version = await nextRevisionVersion(projectId);
  await sql`
    INSERT INTO ui_revisions (project_id, version, content, label, scope)
    VALUES (${projectId}, ${version}, ${JSON.stringify(content)}, ${label}, ${scope})
  `;
}

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Commits the staged preview: archives the current state, then promotes pending. */
export async function applyRefinement(projectId: string, userId: string): Promise<void> {
  await loadProject(projectId, userId);
  const artifacts = await loadArtifacts(projectId);
  const pending = artifacts.ui_code_pending;
  if (!pending) throw new Error("No pending changes to apply.");
  const current = artifacts.ui_code;

  if (current) {
    const isFirst = (await nextRevisionVersion(projectId)) === 1;
    const meta = pending.__refinement ?? {};
    const label = isFirst ? "Initial generation" : `Before "${truncate(meta.prompt ?? "change")}"`;
    await snapshotCurrent(projectId, current, label, isFirst ? "initial" : meta.scope ?? "page");
  }

  const { __refinement, ...committed } = pending;
  await upsertArtifact(projectId, "ui_code", committed);
  await deleteArtifact(projectId, "ui_code_pending");
}

/** Drops the staged preview without committing it. */
export async function discardRefinement(projectId: string, userId: string): Promise<void> {
  await loadProject(projectId, userId);
  await deleteArtifact(projectId, "ui_code_pending");
}

// ── Version history ───────────────────────────────────────────────────────────

export interface UIRevisionMeta {
  version: number;
  label: string;
  scope: string | null;
  created_at: string;
}

export async function listRevisions(projectId: string, userId: string): Promise<UIRevisionMeta[]> {
  await loadProject(projectId, userId);
  const rows = await sql`
    SELECT version, label, scope, created_at FROM ui_revisions
    WHERE project_id = ${projectId} ORDER BY version DESC
  ` as any[];
  return rows as UIRevisionMeta[];
}

/** Restores a past UI state. The current state is archived first, so it's undoable. */
export async function restoreRevision(projectId: string, userId: string, version: number): Promise<void> {
  await loadProject(projectId, userId);
  const rows = await sql`
    SELECT content FROM ui_revisions WHERE project_id = ${projectId} AND version = ${version}
  ` as any[];
  if (!rows.length) throw new Error("Revision not found.");

  const artifacts = await loadArtifacts(projectId);
  if (artifacts.ui_code) {
    await snapshotCurrent(projectId, artifacts.ui_code, `Before restore to v${version}`, "restore");
  }
  await upsertArtifact(projectId, "ui_code", rows[0].content);
  // A staged preview is stale once the base UI changes — drop it.
  await deleteArtifact(projectId, "ui_code_pending");
}

// ── AI suggested improvements ─────────────────────────────────────────────────

export async function suggestImprovements(projectId: string, userId: string): Promise<string[]> {
  await loadProject(projectId, userId);
  const artifacts = await loadArtifacts(projectId);
  const uiCode: UICode | undefined = artifacts.ui_code;
  if (!uiCode?.screens?.length) throw new Error("Generate the UI code first.");

  const screenList = uiCode.screens
    .map((s) => `- ${s.name}${s.route ? ` (${s.route})` : ""}${s.description ? `: ${s.description}` : ""}`)
    .join("\n");

  const res = await callGroq(
    `You are a senior UX & accessibility reviewer. Given the screens of a generated web app, propose
concrete, actionable UI improvements (empty states, spacing, missing components, accessibility,
responsive behaviour). Return JSON: { "suggestions": ["actionable phrasing the user could submit as
a change request", ...] } with 3-6 items. Each suggestion must be a single imperative instruction
(e.g. "Add an empty state to the dashboard when there is no data").`,
    `Project: ${artifacts.extraction?.system_summary ?? ""}\nScreens:\n${screenList}`,
    800,
    GROQ_LIGHT
  );
  const out = Array.isArray(res?.suggestions) ? res.suggestions.filter((s: any) => typeof s === "string") : [];
  return out.slice(0, 6);
}
