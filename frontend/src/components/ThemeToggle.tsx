import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon } from "./Icons";

export function ThemeToggle() {
  const { theme, isSystem, toggle, useSystem } = useTheme();

  return (
    <button
      onClick={(e) => {
        // Alt/Option-click reverts to following the OS preference.
        if (e.altKey) useSystem();
        else toggle();
      }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={
        isSystem
          ? `Following system (${theme}). Click to override · Alt-click resets to system`
          : `${theme} mode. Click to switch · Alt-click follows system`
      }
      className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition"
    >
      {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
      {isSystem && (
        <span
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400 ring-2 ring-canvas"
        />
      )}
    </button>
  );
}
