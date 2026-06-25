/**
 * Shared UI primitives — "Engineering Blueprint" design language.
 *
 * Everything here is built on the semantic design tokens defined in index.css
 * (canvas/surface/line/ink/muted + the cyan accent on the `indigo` scale), so a
 * single class set themes correctly in both light and dark with no `light:`
 * duplication. Prefer these over re-declaring button/card/input markup inline.
 */
import type { ReactNode, ButtonHTMLAttributes } from "react";

/* ---------------------------------------------------------------- utilities */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg " +
  "transition-colors duration-150 focus-visible:outline-none disabled:opacity-50 " +
  "disabled:cursor-not-allowed whitespace-nowrap";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-indigo-500 hover:bg-indigo-400 text-[#04181d] light:text-white font-semibold " +
    "shadow-[0_8px_24px_-8px_var(--color-indigo-500)]",
  secondary:
    "border border-line bg-surface/50 text-ink hover:border-indigo-500/60 " +
    "hover:bg-surface",
  ghost: "text-muted hover:text-ink hover:bg-surface",
  danger:
    "border border-red-500/40 text-red-400 hover:bg-red-500/10 " +
    "light:text-red-600 light:border-red-300 light:hover:bg-red-50",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
  lg: "text-base px-6 py-3.5",
};

/** Composable button class string — apply to <button> or a router <Link>. */
export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return cx(BASE, VARIANTS[variant], SIZES[size], extra);
}

/* ------------------------------------------------------------------ Button  */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className = "", ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...rest} />;
}

/* -------------------------------------------------------------------- Card  */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cx(
        "bg-surface border border-line rounded-xl",
        hover && "transition-colors hover:border-indigo-500/40",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge  */

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "mono-label inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded",
        "border border-line text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Kicker  */

/** Small monospace eyebrow label, blueprint-style: `// section`. */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("mono-label text-xs text-indigo-400 inline-flex items-center gap-2", className)}>
      <span className="h-px w-6 bg-indigo-500/60" />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Logo   */

export function Logo({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-2xl" };
  return (
    <span className={cx("font-display font-extrabold tracking-tight text-ink", sizes[size], className)}>
      Req<span className="text-indigo-400">2</span>UI
    </span>
  );
}

/* ------------------------------------------------------------ form controls */

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block mono-label text-[11px] text-muted mb-1.5">
      {children}
    </label>
  );
}

const FIELD =
  "w-full bg-surface-2 border border-line rounded-lg px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-faint focus:outline-none focus:border-indigo-500/70 " +
  "focus:ring-2 focus:ring-indigo-500/20 transition";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(FIELD, "resize-none leading-relaxed", props.className)} />;
}
