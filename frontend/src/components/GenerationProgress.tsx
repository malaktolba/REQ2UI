import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  useReducedMotion,
} from "motion/react";
import type { PipelineStage } from "../types/project";

/** Flavour copy shown for the stage that's currently running. */
const STAGE_BLURB: Record<number, string> = {
  1: "Reading your description — pulling out actors, goals, and scope.",
  2: "Drafting functional requirements to the IEEE 830 standard.",
  3: "Specifying non-functional requirements — performance, usability, reliability.",
  4: "Hardening the spec against the OWASP Top 10.",
  5: "Writing functional test cases (IEEE 829).",
  6: "Designing security test cases for the threat model.",
  7: "Sketching wireframe descriptions for each screen.",
  8: "Cross-referencing everything into a traceability matrix.",
  9: "Drawing UML diagrams — use case, class, and sequence.",
  10: "Generating live UI code — design system, then each screen.",
};

/** Rotating reassurance shown while the pipeline churns. */
const TIPS = [
  "A full run touches ten AI stages — hang tight.",
  "Each artifact is cross-referenced for traceability.",
  "UI code generation is the heaviest stage — it's worth the wait.",
  "Everything here exports to PDF, DOCX, LaTeX, or CSV.",
  "Requirements follow the IEEE 830-1998 structure.",
  "Diagrams render as interactive Mermaid visuals.",
];

function useElapsed(active: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function ProgressRing({ pct }: { pct: number }) {
  const reduce = useReducedMotion();
  const R = 50;
  const C = 2 * Math.PI * R;
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, pct * 100, {
      duration: reduce ? 0 : 0.7,
      ease: [0.16, 0.84, 0.24, 1],
    });
    return () => controls.stop();
  }, [pct, count, reduce]);

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
        <motion.circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="var(--color-indigo-500)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 0.84, 0.24, 1] }}
          style={{ filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--color-indigo-500) 55%, transparent))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline font-display font-black text-[26px] tabular-nums leading-none tracking-tight">
          <motion.span>{rounded}</motion.span>
          <span className="text-indigo-400 text-base font-bold ml-0.5">%</span>
        </div>
        <span className="mono-label text-[8px] text-faint mt-2 tracking-[0.2em]">complete</span>
      </div>
    </div>
  );
}

/**
 * Animated, non-boring hero for an in-progress (or just-finished) pipeline run:
 * a count-up progress ring, elapsed timer, the active stage, and rotating tips.
 */
export function GenerationProgress({
  stages,
  generating,
}: {
  stages: PipelineStage[];
  generating: boolean;
}) {
  const total = stages.length || 1;
  const done = stages.filter((s) => s.status === "completed").length;
  const pct = done / total;
  const running = stages.find((s) => s.status === "running");
  const failed = stages.find((s) => s.status === "failed");
  const finished = !generating && done === total && total > 0;
  const elapsed = useElapsed(generating);

  // Rotate tips every few seconds while actively generating.
  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(t);
  }, [generating]);

  const headline = failed
    ? "Generation interrupted"
    : finished
    ? "All artifacts generated"
    : running
    ? running.name
    : "Starting pipeline…";

  const sub = failed
    ? "One stage failed — see the error below. Already-generated artifacts are kept."
    : finished
    ? "Your full SRS package is ready to view and export."
    : running
    ? STAGE_BLURB[running.stage] ?? "Working…"
    : "Spinning up the ten-stage pipeline.";

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-surface to-surface-2/40 p-5 mb-4">
      <div className="flex items-center gap-5">
        <ProgressRing pct={pct} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="mono-label text-[10px] text-faint">
              stage {Math.min(done + (generating ? 1 : 0), total)} / {total}
            </span>
            {generating && (
              <span className="mono-label text-[10px] text-indigo-400 tabular-nums flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                {elapsed}
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.h3
              key={headline}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className={`font-semibold text-base leading-snug truncate ${
                failed ? "text-red-400" : finished ? "text-indigo-400" : "text-ink"
              } ${running && generating ? "shimmer" : ""}`}
            >
              {headline}
            </motion.h3>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={sub}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-muted text-sm leading-relaxed mt-0.5"
            >
              {sub}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* rotating tip strip — only while actively working */}
      {generating && !failed && (
        <div className="mt-4 pt-3 border-t border-line/70 flex items-center gap-2 overflow-hidden">
          <span className="mono-label text-[9px] text-faint flex-shrink-0">tip</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={tip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-xs text-muted truncate"
            >
              {TIPS[tip]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
