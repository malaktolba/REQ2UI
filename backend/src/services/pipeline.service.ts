import { sql } from "../db/client";
import { callGroq, GROQ_HEAVY, GROQ_LIGHT } from "./groq.service";
import { callGeminiJSON, callGeminiText } from "./gemini.service";
import { UIPreferences, uiPreferencesPromptBlock } from "../config/uiPreferences";

export interface StageEvent {
  stage: number;
  name: string;
  status: "running" | "completed" | "failed";
  error?: string;
  // Sub-progress for long stages (currently Stage 10 UI generation): a human
  // detail line and a current/total counter the frontend renders under the row.
  detail?: string;
  progress?: { current: number; total: number };
}

type Emit = (event: StageEvent) => void;

// Optional client/document context captured before generation. Used to enrich
// the SRS prose (Stage 1 front-matter) and the exported title pages.
export interface ProjectMetadata {
  organization?: string;
  industry?: string;
  audience?: string;
  author?: string;
  contact_email?: string;
  version?: string;
}

// Renders the metadata as a prompt block for Stage 1. Only the fields that
// actually inform the requirements (organization, industry, audience) are
// included — author/contact/version are document-control data, not content.
function metadataContextBlock(meta?: ProjectMetadata): string {
  if (!meta) return "";
  const lines: string[] = [];
  if (meta.organization) lines.push(`Commissioning organization: ${meta.organization}`);
  if (meta.industry) lines.push(`Industry / domain: ${meta.industry}`);
  if (meta.audience) lines.push(`Target users / audience: ${meta.audience}`);
  if (!lines.length) return "";
  return (
    `\n\nClient & domain context (weave this naturally into the product perspective, ` +
    `scope, assumptions, and actors — do NOT invent facts beyond it):\n` +
    lines.join("\n")
  );
}

const STAGE_NAMES = [
  "Requirement Extraction",
  "Functional Requirements (IEEE 830)",
  "Non-Functional Requirements",
  "Security Requirements (OWASP)",
  "Functional Test Cases (IEEE 829)",
  "Security Test Cases",
  "UI Wireframe Descriptions",
  "Traceability Matrix",
  "UML Diagrams",
  "UI Code Generation",
];

// Per-stage output ceilings (max_tokens), indexed by stage number - 1.
// Lighter structured stages get tighter caps for runaway protection; the
// content-heavy stages (functional reqs, test cases, wireframes) keep headroom.
const STAGE_MAX_TOKENS = [
  5000, // 1  Requirement Extraction + SRS narrative front-matter
  6000, // 2  Functional Requirements
  3000, // 3  Non-Functional Requirements
  4000, // 4  Security Requirements
  8000, // 5  Functional Test Cases (2+ per FR — largest JSON stage)
  4000, // 6  Security Test Cases
  6000, // 7  UI Wireframe Descriptions
  4000, // 8  Traceability Matrix
  4000, // 9  UML Diagrams
];

// Preferred model per stage (indexed by stage number - 1). Easier, highly
// structured/derivative stages run on the lighter model — which has far more
// generous rate limits — to conserve the heavy model's scarce daily quota for
// the stages that genuinely need its reasoning (prose, foundations, UML syntax).
// The Groq client still falls back across model tiers if one is rate-limited.
const STAGE_MODEL = [
  GROQ_HEAVY, // 1  Requirement Extraction + SRS narrative (prose quality)
  GROQ_HEAVY, // 2  Functional Requirements (everything downstream derives from it)
  GROQ_LIGHT, // 3  Non-Functional Requirements (structured/templated)
  GROQ_LIGHT, // 4  Security Requirements (mapped to known OWASP categories)
  GROQ_HEAVY, // 5  Functional Test Cases (largest JSON stage — quality/validity matters)
  GROQ_LIGHT, // 6  Security Test Cases (derivative from SRs)
  GROQ_HEAVY, // 7  UI Wireframe Descriptions (creative; feeds UI generation)
  GROQ_LIGHT, // 8  Traceability Matrix (pure linking/lookup — easiest)
  GROQ_HEAVY, // 9  UML Diagrams (strict Mermaid syntax; weak models break it)
];

async function upsertStage(
  projectId: string,
  stage: number,
  status: string,
  error?: string
) {
  const name = STAGE_NAMES[stage - 1];
  const startedAt = status === "running" ? new Date() : null;
  const finishedAt = status === "completed" || status === "failed" ? new Date() : null;

  await sql`
    INSERT INTO pipeline_stages (project_id, stage, name, status, error, started_at, finished_at)
    VALUES (${projectId}, ${stage}, ${name}, ${status}, ${error ?? null}, ${startedAt}, ${finishedAt})
    ON CONFLICT (project_id, stage) DO UPDATE SET
      status = EXCLUDED.status,
      error = EXCLUDED.error,
      started_at = COALESCE(pipeline_stages.started_at, EXCLUDED.started_at),
      finished_at = EXCLUDED.finished_at
  `;
}

async function upsertArtifact(projectId: string, type: string, content: any) {
  await sql`
    INSERT INTO artifacts (project_id, type, content)
    VALUES (${projectId}, ${type}, ${JSON.stringify(content)})
    ON CONFLICT (project_id, type) DO UPDATE SET
      content = EXCLUDED.content,
      version = artifacts.version + 1,
      updated_at = NOW()
  `;
}

async function runStage<T>(
  projectId: string,
  stageNum: number,
  artifactType: string,
  system: string,
  user: string,
  emit: Emit,
  maxTokens?: number,
  transform?: (raw: any) => any
): Promise<T> {
  const name = STAGE_NAMES[stageNum - 1];
  const cap = maxTokens ?? STAGE_MAX_TOKENS[stageNum - 1] ?? 8000;
  const model = STAGE_MODEL[stageNum - 1] ?? GROQ_HEAVY;
  emit({ stage: stageNum, name, status: "running" });
  await upsertStage(projectId, stageNum, "running");

  try {
    const raw = await callGroq(system, user, cap, model);
    const result = transform ? transform(raw) : raw;
    await upsertArtifact(projectId, artifactType, result);
    await upsertStage(projectId, stageNum, "completed");
    emit({ stage: stageNum, name, status: "completed" });
    return result as T;
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    await upsertStage(projectId, stageNum, "failed", msg);
    emit({ stage: stageNum, name, status: "failed", error: msg });
    throw err;
  }
}

/** Map of artifact type → content for stages already persisted for this project. */
async function loadCompletedArtifacts(projectId: string): Promise<Record<string, any>> {
  const rows = await sql`
    SELECT type, content FROM artifacts WHERE project_id = ${projectId}
  ` as any[];
  return Object.fromEntries(rows.map((a: any) => [a.type, a.content]));
}

/**
 * Runs a stage, or returns its cached artifact when one already exists (resume).
 * On a cache hit we still mark the stage completed and emit so the UI fills in,
 * but we skip the LLM call entirely — letting an interrupted run pick up where
 * it stopped instead of paying for every stage again.
 */
async function stageOrCached<T>(
  cache: Record<string, any>,
  projectId: string,
  stageNum: number,
  artifactType: string,
  system: string,
  user: string,
  emit: Emit,
  maxTokens?: number,
  transform?: (raw: any) => any
): Promise<T> {
  if (cache[artifactType] !== undefined && cache[artifactType] !== null) {
    const name = STAGE_NAMES[stageNum - 1];
    await upsertStage(projectId, stageNum, "completed");
    emit({ stage: stageNum, name, status: "completed" });
    return cache[artifactType] as T;
  }
  return runStage<T>(projectId, stageNum, artifactType, system, user, emit, maxTokens, transform);
}

/** Strips code fences / stray whitespace that break Mermaid rendering. */
export function sanitizeMermaid(code: unknown): unknown {
  if (typeof code !== "string") return code;
  return code
    .replace(/^\s*```(?:mermaid)?\s*/i, "") // leading ```mermaid fence
    .replace(/```\s*$/i, "")                // trailing fence
    .replace(/[ \t]+$/gm, "")               // trailing whitespace per line
    .trim();
}

/** Post-processes the UML stage output, cleaning each diagram's Mermaid source. */
function sanitizeUmlArtifact(raw: any): any {
  if (Array.isArray(raw?.diagrams)) {
    for (const d of raw.diagrams) {
      if (d && typeof d.mermaid === "string") d.mermaid = sanitizeMermaid(d.mermaid);
    }
  }
  return raw;
}

// Coarse category for a wireframe screen, used to avoid spending UI-generation
// slots on near-duplicate pages (e.g. Login vs Register both render the same way).
export function screenCategory(sc: any): string {
  const hay = `${sc.name ?? ""} ${sc.route ?? ""} ${sc.description ?? ""}`.toLowerCase();
  const rules: [string, RegExp][] = [
    ["auth", /\b(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|register|registration|forgot|reset|password|authenticate)\b/],
    ["dashboard", /\b(dashboard|overview|analytics|summary|home page|homepage)\b/],
    ["settings", /\b(settings|preferences|configuration)\b/],
    ["profile", /\b(profile|my account|account page)\b/],
    ["create", /\b(create|add new|new |compose|edit|update form|\bform\b)\b/],
    ["list", /\b(list|manage|browse|catalog|inbox|all [a-z]+s\b)\b/],
    ["report", /\b(report|statistics|metrics|insights)\b/],
  ];
  for (const [cat, re] of rules) if (re.test(hay)) return cat;
  return `__${sc.id ?? sc.name}`; // uncategorized → treated as distinct
}

/** Picks up to `limit` functionally distinct screens, then backfills to reach `limit`. */
export function selectDistinctScreens(screens: any[], limit: number): any[] {
  const seen = new Set<string>();
  const picked: any[] = [];
  const leftovers: any[] = [];
  for (const sc of screens) {
    const cat = screenCategory(sc);
    if (seen.has(cat)) {
      leftovers.push(sc);
    } else {
      seen.add(cat);
      picked.push(sc);
      if (picked.length === limit) return picked;
    }
  }
  for (const sc of leftovers) {
    if (picked.length === limit) break;
    picked.push(sc);
  }
  return picked.slice(0, limit);
}

// ── Stage 10 helpers: deterministic accent palette + output validation ──────

/** Parse a #rrggbb / #rgb hex into RGB; null if unparseable. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

/** Mix a colour toward a target (white/black) by ratio 0..1, returns #rrggbb. */
function mix(c: { r: number; g: number; b: number }, t: { r: number; g: number; b: number }, ratio: number): string {
  return `#${toHex(c.r + (t.r - c.r) * ratio)}${toHex(c.g + (t.g - c.g) * ratio)}${toHex(c.b + (t.b - c.b) * ratio)}`;
}

// Standard Tailwind indigo scale — the default brand accent when the user
// hasn't picked a custom colour.
const DEFAULT_INDIGO: Record<string, string> = {
  "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc", "400": "#818cf8",
  "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca", "800": "#3730a3", "900": "#312e81",
};

/** Build a full 50–900 scale from a single base hex (base sits at 500). */
export function buildAccentScale(baseHex: string): Record<string, string> {
  const base = hexToRgb(baseHex);
  if (!base) return DEFAULT_INDIGO;
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  return {
    "50": mix(base, white, 0.92), "100": mix(base, white, 0.84), "200": mix(base, white, 0.68),
    "300": mix(base, white, 0.48), "400": mix(base, white, 0.26),
    "500": `#${toHex(base.r)}${toHex(base.g)}${toHex(base.b)}`,
    "600": mix(base, black, 0.12), "700": mix(base, black, 0.26), "800": mix(base, black, 0.40), "900": mix(base, black, 0.52),
  };
}

/**
 * The brand accent is always emitted as Tailwind's `indigo-*` utilities so the
 * preview's instant-recolor (which remaps `indigo`) keeps working. When the user
 * picked a custom primary colour we *redefine* the indigo scale to that colour
 * via the Play-CDN config, so `indigo-600` literally renders as their colour.
 * Code owns this script (not the LLM) for deterministic, always-valid output.
 */
export function accentConfigScript(prefs?: UIPreferences): string {
  const custom = prefs?.color_mode === "custom" ? prefs.primary_color?.trim() : "";
  const scale = custom ? buildAccentScale(custom) : DEFAULT_INDIGO;
  return `<script>tailwind.config={theme:{extend:{colors:{indigo:${JSON.stringify(scale)}}}}}</script>`;
}

/**
 * Heuristic "did the model return a usable, complete page?" check — guards
 * against silent truncation at the maxOutputTokens ceiling.
 */
export function htmlLooksComplete(html: string): boolean {
  if (!html || html.length < 400) return false;
  const lower = html.toLowerCase();
  if (!lower.includes("</body>") && !lower.includes("</html>")) return false;
  // Crude balance check: a truncated doc usually has far more "<" than ">".
  const open = (html.match(/</g) ?? []).length;
  const close = (html.match(/>/g) ?? []).length;
  return close >= open - 2;
}

async function generateUICodeMultipass(
  projectId: string,
  projectName: string,
  s1: any,
  s2: any,
  s7: any,
  emit: Emit,
  cached?: any,
  uiPreferences?: UIPreferences
): Promise<void> {
  const stageName = STAGE_NAMES[9];

  // Resume: if UI code already exists, fill the stage in without re-calling Gemini.
  if (cached !== undefined && cached !== null) {
    await upsertStage(projectId, 10, "completed");
    emit({ stage: 10, name: stageName, status: "completed" });
    return;
  }

  // Optional, user-supplied design constraints. Empty when the user opted out,
  // in which case the prompts keep their existing default-design behaviour.
  const prefsBlock = uiPreferencesPromptBlock(uiPreferences);

  const screens = selectDistinctScreens(s7.screens ?? [], 6);
  const total = screens.length;

  emit({ stage: 10, name: stageName, status: "running", detail: "Designing the UI system…", progress: { current: 0, total } });
  await upsertStage(projectId, 10, "running");

  try {
    const routeMap = screens
      .map((sc: any) => `${sc.name}: ${sc.route ?? "/" + sc.id.toLowerCase()}`)
      .join(" | ");

    // The brand accent is owned by code (deterministic, valid) — when the user
    // picked a custom primary colour it redefines Tailwind's `indigo` scale.
    const accentScript = accentConfigScript(uiPreferences);

    // ── Pass 1: Design system — navbar, footer, plus a reusable component
    //    class kit + shared sample data so every screen stays consistent. ────
    const designSystem = await callGeminiJSON(
      `You are a senior UI designer. Create a cohesive HTML design system + reusable component class kit for a web app.
Return a JSON object with exactly this shape:
{
  "navbar": "<full navbar HTML using Tailwind classes>",
  "footer": "<footer HTML using Tailwind classes>",
  "body_classes": "bg-slate-950 text-slate-100 min-h-screen flex flex-col",
  "components": {
    "button_primary": "<exact Tailwind class string for a primary button>",
    "button_secondary": "<class string for a secondary/ghost button>",
    "input": "<class string for text inputs/selects/textareas>",
    "label": "<class string for form labels>",
    "card": "<class string for a content card/panel>",
    "badge": "<class string for a small status badge/pill>",
    "table": "<class string for a <table> element>",
    "th": "<class string for table header cells>",
    "td": "<class string for table body cells>",
    "empty_state": "<class string for an empty-state container>"
  },
  "sample_data": { "<entity>": [ { "<field>": "<value>" } ] }
}

Design rules:
- Dark theme by default: bg-slate-950 page, bg-slate-900 surfaces, slate-800 borders, indigo-600 as the brand/primary accent
- The component class strings are the SINGLE source of truth — every screen reuses them verbatim so the whole app looks consistent. Make each one complete: colour, padding, radius, border, hover/focus, transition.
- Navbar: fixed top, logo left, navigation links center/right, user avatar right
- Navigation links must include ALL these screens: ${routeMap}
- Footer: simple 1-line with project name and copyright
- Use real, project-appropriate link text (not placeholders)
- sample_data: 3–5 realistic, domain-appropriate records for the main entities in this system (real names/numbers/dates, NOT Lorem Ipsum). Screens reuse these exact records so the app feels real and connected.${prefsBlock}`,
      `Project: ${projectName}\nSystem: ${s1.system_summary}\nActors: ${s1.actors?.join(", ") ?? ""}`,
      8000
    );

    const kit = (designSystem.components ?? {}) as Record<string, unknown>;
    const componentKit = Object.entries(kit)
      .filter(([, v]) => typeof v === "string" && (v as string).trim())
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const sampleData = designSystem.sample_data
      ? JSON.stringify(designSystem.sample_data).slice(0, 2000)
      : "";

    // ── Pass 2: Per-screen HTML generation (batches of 3) ─────────────────
    const allFrs: string[] = (s2.requirements ?? []).map((r: any) => `${r.id}: ${r.title} — ${r.description}`);
    const frByScreen: Record<string, string[]> = {};
    for (const sc of screens) {
      const relevant = (s2.requirements ?? [])
        .filter((r: any) =>
          sc.components?.some((c: any) =>
            r.title?.toLowerCase().split(" ").some((w: string) =>
              w.length > 3 && (c.label?.toLowerCase().includes(w) || c.purpose?.toLowerCase().includes(w))
            )
          )
        )
        .slice(0, 4)
        .map((r: any) => `${r.id}: ${r.title} — ${r.description}`);
      // Fall back to a few general requirements rather than leaving the model
      // to invent the screen's purpose from nothing.
      frByScreen[sc.id] = relevant.length ? relevant : allFrs.slice(0, 3);
    }

    const generatedScreens: any[] = [];
    let completedCount = 0;
    const BATCH = 3;
    for (let i = 0; i < screens.length; i += BATCH) {
      const batch = screens.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(async (sc: any) => {
          const componentsList = (sc.components ?? [])
            .map((c: any) => `- ${c.type}: "${c.label}"${c.purpose ? ` (${c.purpose})` : ""}`)
            .join("\n");
          const frs = frByScreen[sc.id]?.join("\n") ?? "";

          const systemPrompt = `You are an expert frontend developer. Generate a COMPLETE, polished, production-quality HTML page.

DESIGN SYSTEM (use exactly as provided — do not restyle):
${designSystem.navbar ? `Navbar:\n${designSystem.navbar}` : ""}
${designSystem.footer ? `Footer:\n${designSystem.footer}` : ""}
Body classes: ${designSystem.body_classes ?? "bg-slate-950 text-slate-100 min-h-screen flex flex-col"}

REUSABLE COMPONENT CLASSES (apply these EXACT class strings so every screen is visually consistent):
${componentKit || "— (none provided; keep styling consistent and minimal)"}

SHARED SAMPLE DATA (reuse these exact records where relevant so the app feels connected):
${sampleData || "— (invent realistic, domain-appropriate data)"}

NAVIGATION ROUTES (use as href values):
${routeMap}

CODING RULES:
1. Output ONLY the complete HTML document — no markdown, no explanation, no code fences
2. <head> must include, in this order: <script src="https://cdn.tailwindcss.com"></script>, then this EXACT accent config script: ${accentScript}, then <script src="https://unpkg.com/lucide@latest"></script>, then any <style> blocks
3. <body> must start with the navbar HTML, end with the footer HTML, main content between them
4. Reuse the component classes above for every button, input, card, badge, and table — do NOT invent new styles for those
5. Icons: use Lucide via <i data-lucide="icon-name"></i>, and call lucide.createIcons() in a <script> just before </body>
6. Use realistic, domain-appropriate data (names, numbers, dates) — NOT Lorem Ipsum; prefer the shared sample data above
7. Every UI component listed must be visually present on the page
8. Forms: <label> tied to its input via for/id, placeholders, validation attributes; no real submission needed
9. Tables: realistic sample rows (3–5 rows minimum)
10. Include relevant states where they apply: a loading skeleton, an empty state, or an error/validation message
11. Accessibility: semantic landmarks (<header>/<nav>/<main>/<footer>), aria-label on icon-only buttons, labels tied to inputs, and AA-contrast text
12. Mobile-responsive: use Tailwind responsive prefixes (sm:, md:, lg:)
13. Hover/focus states on interactive elements
14. At least one piece of JavaScript for a small interaction (e.g., dropdown, modal toggle, tab switch)${prefsBlock}`;

          const userPrompt = `Screen: ${sc.name}
Route: ${sc.route ?? ""}
Description: ${sc.description ?? ""}

Required components:
${componentsList}

Related functional requirements:
${frs || "— (use general context)"}

Project: ${projectName}
Actors: ${s1.actors?.join(", ")}
System: ${s1.system_summary}`;

          // Larger budget than before to avoid mid-tag truncation on dense pages;
          // one repair retry with a bigger cap if the first draft looks cut off.
          let html = await callGeminiText(systemPrompt, userPrompt, 16000);
          if (!htmlLooksComplete(html)) {
            html = await callGeminiText(systemPrompt, userPrompt, 24000);
          }

          completedCount++;
          emit({
            stage: 10,
            name: stageName,
            status: "running",
            detail: `Generated ${sc.name}`,
            progress: { current: completedCount, total },
          });

          return {
            id: sc.id,
            name: sc.name,
            route: sc.route ?? "",
            description: sc.description ?? "",
            html,
          };
        })
      );
      generatedScreens.push(...batchResults);
    }

    const result = {
      design_system: {
        navbar: designSystem.navbar,
        footer: designSystem.footer,
        body_classes: designSystem.body_classes,
        components: kit,
      },
      screens: generatedScreens,
    };

    await upsertArtifact(projectId, "ui_code", result);
    await upsertStage(projectId, 10, "completed");
    emit({ stage: 10, name: stageName, status: "completed" });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    await upsertStage(projectId, 10, "failed", msg);
    emit({ stage: 10, name: stageName, status: "failed", error: msg });
    throw err;
  }
}

/** Re-runs only Stage 10 for a project that already has the prerequisite artifacts. */
export async function regenerateUICode(projectId: string, userId: string, emit: Emit): Promise<void> {
  const projectRows = await sql`
    SELECT name, ui_preferences FROM projects WHERE id = ${projectId} AND user_id = ${userId} AND deleted_at IS NULL
  ` as any[];
  if (!projectRows.length) throw new Error("Project not found");

  const artifactRows = await sql`
    SELECT type, content FROM artifacts WHERE project_id = ${projectId}
  ` as any[];
  const data = Object.fromEntries(artifactRows.map((a: any) => [a.type, a.content]));

  if (!data.extraction || !data.functional_requirements || !data.wireframes) {
    throw new Error("Prerequisite artifacts missing — run the full pipeline first");
  }

  await generateUICodeMultipass(
    projectId, projectRows[0].name, data.extraction, data.functional_requirements, data.wireframes,
    emit, undefined, projectRows[0].ui_preferences ?? undefined
  );
}

export async function runPipeline(
  projectId: string,
  projectName: string,
  description: string,
  emit: Emit,
  opts: { force?: boolean; metadata?: ProjectMetadata; uiPreferences?: UIPreferences } = {}
): Promise<void> {
  await sql`UPDATE projects SET status = 'generating', updated_at = NOW() WHERE id = ${projectId}`;

  // Resume support: with force=false (default), stages whose artifact already
  // exists are skipped, so an interrupted/failed run continues where it stopped.
  // force=true (explicit "Re-generate") starts from an empty cache and redoes all.
  const cache = opts.force ? {} : await loadCompletedArtifacts(projectId);

  try {
    // ── Stage 1: Requirement Extraction ──────────────────────────────────────
    const s1 = await stageOrCached<any>(
      cache,
      projectId, 1, "extraction",
      `You are a senior software analyst and technical writer. Analyse the user's project description and produce BOTH a structured requirement extraction AND the narrative front-matter for a formal IEEE 830 Software Requirements Specification (thesis style).
Return a JSON object with this exact shape:
{
  "system_summary": "2-3 sentence plain-language summary of the system",
  "abstract": "150-220 word formal abstract: what the system is, who it serves, the approach taken, and the value it delivers",
  "motivation": "one paragraph on why this system is needed and the opportunity it addresses",
  "problem_statement": "one paragraph precisely stating the problem the system solves",
  "scope": "one paragraph describing what is in scope (and briefly what is out of scope)",
  "objectives": ["concrete project objective 1", "objective 2", "..."],
  "product_perspective": "one paragraph on how the system fits into its environment and relates to existing systems and users",
  "assumptions": ["assumption 1", "assumption 2", "..."],
  "constraints": ["constraint 1", "constraint 2", "..."],
  "actors": ["actor1", "actor2"],
  "extracted": ["clear requirement statement 1", "clear requirement statement 2", "..."]
}
Write the prose fields in clear, formal academic language suitable for a graduation thesis. Provide 4-7 objectives, at least 3 assumptions and 3 constraints, and extract at least 10 distinct, implementation-agnostic requirements.`,
      `Project: ${projectName}\n\nDescription:\n${description}${metadataContextBlock(opts.metadata)}`,
      emit
    );

    // ── Stage 2: Functional Requirements (IEEE 830) ───────────────────────────
    const s2 = await stageOrCached<any>(
      cache,
      projectId, 2, "functional_requirements",
      `You are a software requirements engineer. Convert extracted requirements into formal IEEE 830 functional requirements.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "FR-001",
      "title": "short title",
      "priority": "High|Medium|Low",
      "description": "The system shall ...",
      "acceptance_criteria": ["criterion 1", "criterion 2"]
    }
  ]
}
Generate at least 10 functional requirements. Each must start with "The system shall".`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Extracted requirements:
${s1.extracted?.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}`,
      emit
    );

    // Floor check: everything downstream (tests, traceability, UI) is derived
    // from the functional requirements, so a near-empty S2 means vague input —
    // fail loudly with an actionable message rather than build a hollow SRS.
    if (!Array.isArray(s2.requirements) || s2.requirements.length < 3) {
      throw new Error(
        "Too few functional requirements could be derived from the description. " +
        "Add more detail about the system's features and behaviour, then re-generate."
      );
    }

    // ── Layer A: Stages 3,4,5 run concurrently (each depends only on S1/S2) ───
    // They're independent, so fire them together; the Groq client's 429 retry/
    // backoff absorbs any per-minute rate-limit bursts from the parallelism.
    const [, s4, s5] = await Promise.all([
      // Stage 3: Non-Functional Requirements
      stageOrCached<any>(
        cache,
        projectId, 3, "non_functional_requirements",
      `You are a software architect. Generate non-functional requirements for the system.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "NFR-001",
      "category": "Performance|Security|Usability|Reliability|Scalability|Maintainability|Portability",
      "title": "short title",
      "description": "The system shall ...",
      "metric": "measurable acceptance metric"
    }
  ]
}
Generate at least 8 NFRs covering different quality attributes.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Functional requirements count: ${s2.requirements?.length}`,
        emit
      ),
      // Stage 4: Security Requirements (OWASP)
      stageOrCached<any>(
        cache,
        projectId, 4, "security_requirements",
      `You are a cybersecurity architect. Generate security requirements based on OWASP Top 10 2021.
Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "SR-001",
      "owasp_category": "A01:2021 – Broken Access Control",
      "title": "short title",
      "description": "The system shall ...",
      "priority": "Critical|High|Medium|Low",
      "controls": ["control measure 1", "control measure 2"]
    }
  ]
}
Map requirements to relevant OWASP categories. Generate at least 8 security requirements.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title}`).join("\n")}`,
        emit
      ),
      // Stage 5: Functional Test Cases (IEEE 829)
      stageOrCached<any>(
        cache,
        projectId, 5, "functional_test_cases",
      `You are a QA engineer. Generate IEEE 829 functional test cases for the functional requirements.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "TC-001",
      "fr_id": "FR-001",
      "title": "short test title",
      "preconditions": "system state before test",
      "steps": ["step 1", "step 2", "step 3"],
      "expected_result": "what should happen",
      "priority": "High|Medium|Low"
    }
  ]
}
Generate at least 2 test cases per functional requirement. Include positive and negative cases.`,
      `Project: ${projectName}
Functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title} — ${r.description}`).join("\n")}`,
        emit
      ),
    ]);

    // ── Layer B: Stages 6,7 run concurrently (S6 needs S4; S7 needs S1/S2) ────
    const [, s7] = await Promise.all([
      // Stage 6: Security Test Cases
      stageOrCached<any>(
        cache,
        projectId, 6, "security_test_cases",
      `You are a penetration tester. Generate security test cases for the security requirements.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "STC-001",
      "sr_id": "SR-001",
      "title": "short test title",
      "attack_vector": "describe the attack being tested",
      "steps": ["step 1", "step 2"],
      "expected_result": "expected secure behavior",
      "severity": "Critical|High|Medium|Low"
    }
  ]
}
Generate at least 1 test case per security requirement.`,
      `Project: ${projectName}
Security requirements:
${s4.requirements?.map((r: any) => `${r.id}: ${r.title} (${r.owasp_category})`).join("\n")}`,
        emit
      ),
      // Stage 7: UI Wireframe Descriptions
      stageOrCached<any>(
        cache,
        projectId, 7, "wireframes",
      `You are a UX designer. Generate detailed UI wireframe descriptions for all screens in the system.
Return a JSON object with this exact shape:
{
  "screens": [
    {
      "id": "SCR-001",
      "name": "Screen Name",
      "route": "/route",
      "description": "purpose of the screen",
      "components": [
        { "type": "type of component", "label": "label text", "purpose": "what it does" }
      ],
      "navigation": ["→ destination on action"]
    }
  ]
}
Cover all major screens implied by the functional requirements. Be detailed about components.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title}`).join("\n")}`,
        emit
      ),
    ]);

    // ── Layer C: Stages 8,9,10 run concurrently (depend on Layer A/B) ─────────
    await Promise.all([
      // Stage 8: Traceability Matrix
      stageOrCached<any>(
        cache,
        projectId, 8, "traceability_matrix",
      `You are a requirements manager. Build a traceability matrix linking functional requirements to test cases and security requirements.
Return a JSON object with this exact shape:
{
  "matrix": [
    {
      "fr_id": "FR-001",
      "fr_title": "title",
      "test_cases": ["TC-001", "TC-002"],
      "security_reqs": ["SR-001"]
    }
  ],
  "coverage": {
    "total_frs": 10,
    "covered_frs": 9,
    "total_tcs": 20,
    "percentage": 90
  }
}
Every FR must appear in the matrix. Link to relevant test cases and security requirements.`,
      `Functional requirements:
${s2.requirements?.map((r: any) => `${r.id}: ${r.title}`).join("\n")}

Functional test cases available: ${s5.test_cases?.map((t: any) => t.id).join(", ")}

Security requirements available: ${s4.requirements?.map((r: any) => r.id).join(", ")}`,
        emit
      ),
      // Stage 9: UML Diagrams (Mermaid.js)
      stageOrCached<any>(
        cache,
        projectId, 9, "uml_diagrams",
      `You are a software architect. Generate exactly 3 UML diagrams as valid Mermaid.js code.

Return a JSON object with this exact shape:
{
  "diagrams": [
    {
      "id": "UML-001",
      "title": "System Use Case Diagram",
      "type": "use_case",
      "description": "one-line description",
      "mermaid": "flowchart TD\\n  ActorName((Actor Label))\\n  UC1[Use Case One]\\n  ActorName --> UC1"
    },
    {
      "id": "UML-002",
      "title": "Domain Class Diagram",
      "type": "class",
      "description": "one-line description",
      "mermaid": "classDiagram\\n  class EntityName {\\n    +id String\\n    +field String\\n    +method()\\n  }\\n  EntityA --> EntityB : relation"
    },
    {
      "id": "UML-003",
      "title": "Main Sequence Diagram",
      "type": "sequence",
      "description": "one-line description",
      "mermaid": "sequenceDiagram\\n  actor User\\n  participant System\\n  participant DB\\n  User->>System: action\\n  System->>DB: query\\n  DB-->>System: result\\n  System-->>User: response"
    }
  ]
}

STRICT Mermaid syntax rules:
1. flowchart TD for use case: actors as ((Label)), use cases as [Label], arrows as -->
2. classDiagram: attributes as "+name Type", methods as "+method()", relations as "ClassA --> ClassB : label"
3. sequenceDiagram: use actor for humans, participant for systems; arrows ->> (solid) or -->>(dashed)
4. Node IDs must be alphanumeric with no spaces. Labels can have spaces inside quotes or parens.
5. Every \\n in the JSON string is a real newline in the diagram. Do NOT use actual newlines in the JSON value.
6. Keep each diagram concise (under 20 nodes/lines) for clarity.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.slice(0, 8).map((r: any) => `${r.id}: ${r.title}`).join("\n")}
Screens (derive domain entities and interactions from these):
${s7.screens?.map((sc: any) => `${sc.name}${sc.description ? ` — ${sc.description}` : ""}`).join("\n")}`,
        emit,
        undefined,
        sanitizeUmlArtifact
      ),
      // Stage 10: UI Code Generation (multipass — needs S1, S2, S7)
      generateUICodeMultipass(projectId, projectName, s1, s2, s7, emit, cache.ui_code, opts.uiPreferences),
    ]);

    await sql`UPDATE projects SET status = 'completed', updated_at = NOW() WHERE id = ${projectId}`;
  } catch (err) {
    await sql`UPDATE projects SET status = 'failed', updated_at = NOW() WHERE id = ${projectId}`;
    // Preserve the real message (a failed stage's Groq error, or the floor-check
    // guidance above) so the SSE error event can surface something actionable.
    throw err instanceof Error ? err : new Error("Pipeline failed");
  }
}
