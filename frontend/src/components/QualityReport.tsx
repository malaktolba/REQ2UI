import { useState, useEffect } from "react";
import { runEvaluation, fetchEvaluation } from "../api/evaluation";
import { errorMessage } from "../api/projects";
import type { StoredEvaluation, ArtifactScore, EvaluationReport } from "../types/evaluation";
import { useToast } from "../context/ToastContext";
import { CheckIcon, XIcon } from "./Icons";

// ─── score → colour helpers ──────────────────────────────────────────────────

function scoreColor(pct: number | null): string {
  if (pct == null) return "text-slate-500";
  if (pct >= 85) return "text-green-400 light:text-green-600";
  if (pct >= 70) return "text-indigo-400 light:text-indigo-600";
  if (pct >= 55) return "text-yellow-400 light:text-yellow-600";
  return "text-red-400 light:text-red-600";
}

function barColor(pct: number | null): string {
  if (pct == null) return "bg-slate-600";
  if (pct >= 85) return "bg-green-500";
  if (pct >= 70) return "bg-indigo-500";
  if (pct >= 55) return "bg-yellow-500";
  return "bg-red-500";
}

// ─── overall score ring ──────────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const stroke =
    score >= 85 ? "#22c55e" : score >= 70 ? "#6366f1" : score >= 55 ? "#eab308" : "#ef4444";
  return (
    <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-800 light:text-slate-200" />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke={stroke} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white light:text-slate-900">{score}%</span>
        <span className="text-xs font-medium text-slate-400 light:text-slate-500 mt-0.5">{grade}</span>
      </div>
    </div>
  );
}

// ─── per-artifact card ───────────────────────────────────────────────────────

function ArtifactCard({ a }: { a: ArtifactScore }) {
  const [open, setOpen] = useState(false);
  const pct = a.percentage;
  return (
    <div className="bg-slate-900 light:bg-white border border-slate-800 light:border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-slate-800/40 light:hover:bg-slate-50 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm font-semibold text-slate-200 light:text-slate-800 flex items-center gap-2">
              {a.evaluated && pct != null && pct >= 70 ? (
                <CheckIcon size={14} className="text-green-400 flex-shrink-0" />
              ) : !a.evaluated ? (
                <span className="text-slate-600 flex-shrink-0">—</span>
              ) : (
                <span className={`${scoreColor(pct)} flex-shrink-0`}>•</span>
              )}
              {a.label}
              <span className="text-xs font-normal text-slate-600 light:text-slate-400">· {Math.round(a.weight * 100)}% of total</span>
            </span>
            <span className={`text-sm font-bold ${scoreColor(pct)}`}>
              {pct == null ? "N/A" : `${pct}%`}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 light:bg-slate-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${barColor(pct)}`} style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
        <span className={`text-slate-500 text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800 light:border-slate-200 space-y-4">
          {!a.evaluated && (
            <p className="text-xs text-slate-500">{a.issues[0] ?? "Not evaluated."}</p>
          )}

          {/* Criteria breakdown */}
          {a.evaluated && a.criteria.length > 0 && (
            <div className="space-y-2 pt-3">
              {a.criteria.map((c) => (
                <div key={c.key} className="text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-slate-400 light:text-slate-600">{c.label}</span>
                    <span className="text-slate-500 font-mono">{c.score ?? "—"}/5</span>
                  </div>
                  {c.justification && <p className="text-slate-600 light:text-slate-400 leading-relaxed">{c.justification}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Strengths */}
          {a.strengths.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-green-500/80 mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {a.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 light:text-slate-700 flex gap-2">
                    <CheckIcon size={12} className="text-green-500 flex-shrink-0 mt-0.5" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issues */}
          {a.evaluated && a.issues.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-red-500/80 mb-1.5">Issues</p>
              <ul className="space-y-1">
                {a.issues.map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 light:text-slate-700 flex gap-2">
                    <XIcon size={12} className="text-red-500 flex-shrink-0 mt-0.5" />{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── report body ─────────────────────────────────────────────────────────────

export function ReportView({ report }: { report: EvaluationReport }) {
  const order: (keyof EvaluationReport["scores"])[] = ["srs", "ui", "uml", "tests"];
  return (
    <div className="space-y-6">
      {/* Overall */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-900/40 light:from-slate-50 light:to-white border border-slate-800 light:border-slate-200 rounded-2xl p-6 flex items-center gap-6 flex-wrap">
        <ScoreRing score={report.overallScore} grade={report.grade} />
        <div className="flex-1 min-w-[200px]">
          <h3 className="text-lg font-bold text-white light:text-slate-900 mb-1">Generation Quality</h3>
          <p className="text-sm text-slate-400 light:text-slate-600 mb-4">
            AI-judged across {order.filter((k) => report.scores[k]?.evaluated).length} artifact dimensions using GEval.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {order.map((k) => {
              const a = report.scores[k];
              if (!a) return null;
              return (
                <div key={k} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-400 light:text-slate-600 flex items-center gap-1.5">
                    {a.evaluated && a.percentage != null && a.percentage >= 70 && <span className="text-green-500">✓</span>}
                    {a.label}
                  </span>
                  <span className={`font-semibold ${scoreColor(a.percentage)}`}>
                    {a.percentage == null ? "N/A" : `${a.percentage}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-artifact cards */}
      <div className="space-y-3">
        {order.map((k) => report.scores[k] && <ArtifactCard key={k} a={report.scores[k]} />)}
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-indigo-500/5 light:bg-indigo-50 border border-indigo-500/20 light:border-indigo-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-indigo-300 light:text-indigo-700 mb-3 flex items-center gap-2">
            <span>✦</span> AI Suggestions
          </h3>
          <ul className="space-y-2">
            {report.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-slate-300 light:text-slate-700 flex gap-2.5">
                <span className="text-indigo-400 flex-shrink-0">→</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-600 light:text-slate-400 text-center">
        Evaluated {new Date(report.generatedAt).toLocaleString()} · rubric {report.version}
      </p>
    </div>
  );
}

// ─── container ───────────────────────────────────────────────────────────────

export function QualityReport({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [evaluation, setEvaluation] = useState<StoredEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchEvaluation(projectId)
      .then((e) => { if (!cancelled) setEvaluation(e); })
      .catch(() => { /* none yet */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  async function handleRun() {
    setRunning(true);
    try {
      const e = await runEvaluation(projectId);
      setEvaluation(e);
      toast.success("Quality evaluation complete.");
    } catch (err) {
      toast.error(errorMessage(err, "Evaluation failed."));
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-white light:text-slate-900">AI Quality Report</h2>
          <p className="text-xs text-slate-500">LLM-as-a-Judge (GEval) assessment of the generated artifacts.</p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              Evaluating…
            </>
          ) : evaluation ? "↻ Re-evaluate" : "Run evaluation"}
        </button>
      </div>

      {evaluation ? (
        <ReportView report={evaluation.report} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">✦</div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 light:text-slate-900 mb-1">No evaluation yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Run a GEval quality assessment to score the SRS, UI, UML, and test cases, and get improvement suggestions.
            </p>
          </div>
          {!running && (
            <button onClick={handleRun} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/30">
              Run evaluation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
