import { sql } from "../db/client";
import { callGroq, callGroqText, GROQ_HEAVY, GROQ_LIGHT } from "./groq.service";
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
  5000,  // 1  Requirement Extraction + SRS narrative front-matter
  8000,  // 2  Functional Requirements (atomic decomposition + acceptance criteria)
  3000,  // 3  Non-Functional Requirements
  4000,  // 4  Security Requirements
  10000, // 5  Functional Test Cases (positive + negative/edge per FR — largest JSON stage)
  6000,  // 6  Security Test Cases (headroom so procedures never truncate mid-field)
  6000,  // 7  UI Wireframe Descriptions
  4000,  // 8  Traceability Matrix
  9000,  // 9  UML Diagrams (now 6–8 diagrams across multiple UML types)
];

// Preferred Groq model per stage (indexed by stage number - 1). For Groq-routed
// stages this is the model used; for Gemini-routed stages (see STAGE_PROVIDER)
// this is the FALLBACK model if Gemini is unavailable. Easier, highly
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
  GROQ_HEAVY, // 6  Security Test Cases (procedure quality matters — judge penalised weak/truncated tests)
  GROQ_HEAVY, // 7  UI Wireframe Descriptions (creative; feeds UI generation)
  GROQ_LIGHT, // 8  Traceability Matrix (pure linking/lookup — easiest)
  GROQ_HEAVY, // 9  UML Diagrams (strict Mermaid syntax; weak models break it)
];

// Provider per stage. The two things that scored highest in GEval — the generated
// UI (100%) and the judge itself — are both Gemini, while the llama-class Groq
// stages lagged (SRS/tests/UML). So we route the foundational + lowest-scoring
// text stages to Gemini to close the writer-vs-judge capability gap; the rest
// stay on Groq (lighter/derivative work, and Groq's quota is more generous, which
// matters since Stage 10 already leans on Gemini). Gemini-routed stages fall back
// to their Groq STAGE_MODEL if Gemini errors, so an outage degrades one stage's
// quality rather than failing the whole pipeline.
type StageProvider = "groq" | "gemini";
const STAGE_PROVIDER: StageProvider[] = [
  "groq",   // 1  Requirement Extraction (large prose output; not a flagged weak spot)
  "gemini", // 2  Functional Requirements (foundation for every downstream artifact)
  "groq",   // 3  Non-Functional Requirements (templated/derivative)
  "groq",   // 4  Security Requirements (mapped to known OWASP categories)
  "gemini", // 5  Functional Test Cases (lowest-scoring dimension)
  "gemini", // 6  Security Test Cases (judge penalised weak/truncated procedures)
  "groq",   // 7  UI Wireframe Descriptions (creative; feeds UI)
  "groq",   // 8  Traceability Matrix (pure linking/lookup)
  "gemini", // 9  UML Diagrams (entity/actor accuracy + strict Mermaid — Gemini stronger)
];

/**
 * Runs a stage's structured-JSON call on its configured provider. Gemini-routed
 * stages fall back to Groq (the stage's STAGE_MODEL) if Gemini errors, so a
 * Gemini outage costs quality on that one stage instead of aborting the run.
 * The provider that actually served the call is logged so a local run can verify
 * Gemini is really being used (not silently falling back to Groq on a bad key).
 */
async function callStageLLM(
  provider: StageProvider,
  stageNum: number,
  system: string,
  user: string,
  cap: number,
  groqModel: string
): Promise<any> {
  if (provider === "gemini") {
    try {
      const out = await callGeminiJSON(system, user, cap);
      console.info(`[pipeline] stage ${stageNum} served by Gemini`);
      return out;
    } catch (err: any) {
      console.warn(`[pipeline] stage ${stageNum} Gemini call failed, falling back to Groq:`, err?.message);
      return await callGroq(system, user, cap, groqModel);
    }
  }
  console.info(`[pipeline] stage ${stageNum} served by Groq (${groqModel})`);
  return await callGroq(system, user, cap, groqModel);
}

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
      -- On a fresh run the "running" upsert carries a new started_at and should
      -- reset the clock; the later "completed" upsert carries NULL and must keep
      -- the run's real start. Preferring EXCLUDED-when-present does both, so a
      -- re-generation times itself rather than spanning from the first-ever run.
      started_at = COALESCE(EXCLUDED.started_at, pipeline_stages.started_at),
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
  const provider = STAGE_PROVIDER[stageNum - 1] ?? "groq";
  emit({ stage: stageNum, name, status: "running" });
  await upsertStage(projectId, stageNum, "running");

  try {
    const raw = await callStageLLM(provider, stageNum, system, user, cap, model);
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
 * preview's instant-recolor (which remaps `indigo`) keeps working. We *redefine*
 * the indigo scale to the generation's chosen accent via the Play-CDN config, so
 * `indigo-600` literally renders as that colour. Code owns this script (not the
 * LLM) for deterministic, always-valid output. Pass the resolved accent hex
 * (see pickDesignDirection); an unparseable hex falls back to the indigo default.
 */
export function accentConfigScript(accentHex?: string): string {
  const scale = accentHex ? buildAccentScale(accentHex) : DEFAULT_INDIGO;
  return `<script>tailwind.config={theme:{extend:{colors:{indigo:${JSON.stringify(scale)}}}}}</script>`;
}

// ── Accent resolution ───────────────────────────────────────────────────────
// The MODEL chooses the brand accent (it knows the product domain, so it can pick
// a fitting, distinctive colour rather than the same indigo every time). Code's
// only job is to turn that choice into the `indigo-*` scale remap so the preview's
// instant-recolor and the custom-colour feature keep working. Resolution order:
// an explicit user custom colour wins; otherwise the model's hex (if valid);
// otherwise the indigo default as a last resort.
const INDIGO_FALLBACK = "#6366f1";

export function resolveAccentHex(prefs?: UIPreferences, modelHex?: string): string {
  if (prefs?.color_mode === "custom" && prefs.primary_color?.trim()) {
    return prefs.primary_color.trim();
  }
  const hex = (modelHex ?? "").trim();
  return hexToRgb(hex) ? hex : INDIGO_FALLBACK;
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

/**
 * Minimal design system used as a last-resort fallback when BOTH Gemini and the
 * Groq cross-provider fallback fail to produce one. Generation can still proceed
 * with a coherent (if plain) navbar/footer rather than aborting the whole stage.
 */
export const DEFAULT_DESIGN_SYSTEM = {
  navbar:
    '<nav class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 h-14 flex items-center justify-between"><span class="font-bold text-white">App</span><div class="w-8 h-8 rounded-full bg-indigo-600"></div></nav>',
  footer:
    '<footer class="border-t border-slate-800 py-6 text-center text-slate-500 text-sm">© 2026</footer>',
  body_classes: "bg-slate-950 text-slate-100 min-h-screen flex flex-col",
  components: {},
  sample_data: {},
};

/**
 * Design-system pass with graceful degradation: try Gemini, then Groq (which has
 * an independent quota and is unaffected by Gemini's traffic spikes), then fall
 * back to a hardcoded default. Never throws — Stage 10 always gets a usable kit.
 */
async function designSystemWithFallback(
  systemPrompt: string,
  userPrompt: string,
  emit: Emit,
  stageName: string,
  total: number
): Promise<any> {
  try {
    return await callGeminiJSON(systemPrompt, userPrompt, 8000);
  } catch (gemErr) {
    console.warn("[stage10] Gemini design system failed, falling back to Groq:", (gemErr as any)?.message);
    emit({ stage: 10, name: stageName, status: "running", detail: "Gemini busy — using fallback model for the design system…", progress: { current: 0, total } });
    try {
      return await callGroq(systemPrompt, userPrompt, 8000, GROQ_HEAVY);
    } catch (groqErr) {
      console.warn("[stage10] Groq design system fallback also failed, using default:", (groqErr as any)?.message);
      return { ...DEFAULT_DESIGN_SYSTEM };
    }
  }
}

/**
 * Per-screen HTML with a cross-provider fallback: Gemini first (with its own
 * model-chain + completeness repair), then Groq if Gemini is unavailable. Throws
 * only when both providers fail for this screen — the caller then drops just that
 * screen rather than the whole batch.
 */
async function screenHtmlWithFallback(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    let html = await callGeminiText(systemPrompt, userPrompt, 16000);
    if (!htmlLooksComplete(html)) {
      html = await callGeminiText(systemPrompt, userPrompt, 24000); // repair truncation
    }
    return html;
  } catch (gemErr) {
    console.warn("[stage10] Gemini screen failed, falling back to Groq:", (gemErr as any)?.message);
    // Groq's largest model is the best HTML producer in the fallback chain.
    return await callGroqText(systemPrompt, userPrompt, 16000, GROQ_HEAVY);
  }
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

    // ── Pass 1: Design system — the model invents a visual identity that fits
    //    THIS product (theme, neutral family, brand accent, shape/depth) plus the
    //    navbar, footer, reusable component kit, and shared sample data. We don't
    //    prescribe colours — the model picks them; code only turns the chosen
    //    accent into the `indigo` remap afterward. Uses Gemini → Groq → hardcoded
    //    default fallback so traffic spikes on Gemini never abort the stage. ────
    const designSystem = await designSystemWithFallback(
      `You are a senior product designer. Invent a cohesive, DISTINCTIVE visual identity for THIS specific web app, then express it as an HTML design system + reusable component class kit.

First, choose a design language that genuinely fits the product's domain and audience — do NOT default to a generic dark dashboard or the same colours every time:
- Choose LIGHT or DARK, whichever suits the product.
- Choose a Tailwind NEUTRAL family for backgrounds/text/borders: slate, zinc, stone, gray, or neutral.
- Choose a distinctive BRAND ACCENT colour (as a hex value) that fits the domain — e.g. trustworthy blues/teals for finance & healthcare, energetic warm tones for consumer/social, refined violets for premium products, fresh greens for sustainability/wellness. Pick something intentional, not a default.
- Choose the shape language (corner radius), depth (flat vs soft-shadow vs glass), and density.

Return a JSON object with exactly this shape:
{
  "accent_hex": "#rrggbb — the brand accent colour you chose",
  "theme_summary": "1–2 sentences describing the look you chose (light/dark, mood, neutral family, shape & depth) — every screen will follow this",
  "navbar": "<full navbar HTML using Tailwind classes>",
  "footer": "<footer HTML using Tailwind classes>",
  "body_classes": "<the <body> classes implementing your theme, e.g. dark: bg-zinc-950 text-zinc-100 min-h-screen flex flex-col — light: bg-stone-50 text-stone-900 min-h-screen flex flex-col>",
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

ACCENT COLOUR — IMPORTANT:
- In all the HTML you output, express the brand accent ONLY with Tailwind \`indigo-*\` utilities (indigo-600 primary, indigo-500/400 for hovers/highlights). At runtime these are remapped to your chosen accent_hex, so the page renders in YOUR colour. Do NOT use any other Tailwind colour name (violet/blue/emerald/etc.) for the accent — only \`indigo-*\`.
- Use your chosen neutral family for all backgrounds, surfaces, text, and borders.

Rules:
- The component class strings are the SINGLE source of truth — every screen reuses them verbatim so the whole app looks consistent. Make each one complete: colour, padding, radius, border, hover/focus, transition, and matched to your chosen design language.
- Navbar: fixed top, logo left, navigation links center/right, user avatar right — styled for your theme.
- Navigation links must include ALL these screens: ${routeMap}
- Footer: simple 1-line with project name and copyright
- Use real, project-appropriate link text (not placeholders)
- sample_data: 3–5 realistic, domain-appropriate records for the main entities in this system (real names/numbers/dates, NOT Lorem Ipsum). Screens reuse these exact records so the app feels real and connected.${prefsBlock}`,
      `Project: ${projectName}\nSystem: ${s1.system_summary}\nActors: ${s1.actors?.join(", ") ?? ""}`,
      emit,
      stageName,
      total
    );

    // The model picked the accent; code turns it into the deterministic `indigo`
    // remap (custom-colour preference still overrides). A short, model-written
    // theme summary keeps every per-screen page on the same aesthetic. The
    // resolved hex is also persisted on the artifact so the wireframe view can
    // tint its mockups to match the generated UI's brand colour.
    const accentHex = resolveAccentHex(uiPreferences, designSystem.accent_hex);
    const accentScript = accentConfigScript(accentHex);
    const themeSummary: string =
      typeof designSystem.theme_summary === "string" && designSystem.theme_summary.trim()
        ? designSystem.theme_summary.trim()
        : "Clean, modern, consistent — follow the navbar, footer, body theme, and component classes exactly.";
    const defaultBodyClasses = "bg-slate-950 text-slate-100 min-h-screen flex flex-col";

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
    const failedScreens: string[] = [];
    let completedCount = 0;
    const BATCH = 3;
    for (let i = 0; i < screens.length; i += BATCH) {
      const batch = screens.slice(i, i + BATCH);
      const batchResults = await Promise.allSettled(
        batch.map(async (sc: any) => {
          const componentsList = (sc.components ?? [])
            .map((c: any) => `- ${c.type}: "${c.label}"${c.purpose ? ` (${c.purpose})` : ""}`)
            .join("\n");
          const frs = frByScreen[sc.id]?.join("\n") ?? "";

          const systemPrompt = `You are an expert frontend developer. Generate a COMPLETE, polished, production-quality HTML page that feels hand-crafted for THIS screen — not a generic template.

DESIGN DIRECTION: ${themeSummary}

DESIGN SYSTEM (shared chrome + component kit — keep the navbar, footer, theme, and component classes consistent with every other screen):
${designSystem.navbar ? `Navbar:\n${designSystem.navbar}` : ""}
${designSystem.footer ? `Footer:\n${designSystem.footer}` : ""}
Body classes: ${designSystem.body_classes ?? defaultBodyClasses}

REUSABLE COMPONENT CLASSES (apply these EXACT class strings for buttons/inputs/cards/etc. so every screen is visually consistent):
${componentKit || "— (none provided; keep styling consistent and minimal)"}

SHARED SAMPLE DATA (reuse these exact records where relevant so the app feels connected):
${sampleData || "— (invent realistic, domain-appropriate data)"}

NAVIGATION ROUTES (use as href values):
${routeMap}

CODING RULES:
1. Output ONLY the complete HTML document — no markdown, no explanation, no code fences
2. <head> must include, in this order: <script src="https://cdn.tailwindcss.com"></script>, then this EXACT accent config script: ${accentScript}, then <script src="https://unpkg.com/lucide@latest"></script>, then any <style> blocks
3. <body> must start with the navbar HTML, end with the footer HTML, main content between them
4. Reuse the component classes above for buttons, inputs, cards, badges, and tables so the app stays consistent — but DO craft a distinctive, content-rich layout for this specific screen (a strong header/hero where it fits, well-grouped sections, real visual hierarchy and depth). Don't just stack identical generic cards.
5. Express any accent/brand colour with Tailwind \`indigo-*\` utilities only (remapped to the real brand colour at runtime); use the neutral scale from the body classes for backgrounds/text/borders.
6. Icons: use Lucide via <i data-lucide="icon-name"></i>, and call lucide.createIcons() in a <script> just before </body>
7. Use realistic, domain-appropriate data (names, numbers, dates) — NOT Lorem Ipsum; prefer the shared sample data above
8. Every UI component listed must be visually present on the page
9. Forms: <label> tied to its input via for/id, placeholders, validation attributes; no real submission needed
10. Tables: realistic sample rows (3–5 rows minimum)
11. Include relevant states where they apply: a loading skeleton, an empty state, or an error/validation message
12. Accessibility: semantic landmarks (<header>/<nav>/<main>/<footer>), aria-label on icon-only buttons, labels tied to inputs, and AA-contrast text
13. Mobile-responsive: use Tailwind responsive prefixes (sm:, md:, lg:)
14. Hover/focus states on interactive elements
15. At least one piece of JavaScript for a small interaction (e.g., dropdown, modal toggle, tab switch)${prefsBlock}`;

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

          // Gemini → Groq cross-provider fallback (incl. truncation repair).
          const html = await screenHtmlWithFallback(systemPrompt, userPrompt);

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
      // Passoff: keep every screen that succeeded; a screen that failed on BOTH
      // providers is dropped (and reported) rather than aborting the whole run.
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        if (r.status === "fulfilled") {
          generatedScreens.push(r.value);
        } else {
          const sc = batch[j];
          failedScreens.push(sc.name);
          console.warn(`[stage10] dropping screen "${sc.name}" — all providers failed:`, (r.reason as any)?.message);
          completedCount++;
          emit({
            stage: 10,
            name: stageName,
            status: "running",
            detail: `Skipped ${sc.name} (generation unavailable)`,
            progress: { current: completedCount, total },
          });
        }
      }
    }

    // If every screen failed there is nothing to hand off — surface a real error.
    if (generatedScreens.length === 0) {
      throw new Error("UI code generation failed for every screen (Gemini and Groq both unavailable). Try again later.");
    }

    const partial = failedScreens.length > 0;
    const result = {
      design_system: {
        navbar: designSystem.navbar,
        footer: designSystem.footer,
        body_classes: designSystem.body_classes,
        components: kit,
        accent: accentHex,
      },
      screens: generatedScreens,
      // Record any incomplete generation so the UI can tell the user some screens
      // were skipped and offer a targeted re-run.
      ...(partial ? { partial: true, failed_screens: failedScreens } : {}),
    };

    await upsertArtifact(projectId, "ui_code", result);
    await upsertStage(projectId, 10, "completed");
    emit({
      stage: 10,
      name: stageName,
      status: "completed",
      ...(partial ? { detail: `Generated ${generatedScreens.length}/${total} screens — ${failedScreens.length} skipped (provider unavailable)` } : {}),
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    await upsertStage(projectId, 10, "failed", msg);
    emit({ stage: 10, name: stageName, status: "failed", error: msg });
    throw err;
  }
}

// ── Wireframes ⟵ generated UI (post-Stage-10 alignment) ─────────────────────
// The UI is generated creatively, free of the early low-fi wireframes. Once it
// exists, we run the relationship the OTHER way: reverse-engineer the wireframes
// from the finished UI so the "design" artifact actually mirrors what was built.
// The UI stays unconstrained; the wireframes get pulled into alignment with it,
// which makes them read as a faithful, higher-quality blueprint of the real app.

// Controlled vocabulary the wireframe renderer knows how to draw. Constraining
// the model to this list guarantees every derived block maps to a real shape.
const WF_BLOCK_TYPES = [
  "navbar", "hero", "heading", "text", "search", "button", "input", "form",
  "stat", "stats_row", "card", "card_grid", "list", "table", "sidebar",
  "chart", "image", "badge", "tabs", "footer",
] as const;

interface DerivedBlock { type: string; label: string; purpose?: string }

// Loose synonym map → nearest known block, so a model that says "hero_section"
// or "datatable" still lands on a drawable shape instead of the generic default.
function normalizeBlockType(raw: string): string {
  const t = raw.toLowerCase().replace(/[\s_-]+/g, "");
  const known = new Set(WF_BLOCK_TYPES as readonly string[]);
  if (known.has(raw.toLowerCase())) return raw.toLowerCase();
  const aliases: [RegExp, string][] = [
    [/nav|header|topbar|appbar|menu/, "navbar"],
    [/hero|jumbotron|banner|masthead/, "hero"],
    [/kpi|metric|stat(card)?$/, "stat"],
    [/stats|kpis|metrics/, "stats_row"],
    [/cardgrid|cards|grid|gallery|tiles/, "card_grid"],
    [/datatable|table|datagrid/, "table"],
    [/list|feed|rows|timeline/, "list"],
    [/sidebar|aside|drawer|filters?panel/, "sidebar"],
    [/chart|graph|plot|analytics/, "chart"],
    [/form|fieldset/, "form"],
    [/input|textfield|select|textarea/, "input"],
    [/search/, "search"],
    [/button|cta|action/, "button"],
    [/heading|title|h1|h2/, "heading"],
    [/text|paragraph|copy|description/, "text"],
    [/image|img|photo|avatar|thumbnail|illustration/, "image"],
    [/badge|tag|pill|chip|status/, "badge"],
    [/tab/, "tabs"],
    [/footer/, "footer"],
    [/card|panel|tile/, "card"],
  ];
  for (const [re, type] of aliases) if (re.test(t)) return type;
  return "card";
}

/**
 * Reverse-engineers a low-fidelity wireframe block list from one finished UI
 * page. The model reads the real HTML and reports the major visual sections
 * top-to-bottom using the controlled vocabulary, so the wireframe mirrors the
 * actual layout. Light model (cheap/fast); returns [] on any failure.
 */
async function deriveScreenBlocks(name: string, html: string): Promise<DerivedBlock[]> {
  if (!html || html.length < 200) return [];
  const system = `You translate a FINISHED HTML web page into a low-fidelity WIREFRAME — the structural blueprint a designer would have sketched before building it.

Return JSON exactly: { "blocks": [ { "type": "...", "label": "short label", "purpose": "one short phrase" } ] }

Rules:
- "type" MUST be one of: ${WF_BLOCK_TYPES.join(", ")}.
- List blocks in the SAME top-to-bottom order they visually appear on the page.
- Start with "navbar" if the page has a top nav, and end with "footer" if it has one.
- Collapse repeated elements into one structural block: a grid of cards is ONE "card_grid", a row of metric tiles is ONE "stats_row", a data table is ONE "table".
- Use "hero" for a large prominent header/intro section, "form" for a group of inputs, "sidebar" for a side panel beside main content.
- 6 to 12 blocks total — capture the real structure, not every element.
- "label" is 2-4 words describing that section in this app's domain (e.g. "Revenue overview", "Recent orders"). No placeholders.`;
  const user = `Screen: ${name}\n\nHTML (truncated):\n${html.slice(0, 12000)}`;
  try {
    const raw = await callGroq(system, user, 1500, GROQ_LIGHT);
    const blocks = Array.isArray(raw?.blocks) ? raw.blocks : [];
    return blocks
      .filter((b: any) => b && typeof b.type === "string")
      .map((b: any) => ({
        type: normalizeBlockType(b.type),
        label: String(b.label ?? "").trim().slice(0, 48),
        purpose: b.purpose ? String(b.purpose).trim().slice(0, 120) : undefined,
      }))
      .slice(0, 14);
  } catch (err: any) {
    console.warn(`[wireframes] could not derive blocks for "${name}":`, err?.message);
    return [];
  }
}

/**
 * After UI generation, rewrites the wireframes artifact so each screen's
 * component list mirrors the structure of the actually-generated UI page.
 * Original screen metadata (id/name/route/description/navigation) is preserved;
 * only the component blocks are replaced. Screens with no generated counterpart
 * borrow the layout of the same category (the UI dedups by category, so e.g.
 * Login & Register share the one generated auth layout). Never throws and never
 * blocks generation — on any failure the original wireframes are left intact.
 */
export async function deriveWireframesFromUI(
  projectId: string,
  opts: { force?: boolean } = {}
): Promise<void> {
  try {
    const rows = await sql`
      SELECT type, content FROM artifacts
      WHERE project_id = ${projectId} AND type IN ('ui_code', 'wireframes')
    ` as any[];
    const byType = Object.fromEntries(rows.map((r: any) => [r.type, r.content]));
    const ui = byType.ui_code;
    const wf = byType.wireframes;
    const uiScreens: any[] = Array.isArray(ui?.screens) ? ui.screens : [];
    const wfScreens: any[] = Array.isArray(wf?.screens) ? wf.screens : [];
    if (!uiScreens.length || !wfScreens.length) return;
    // Already aligned to this UI — skip unless an explicit re-run forces it.
    if (wf.derived_from_ui && !opts.force) return;

    // Derive a block list per generated UI screen (parallel; light model).
    const results = await Promise.allSettled(
      uiScreens.map(async (s) => ({ s, blocks: await deriveScreenBlocks(s.name ?? s.id, s.html ?? "") }))
    );
    const byId = new Map<string, DerivedBlock[]>();
    const byCategory = new Map<string, DerivedBlock[]>();
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value.blocks.length) continue;
      byId.set(r.value.s.id, r.value.blocks);
      const cat = screenCategory(r.value.s);
      if (!byCategory.has(cat)) byCategory.set(cat, r.value.blocks);
    }
    if (!byId.size) return; // nothing usable derived → keep original wireframes

    const accent = typeof ui?.design_system?.accent === "string" ? ui.design_system.accent : undefined;

    const screens = wfScreens.map((sc) => {
      const blocks = byId.get(sc.id) ?? byCategory.get(screenCategory(sc));
      if (!blocks?.length) return sc; // no match → preserve original components
      return {
        ...sc,
        components: blocks.map((b) => ({
          type: b.type,
          label: b.label || sc.name || sc.id,
          ...(b.purpose ? { purpose: b.purpose } : {}),
        })),
      };
    });

    await upsertArtifact(projectId, "wireframes", {
      ...wf,
      screens,
      derived_from_ui: true,
      ...(accent ? { accent } : {}),
    });
  } catch (err: any) {
    console.warn("[wireframes] UI-derived alignment failed, keeping original:", err?.message);
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

  // The UI changed — re-align the wireframes to the freshly generated pages.
  await deriveWireframesFromUI(projectId, { force: true });
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
      `You are a software requirements engineer. Convert the extracted requirements into formal IEEE 830 functional requirements.

DECOMPOSE thoroughly: break each feature into ATOMIC, individually testable requirements — one observable system behaviour per requirement. Prefer several precise requirements over one broad umbrella statement. Cover the full breadth of the system: every distinct feature, sub-feature, and user action implied by the description maps to at least one requirement. Where the description names specific behaviours (e.g. conflict detection, real-time signalling, status transitions, role-specific views, sign-in/check-in), give each its own requirement instead of folding them into a generic "manage X".

SCOPE — functional only: a functional requirement describes WHAT the system does (a behaviour, action, or rule). Do NOT restate non-functional qualities as functional requirements — performance/latency, offline tolerance, scalability, availability, maintainability, and security hardening belong in the NFR and security specs, not here. You may describe a behaviour that an NFR later constrains, but never duplicate the constraint itself as an FR.

Return a JSON object with this exact shape:
{
  "requirements": [
    {
      "id": "FR-001",
      "title": "short title",
      "priority": "High|Medium|Low",
      "description": "The system shall ...",
      "acceptance_criteria": ["specific, verifiable criterion 1", "criterion 2"]
    }
  ]
}
Generate at least 12 functional requirements (more if the system warrants it). Each "description" must start with "The system shall" and specify a SINGLE behaviour. Give each requirement 2+ concrete, verifiable acceptance criteria (exact states, messages, or outputs — never "works correctly"), since these directly drive the downstream test cases.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Extracted requirements:
${s1.extracted?.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}

Non-functional constraints (do NOT restate these as functional requirements — they are captured separately in the NFR/security specs):
${(s1.constraints ?? []).map((c: string) => `- ${c}`).join("\n") || "- (none provided)"}`,
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
      `You are a senior QA engineer. Generate IEEE 829 functional test cases for the functional requirements.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "TC-001",
      "fr_id": "FR-001",
      "title": "short test title",
      "type": "positive|negative|edge",
      "preconditions": "system state + the ROLE performing the test (use only the actors listed below)",
      "steps": ["concrete action with realistic test data", "..."],
      "expected_result": "exact, verifiable outcome",
      "priority": "High|Medium|Low"
    }
  ]
}

COVERAGE — for EVERY functional requirement produce at least:
- one POSITIVE test (the happy path succeeds), AND
- one NEGATIVE or EDGE test (invalid input, missing/wrong permissions, boundary value, conflicting/duplicate state, or empty data) that proves the system rejects or safely handles it.
A requirement covered only by positive tests is incomplete — always include the failure side.

QUALITY rules:
- Base each "expected_result" on the requirement's acceptance criteria, and state the EXACT message, status, or state change — e.g. "Booking is rejected with error 'Time slot unavailable' and no record is created". Never use vague phrases like "works correctly" or "with correct information".
- "preconditions" must name the role/actor from the provided actor list — do NOT invent roles (e.g. don't write "production manager" if the actors are "Stage Manager"/"Producer"). Use the system's real role names exactly.
- "steps" must be concrete actions with realistic data — never "step 1".
- Each negative/edge test must target a SPECIFIC failure mode (invalid data, unauthorized role, boundary/limit, or conflicting state), not a generic "enter wrong data".`,
      `Project: ${projectName}
Actors (use ONLY these role names in preconditions): ${s1.actors?.join(", ")}
Functional requirements (base each expected_result on the acceptance criteria shown):
${s2.requirements?.map((r: any) => `${r.id}: ${r.title} — ${r.description}${r.acceptance_criteria?.length ? `\n   Acceptance: ${r.acceptance_criteria.join("; ")}` : ""}`).join("\n")}`,
        emit
      ),
    ]);

    // ── Layer B: Stages 6,7 run concurrently (S6 needs S4; S7 needs S1/S2) ────
    const [, s7] = await Promise.all([
      // Stage 6: Security Test Cases
      stageOrCached<any>(
        cache,
        projectId, 6, "security_test_cases",
      `You are a penetration tester. Generate security test cases that TEST each security requirement — attempt the weakness and verify the system's defence. Describe how to PROBE for the vulnerability and the secure behaviour you expect to observe; do NOT describe how to remediate or fix it.
Return a JSON object with this exact shape:
{
  "test_cases": [
    {
      "id": "STC-001",
      "sr_id": "SR-001",
      "title": "short test title",
      "attack_vector": "the specific attack/technique being attempted",
      "steps": ["concrete attacker action 1", "..."],
      "expected_result": "the exact secure behaviour: how the system rejects, blocks, or safely handles the attempt",
      "severity": "Critical|High|Medium|Low"
    }
  ]
}
Generate at least 1 test case per security requirement. Each test maps to a DISTINCT security requirement and a distinct attack vector — no redundant or duplicate tests; title, attack_vector, and expected_result must agree.
- "steps" are the attacker's concrete actions (the test procedure) — what you send/do to exercise the weakness.
- "expected_result" is the observed secure RESPONSE (the rejection, sanitisation, lockout, 403, or audit-log entry), NOT a remediation or "the system should be patched" instruction.
- Keep every test self-contained and COMPLETE — fully populate each field and never truncate a test mid-sentence.`,
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
      `You are a software architect. Generate a RICH, comprehensive set of 6–8 UML/architecture diagrams as valid Mermaid.js code that genuinely model THIS specific system — not generic placeholders.

Choose the diagrams that best fit the system and ensure broad coverage across these categories (include at least one of each of the first five, then add the most relevant remaining ones):
- "use_case"   — actors and the use cases they perform (flowchart TD)
- "class"      — domain model: real entities, attributes, methods, and relationships (classDiagram)
- "er"         — database/entity-relationship model with keys and cardinalities (erDiagram)
- "sequence"   — a key end-to-end interaction flow (sequenceDiagram). PREFER TWO sequence diagrams for two different important flows.
- "activity"   — the main business workflow as an activity/flow diagram (flowchart TD with decisions)
- "state"      — lifecycle of a core entity (stateDiagram-v2)
- "component"  — high-level component/architecture view (flowchart LR with subgraphs)

Return a JSON object with this exact shape (6–8 entries; ids UML-001, UML-002, …):
{
  "diagrams": [
    {
      "id": "UML-001",
      "title": "System Use Case Diagram",
      "type": "use_case",
      "description": "one-line description",
      "mermaid": "flowchart TD\\n  Actor1((Customer))\\n  UC1[Browse Catalog]\\n  UC2[Place Order]\\n  Actor1 --> UC1\\n  Actor1 --> UC2"
    },
    {
      "id": "UML-002",
      "title": "Domain Class Diagram",
      "type": "class",
      "description": "one-line description",
      "mermaid": "classDiagram\\n  class Entity {\\n    +id String\\n    +field String\\n    +method()\\n  }\\n  EntityA --> EntityB : relation"
    },
    {
      "id": "UML-003",
      "title": "Entity Relationship Diagram",
      "type": "er",
      "description": "one-line description",
      "mermaid": "erDiagram\\n  USER ||--o{ ORDER : places\\n  ORDER ||--|{ LINE_ITEM : contains\\n  USER {\\n    int id PK\\n    string email\\n  }"
    },
    {
      "id": "UML-004",
      "title": "Order Placement Sequence",
      "type": "sequence",
      "description": "one-line description",
      "mermaid": "sequenceDiagram\\n  actor User\\n  participant System\\n  participant DB\\n  User->>System: action\\n  System->>DB: query\\n  DB-->>System: result\\n  System-->>User: response"
    },
    {
      "id": "UML-005",
      "title": "Main Workflow Activity Diagram",
      "type": "activity",
      "description": "one-line description",
      "mermaid": "flowchart TD\\n  Start([Start]) --> A[Do step]\\n  A --> D{Valid?}\\n  D -->|Yes| B[Continue]\\n  D -->|No| A\\n  B --> End([End])"
    },
    {
      "id": "UML-006",
      "title": "Entity Lifecycle State Diagram",
      "type": "state",
      "description": "one-line description",
      "mermaid": "stateDiagram-v2\\n  [*] --> Draft\\n  Draft --> Submitted: submit\\n  Submitted --> Approved: approve\\n  Submitted --> Rejected: reject\\n  Approved --> [*]"
    },
    {
      "id": "UML-007",
      "title": "System Component Diagram",
      "type": "component",
      "description": "one-line description",
      "mermaid": "flowchart LR\\n  subgraph Client\\n    UI[Web App]\\n  end\\n  subgraph Server\\n    API[API Service]\\n    DB[(Database)]\\n  end\\n  UI --> API\\n  API --> DB"
    }
  ]
}

CONTENT REQUIREMENTS (accuracy matters as much as syntax — the diagrams must reflect THIS system and stay consistent with the requirements):
- Use-case diagram: include a use case for EACH major functional requirement below, and connect each use case ONLY to the actor(s) who actually perform it per the requirements. Do NOT wire every actor to every use case, and do NOT assign an action to an actor who would not perform it (e.g. a performer does not "call cues live" if that is the stage manager's job).
- Class & ER diagrams: include EVERY important domain entity the system manages — derive the nouns from BOTH the requirements AND the screen list below (e.g. distinct records, schedules, line-items, sign-in/attendance logs, reports). Do not omit central entities; give each its key attributes and the relationships/cardinalities between them.
- Sequence diagram(s): model a real end-to-end flow from the requirements using the ACTUAL actors and system components described. Do NOT invent integrations the requirements never mention (e.g. the system directly driving lighting/sound/hardware) — route interactions through the real roles and components (e.g. signals sent to crew devices), and avoid a generic login flow.
- Keep all diagrams mutually consistent and faithful to the functional requirements — the same actors, entities, and responsibilities must appear across the diagrams as in the SRS.
- Ground everything in the specific requirements, actors, entities, and screens provided; avoid generic placeholders.

STRICT Mermaid syntax rules:
1. use_case: flowchart TD; actors as ((Label)), use cases as [Label], arrows -->
2. class: classDiagram; attributes "+name Type", methods "+method()", relations "ClassA --> ClassB : label"
3. er: erDiagram; relations like "A ||--o{ B : label"; attribute blocks "ENTITY {\\n  type name PK\\n}"
4. sequence: sequenceDiagram; "actor" for humans, "participant" for systems; arrows ->> (solid) or -->> (dashed)
5. activity: flowchart TD; start/end as ([Label]), actions as [Label], decisions as {Label?} with -->|Yes|/-->|No| branches
6. state: stateDiagram-v2; "[*] --> StateName", transitions "A --> B: event"
7. component: flowchart LR; group related parts in "subgraph Name ... end"; databases as [(Label)]
8. Node IDs must be alphanumeric with no spaces. Labels may contain spaces inside quotes/parens/brackets.
9. Every \\n in the JSON string is a real newline in the diagram. Do NOT use actual newlines in the JSON value.
10. Each diagram should be substantive (8–18 nodes) yet readable — model the real entities, actors, and flows from the data below, not generic examples.`,
      `Project: ${projectName}
System summary: ${s1.system_summary}
Actors: ${s1.actors?.join(", ")}
Key functional requirements:
${s2.requirements?.slice(0, 12).map((r: any) => `${r.id}: ${r.title} — ${r.description}`).join("\n")}
Screens (derive domain entities and interactions from these):
${s7.screens?.map((sc: any) => `${sc.name}${sc.description ? ` — ${sc.description}` : ""}`).join("\n")}`,
        emit,
        undefined,
        sanitizeUmlArtifact
      ),
      // Stage 10: UI Code Generation (multipass — needs S1, S2, S7)
      generateUICodeMultipass(projectId, projectName, s1, s2, s7, emit, cache.ui_code, opts.uiPreferences),
    ]);

    // Post-generation: quietly pull the wireframes into alignment with the UI
    // that was actually built, so the design artifact mirrors the real app.
    // Never blocks completion — failures leave the original wireframes in place.
    await deriveWireframesFromUI(projectId, { force: !!opts.force });

    await sql`UPDATE projects SET status = 'completed', updated_at = NOW() WHERE id = ${projectId}`;
  } catch (err) {
    await sql`UPDATE projects SET status = 'failed', updated_at = NOW() WHERE id = ${projectId}`;
    // Preserve the real message (a failed stage's Groq error, or the floor-check
    // guidance above) so the SSE error event can surface something actionable.
    throw err instanceof Error ? err : new Error("Pipeline failed");
  }
}
