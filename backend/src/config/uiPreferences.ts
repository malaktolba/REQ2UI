/**
 * UI Design Preferences — structured, optional design constraints captured at
 * project-creation time and fed into the Stage 10 UI-code generation prompts.
 *
 * Everything here is data-driven: each preference value maps to a short natural-
 * language design instruction. To add a new theme/option, add an entry to the
 * relevant map — no pipeline code changes required. All fields are optional; an
 * empty/absent preferences object yields an empty prompt block, so the AI keeps
 * its current "choose an appropriate design" behaviour (backward compatible).
 */

export interface UIPreferences {
  /** High-level visual archetype, e.g. "modern-saas". */
  theme?: string;
  /** "ai" (let the model decide), "light", "dark", or "custom". */
  color_mode?: string;
  /** Hex colour used when color_mode === "custom". */
  primary_color?: string;
  /** Information density: "compact" | "balanced" | "spacious". */
  layout_density?: string;
  /** Primary navigation: "sidebar" | "top" | "bottom". */
  navigation?: string;
  /** Dominant content presentation: "cards" | "lists" | "tables" | "mixed". */
  content_style?: string;
  /** Button shape: "rounded" | "sharp" | "pill". */
  button_style?: string;
  /** Card treatment: "flat" | "elevated" | "glass". */
  card_style?: string;
  /** Motion level: "none" | "subtle" | "rich". */
  animations?: string;
  /** Free-form design direction from the user. */
  custom_instructions?: string;
}

/** Allowed values per field — also used by the route validator. */
export const UI_PREFERENCE_OPTIONS = {
  theme: ["modern-saas", "minimal", "enterprise", "dashboard", "mobile-app", "glassmorphism", "custom"],
  color_mode: ["ai", "light", "dark", "custom"],
  layout_density: ["compact", "balanced", "spacious"],
  navigation: ["sidebar", "top", "bottom"],
  content_style: ["cards", "lists", "tables", "mixed"],
  button_style: ["rounded", "sharp", "pill"],
  card_style: ["flat", "elevated", "glass"],
  animations: ["none", "subtle", "rich"],
} as const;

const THEME_GUIDANCE: Record<string, string> = {
  "modern-saas":
    "Modern SaaS aesthetic — clean layouts, soft shadows, generously rounded cards, and a polished, professional colour palette.",
  minimal:
    "Minimalist aesthetic — abundant whitespace, simple components, very little decoration, restrained borders and colour.",
  enterprise:
    "Enterprise aesthetic — dense, information-rich screens, data tables, conservative professional styling, compact spacing.",
  dashboard:
    "Analytics dashboard aesthetic — metric/stat cards, charts and graphs, a persistent sidebar, and a data-forward layout.",
  "mobile-app":
    "Mobile-app aesthetic — mobile-first single-column layouts, a bottom navigation bar, and large touch-friendly controls.",
  glassmorphism:
    "Glassmorphism aesthetic — frosted-glass translucent surfaces (backdrop-blur), subtle gradients, soft glows, and layered depth.",
  custom: "", // direction comes entirely from custom_instructions
};

const COLOR_GUIDANCE: Record<string, string> = {
  light: "Use a LIGHT theme: light page background with dark text and subtle borders.",
  dark: "Use a DARK theme: dark page background with light text.",
};

const DENSITY_GUIDANCE: Record<string, string> = {
  compact: "Compact spacing — tighter padding and gaps to fit more on screen.",
  balanced: "Balanced spacing — comfortable, conventional padding.",
  spacious: "Spacious spacing — generous padding and whitespace, room to breathe.",
};

const NAVIGATION_GUIDANCE: Record<string, string> = {
  sidebar: "Use a vertical SIDEBAR for primary navigation.",
  top: "Use a horizontal TOP navigation bar for primary navigation.",
  bottom: "Use a fixed BOTTOM navigation bar (mobile-style) for primary navigation.",
};

const CONTENT_GUIDANCE: Record<string, string> = {
  cards: "Present content primarily as cards.",
  lists: "Present content primarily as lists/rows.",
  tables: "Present content primarily as data tables.",
  mixed: "Mix cards, lists, and tables as best fits each screen.",
};

const BUTTON_GUIDANCE: Record<string, string> = {
  rounded: "Buttons: moderately rounded corners (rounded-lg).",
  sharp: "Buttons: sharp, square corners (no border radius).",
  pill: "Buttons: fully pill-shaped (rounded-full).",
};

const CARD_GUIDANCE: Record<string, string> = {
  flat: "Cards: flat — no shadow, rely on borders/background.",
  elevated: "Cards: elevated with visible drop shadows.",
  glass: "Cards: translucent frosted-glass with backdrop-blur.",
};

const ANIMATION_GUIDANCE: Record<string, string> = {
  none: "Animations: none — keep the interface static.",
  subtle: "Animations: subtle hover/focus transitions only.",
  rich: "Animations: rich, smooth transitions and tasteful micro-interactions.",
};

/** True when the user actually expressed at least one preference. */
export function hasUIPreferences(prefs?: UIPreferences | null): boolean {
  if (!prefs) return false;
  return Object.entries(prefs).some(([k, v]) => {
    if (typeof v !== "string") return false;
    const t = v.trim();
    if (!t) return false;
    // "ai" color mode means "let the AI decide" — not an expressed preference.
    if (k === "color_mode" && t === "ai") return false;
    return true;
  });
}

/**
 * Renders the preferences as a prompt block of design constraints for Stage 10.
 * Returns "" when no meaningful preference is set, so callers can simply append
 * it and fall back to default behaviour when the user opted out.
 */
export function uiPreferencesPromptBlock(prefs?: UIPreferences | null): string {
  if (!hasUIPreferences(prefs)) return "";
  const p = prefs as UIPreferences;
  const lines: string[] = [];

  if (p.theme && THEME_GUIDANCE[p.theme]) lines.push(`Overall style: ${THEME_GUIDANCE[p.theme]}`);

  if (p.color_mode === "custom" && p.primary_color?.trim()) {
    lines.push(`Use ${p.primary_color.trim()} as the primary brand/accent colour throughout.`);
  } else if (p.color_mode && COLOR_GUIDANCE[p.color_mode]) {
    lines.push(COLOR_GUIDANCE[p.color_mode]);
  }

  if (p.layout_density && DENSITY_GUIDANCE[p.layout_density]) lines.push(DENSITY_GUIDANCE[p.layout_density]);
  if (p.navigation && NAVIGATION_GUIDANCE[p.navigation]) lines.push(NAVIGATION_GUIDANCE[p.navigation]);
  if (p.content_style && CONTENT_GUIDANCE[p.content_style]) lines.push(CONTENT_GUIDANCE[p.content_style]);
  if (p.button_style && BUTTON_GUIDANCE[p.button_style]) lines.push(BUTTON_GUIDANCE[p.button_style]);
  if (p.card_style && CARD_GUIDANCE[p.card_style]) lines.push(CARD_GUIDANCE[p.card_style]);
  if (p.animations && ANIMATION_GUIDANCE[p.animations]) lines.push(ANIMATION_GUIDANCE[p.animations]);

  if (p.custom_instructions?.trim()) {
    lines.push(`Additional direction from the user (HIGH priority): ${p.custom_instructions.trim()}`);
  }

  if (!lines.length) return "";
  return (
    `\n\nUSER UI DESIGN PREFERENCES — treat these as hard design constraints. ` +
    `Where they conflict with the default styling rules above, the user's preferences win:\n` +
    lines.map((l) => `- ${l}`).join("\n")
  );
}
