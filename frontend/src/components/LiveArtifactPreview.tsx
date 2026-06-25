import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fetchArtifact } from "../api/projects";
import type { PipelineStage } from "../types/project";

/* Map each pipeline stage to the artifact type it persists. */
const STAGE_TYPE: Record<number, string> = {
  1: "extraction",
  2: "functional_requirements",
  3: "non_functional_requirements",
  4: "security_requirements",
  5: "functional_test_cases",
  6: "security_test_cases",
  7: "wireframes",
  8: "traceability_matrix",
  9: "uml_diagrams",
  10: "ui_code",
};

interface Preview {
  kind: string;
  count?: number;
  items: string[];
}

/** Pull a compact, human-readable peek out of whatever shape the artifact has. */
function summarize(type: string, content: any): Preview {
  if (!content) return { kind: type, items: [] };
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  switch (type) {
    case "extraction": {
      const actors = arr(content.actors);
      return {
        kind: "Actors identified",
        count: actors.length,
        items: actors.slice(0, 4).map((a: string) => a),
      };
    }
    case "functional_requirements":
    case "non_functional_requirements":
    case "security_requirements": {
      const reqs = arr(content.requirements);
      return {
        kind: "Requirements drafted",
        count: reqs.length,
        items: reqs.slice(0, 3).map((r: any) => `${r.id ?? "REQ"} · ${r.title ?? ""}`.trim()),
      };
    }
    case "functional_test_cases":
    case "security_test_cases": {
      const tcs = arr(content.test_cases);
      return {
        kind: "Test cases written",
        count: tcs.length,
        items: tcs.slice(0, 3).map((t: any) => `${t.id ?? "TC"} · ${t.title ?? t.objective ?? ""}`.trim()),
      };
    }
    case "wireframes": {
      const sc = arr(content.screens);
      return {
        kind: "Screens sketched",
        count: sc.length,
        items: sc.slice(0, 3).map((s: any) => `${s.name ?? s.id}${s.route ? ` · ${s.route}` : ""}`),
      };
    }
    case "traceability_matrix": {
      const rows = arr(content.matrix ?? content.links ?? content.rows ?? content.entries);
      return { kind: "Traceability links mapped", count: rows.length, items: [] };
    }
    case "uml_diagrams": {
      const d = arr(content.diagrams);
      return {
        kind: "UML diagrams drawn",
        count: d.length,
        items: d.slice(0, 3).map((x: any) => x.title ?? x.name ?? x.type ?? "diagram"),
      };
    }
    case "ui_code": {
      const sc = arr(content.screens);
      return {
        kind: "UI screens generated",
        count: sc.length || undefined,
        items: sc.slice(0, 3).map((s: any) => s.name ?? s.title ?? s.id ?? "screen"),
      };
    }
    default:
      return { kind: type, items: [] };
  }
}

/**
 * Shows a compact, animated peek at the artifact each stage produces, fetched
 * as that stage completes. Turns the wait into anticipation of real output —
 * decoupled from the SSE stream, so it never affects the generation itself.
 */
export function LiveArtifactPreview({
  projectId,
  stages,
}: {
  projectId: string;
  stages: PipelineStage[];
}) {
  const [preview, setPreview] = useState<{ stage: number; name: string; data: Preview } | null>(null);
  const fetchedFor = useRef<number>(-1);

  // Highest-numbered stage that has completed (its artifact is freshest).
  const latest = stages.reduce(
    (max, s) => (s.status === "completed" && s.stage > max ? s.stage : max),
    0
  );

  useEffect(() => {
    if (latest <= 0 || latest === fetchedFor.current) return;
    const type = STAGE_TYPE[latest];
    if (!type) return;
    fetchedFor.current = latest;
    const name = stages.find((s) => s.stage === latest)?.name ?? "";
    let cancelled = false;
    fetchArtifact(projectId, type)
      .then((a) => {
        if (cancelled) return;
        setPreview({ stage: latest, name, data: summarize(type, a.content) });
      })
      .catch(() => {
        /* preview is best-effort — ignore fetch misses */
      });
    return () => {
      cancelled = true;
    };
  }, [latest, projectId, stages]);

  if (!preview) return null;

  const { data } = preview;

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="mono-label text-[9px] text-faint">just generated</span>
        <span className="h-px flex-1 bg-line" />
        <span className="mono-label text-[9px] text-indigo-400 tabular-nums">
          stage {preview.stage}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={preview.stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.16, 0.84, 0.24, 1] }}
        >
          <div className="flex items-baseline gap-2 mb-2">
            {data.count != null && (
              <span className="font-display font-black text-2xl text-indigo-400 tabular-nums leading-none">
                {data.count}
              </span>
            )}
            <span className="text-sm font-semibold text-ink">{data.kind}</span>
          </div>

          {data.items.length > 0 && (
            <ul className="space-y-1.5">
              {data.items.map((item, i) => (
                <motion.li
                  key={item + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex items-start gap-2 text-xs text-muted"
                >
                  <span className="mt-1 w-1 h-1 rounded-full bg-indigo-500/70 flex-shrink-0" />
                  <span className="truncate">{item}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
