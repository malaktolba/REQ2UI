import type { UIPreferences } from "../types/project";

/**
 * Presentation config for the optional "UI Design Preferences" step. This is the
 * single source of truth for the choices the form renders and the human labels
 * used in summaries. To add a new theme/option, add an entry here (and a matching
 * prompt-guidance entry in the backend's config/uiPreferences.ts) — no component
 * changes required.
 */

export interface ThemeOption {
  id: string;
  label: string;
  /** Short bullet points shown on the theme card. */
  features: string[];
  /** Tailwind classes that paint a tiny visual preview swatch on the card. */
  previewClass: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: "modern-saas",
    label: "Modern SaaS",
    features: ["Clean layouts", "Soft shadows", "Rounded cards", "Professional colors"],
    previewClass: "bg-gradient-to-br from-indigo-500 to-violet-500",
  },
  {
    id: "minimal",
    label: "Minimal",
    features: ["Lots of whitespace", "Simple components", "Minimal decoration"],
    previewClass: "bg-white border border-slate-300",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    features: ["Dense information", "Tables", "Professional styling"],
    previewClass: "bg-gradient-to-br from-slate-600 to-slate-800",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    features: ["Analytics cards", "Charts", "Sidebar navigation"],
    previewClass: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    features: ["Mobile-first layouts", "Bottom navigation", "Touch-friendly"],
    previewClass: "bg-gradient-to-br from-sky-400 to-blue-600",
  },
  {
    id: "glassmorphism",
    label: "Glassmorphism",
    features: ["Blur effects", "Transparent cards", "Modern visuals"],
    previewClass: "bg-gradient-to-br from-fuchsia-400/70 to-cyan-400/70 backdrop-blur",
  },
  {
    id: "custom",
    label: "Custom",
    features: ["Describe your own", "Full control", "AI follows your brief"],
    previewClass: "bg-gradient-to-br from-amber-400 to-pink-500",
  },
];

export interface ChoiceOption {
  id: string;
  label: string;
}

/** Simple single-select option groups, keyed by the UIPreferences field. */
export const CHOICE_GROUPS: {
  field: keyof UIPreferences;
  label: string;
  options: ChoiceOption[];
}[] = [
  {
    field: "color_mode",
    label: "Color preference",
    options: [
      { id: "ai", label: "AI chooses" },
      { id: "light", label: "Light theme" },
      { id: "dark", label: "Dark theme" },
      { id: "custom", label: "Custom primary color" },
    ],
  },
  {
    field: "layout_density",
    label: "Layout density",
    options: [
      { id: "compact", label: "Compact" },
      { id: "balanced", label: "Balanced" },
      { id: "spacious", label: "Spacious" },
    ],
  },
  {
    field: "navigation",
    label: "Navigation",
    options: [
      { id: "sidebar", label: "Sidebar" },
      { id: "top", label: "Top navigation" },
      { id: "bottom", label: "Bottom (mobile)" },
    ],
  },
  {
    field: "content_style",
    label: "Content style",
    options: [
      { id: "cards", label: "Cards" },
      { id: "lists", label: "Lists" },
      { id: "tables", label: "Tables" },
      { id: "mixed", label: "Mixed" },
    ],
  },
  {
    field: "button_style",
    label: "Buttons",
    options: [
      { id: "rounded", label: "Rounded" },
      { id: "sharp", label: "Sharp" },
      { id: "pill", label: "Pill" },
    ],
  },
  {
    field: "card_style",
    label: "Cards",
    options: [
      { id: "flat", label: "Flat" },
      { id: "elevated", label: "Elevated" },
      { id: "glass", label: "Glass" },
    ],
  },
  {
    field: "animations",
    label: "Animations",
    options: [
      { id: "none", label: "None" },
      { id: "subtle", label: "Subtle" },
      { id: "rich", label: "Rich" },
    ],
  },
];

/** Human label for a stored preference value, for chips/summaries. */
export function labelFor(field: keyof UIPreferences, value?: string): string | null {
  if (!value) return null;
  if (field === "theme") return THEMES.find((t) => t.id === value)?.label ?? null;
  const group = CHOICE_GROUPS.find((g) => g.field === field);
  return group?.options.find((o) => o.id === value)?.label ?? null;
}

/**
 * Builds the "Your UI will be generated with…" summary lines from preferences.
 * Returns [] when nothing meaningful is set (AI-chooses color mode is ignored),
 * letting callers fall back to the "AI will choose" message.
 */
export function summarizePreferences(prefs?: UIPreferences | null): string[] {
  if (!prefs) return [];
  const lines: string[] = [];
  const add = (field: keyof UIPreferences, suffix = "") => {
    const value = prefs[field];
    if (field === "color_mode" && value === "ai") return;
    const label = labelFor(field, value);
    if (label) lines.push(`${label}${suffix}`);
  };

  add("theme", " theme");
  if (prefs.color_mode === "custom" && prefs.primary_color?.trim()) {
    lines.push(`Custom color ${prefs.primary_color.trim()}`);
  } else {
    add("color_mode");
  }
  add("navigation", " navigation");
  add("layout_density", " layout");
  add("content_style", " content");
  add("button_style", " buttons");
  add("card_style", " cards");
  add("animations", " animations");
  if (prefs.custom_instructions?.trim()) lines.push("Custom design instructions");
  return lines;
}

/** Drops blank fields and the no-op "AI chooses" color mode before persisting. */
export function cleanPreferences(prefs: UIPreferences): UIPreferences {
  const out: UIPreferences = {};
  for (const [k, v] of Object.entries(prefs) as [keyof UIPreferences, string | undefined][]) {
    if (typeof v !== "string" || !v.trim()) continue;
    if (k === "color_mode" && v === "ai") continue;
    out[k] = v.trim();
  }
  return out;
}
