import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";
interface ThemeCtx {
  theme: Theme;
  /** True when the theme is following the OS preference (no explicit choice). */
  isSystem: boolean;
  /** Flip dark/light. Persists the choice as an explicit override. */
  toggle: () => void;
  /** Forget the explicit choice and snap back to the OS preference. */
  useSystem: () => void;
}

const STORAGE_KEY = "req2ui-theme";
const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  isSystem: true,
  toggle: () => {},
  useSystem: () => {},
});

const prefersLight = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: light)").matches;

function systemTheme(): Theme {
  return prefersLight() ? "light" : "dark";
}

/** Read an explicit choice, or null when the user hasn't picked one. */
function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // No explicit choice → follow the OS. An explicit choice wins.
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());
  const [isSystem, setIsSystem] = useState<boolean>(() => storedTheme() === null);

  // Apply the resolved theme to <html> and keep the address-bar colour in sync.
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f5f8fc" : "#06b6d4");
  }, [theme]);

  // While following the OS, react to the user changing their system theme live.
  useEffect(() => {
    if (!isSystem) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [isSystem]);

  const toggle = () => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      return next;
    });
    setIsSystem(false);
  };

  const useSystem = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setIsSystem(true);
    setTheme(systemTheme());
  };

  return (
    <Ctx.Provider value={{ theme, isSystem, toggle, useSystem }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);
