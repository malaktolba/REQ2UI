import { useTheme } from "../context/ThemeContext";
import { SunIcon, MoonIcon } from "./Icons";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 light:text-slate-500 light:hover:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100 transition"
    >
      {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  );
}
