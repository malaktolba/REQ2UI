import type { UIPreferences } from "../types/project";
import { THEMES, CHOICE_GROUPS } from "../config/uiPreferences";
import { CheckIcon } from "./Icons";

/**
 * Controlled editor for the optional UI design preferences. Fully data-driven
 * from config/uiPreferences.ts — themes and option groups render from there, so
 * adding a choice never touches this component.
 */
export function UIPreferencesForm({
  value,
  onChange,
}: {
  value: UIPreferences;
  onChange: (next: UIPreferences) => void;
}) {
  const set = (field: keyof UIPreferences) => (v: string) =>
    onChange({ ...value, [field]: value[field] === v ? undefined : v });

  return (
    <div className="space-y-6">
      {/* 1. Design theme */}
      <div>
        <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-2">Design theme</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {THEMES.map((t) => {
            const active = value.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => set("theme")(t.id)}
                className={`relative text-left rounded-xl border p-3 transition ${
                  active
                    ? "border-indigo-500 bg-indigo-500/10 light:bg-indigo-50"
                    : "border-slate-700 light:border-slate-300 bg-slate-800/50 light:bg-white hover:border-slate-600 light:hover:border-slate-400"
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 text-indigo-400 light:text-indigo-600">
                    <CheckIcon size={14} />
                  </span>
                )}
                <span className={`block h-8 w-full rounded-md mb-2 ${t.previewClass}`} />
                <span className="block text-sm font-medium text-slate-200 light:text-slate-800">{t.label}</span>
                <ul className="mt-1 space-y-0.5">
                  {t.features.map((f) => (
                    <li key={f} className="text-[11px] leading-tight text-slate-500 light:text-slate-500">
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2–4. Choice groups (color, layout, navigation, content, components, animations) */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        {CHOICE_GROUPS.map((group) => (
          <div key={group.field}>
            <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-1.5">{group.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {group.options.map((opt) => {
                const active = value[group.field] === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set(group.field)(opt.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      active
                        ? "border-indigo-500 bg-indigo-500/15 light:bg-indigo-50 text-indigo-300 light:text-indigo-700"
                        : "border-slate-700 light:border-slate-300 bg-slate-800/50 light:bg-white text-slate-400 light:text-slate-600 hover:border-slate-600 light:hover:border-slate-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Custom primary color picker, shown only for the color group. */}
            {group.field === "color_mode" && value.color_mode === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={value.primary_color || "#6366f1"}
                  onChange={(e) => onChange({ ...value, primary_color: e.target.value })}
                  className="h-8 w-10 rounded border border-slate-700 light:border-slate-300 bg-transparent cursor-pointer"
                  aria-label="Primary color"
                />
                <input
                  type="text"
                  value={value.primary_color ?? ""}
                  onChange={(e) => onChange({ ...value, primary_color: e.target.value })}
                  placeholder="#6366f1"
                  maxLength={40}
                  className="w-28 bg-slate-800/80 light:bg-white border border-slate-700 light:border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-200 light:text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 5. Custom design instructions */}
      <div>
        <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-1.5">Custom design instructions</p>
        <textarea
          rows={3}
          maxLength={2000}
          value={value.custom_instructions ?? ""}
          onChange={(e) => onChange({ ...value, custom_instructions: e.target.value })}
          placeholder="Describe the style you want… e.g. “A dark fintech dashboard like a modern banking app, with smooth animations and clean typography.”"
          className="w-full bg-slate-800/80 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-200 light:text-slate-800 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
        />
      </div>
    </div>
  );
}

/** Compact "Your UI will be generated with…" summary card. */
export function UIPreferencesSummary({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="rounded-xl border border-indigo-500/30 light:border-indigo-200 bg-indigo-500/5 light:bg-indigo-50/60 px-4 py-3">
      <p className="text-xs font-medium text-slate-300 light:text-slate-700 mb-1.5">
        Your UI will be generated with:
      </p>
      <ul className="space-y-0.5">
        {lines.map((l) => (
          <li key={l} className="flex items-center gap-1.5 text-xs text-slate-400 light:text-slate-600">
            <CheckIcon size={13} className="text-indigo-400 light:text-indigo-600 flex-shrink-0" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
