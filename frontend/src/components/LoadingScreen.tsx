import { Logo } from "./ui";

/**
 * Branded full-screen loader. Replaces the bare spinner so route/data loads
 * feel intentional and on-brand (blueprint grid + sweeping accent bar).
 */
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-7 px-6">
      <div className="animate-fade-up">
        <Logo />
      </div>

      {/* sweeping indeterminate bar */}
      <div className="relative w-40 h-px bg-line overflow-hidden rounded-full">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-indigo-400 rounded-full animate-loadbar" />
      </div>

      <div className="mono-label text-[10px] text-faint flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
        {label}
        <span className="animate-blink">…</span>
      </div>
    </div>
  );
}
