import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo, Kicker, Card } from "../components/ui";
import { StatusBadge } from "../components/StatusBadge";
import { ReportView } from "../components/QualityReport";
import {
  fetchAdminStats,
  fetchProjectEvaluation,
  fetchProjectEvaluations,
  runProjectEvaluation,
} from "../api/admin";
import type { AdminStats } from "../types/admin";
import type { StoredEvaluation } from "../types/evaluation";
import type { ProjectStatus } from "../types/project";

/* --------------------------------------------------------------- helpers */

function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function scoreTone(score: number | null): string {
  if (score == null) return "text-faint";
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-indigo-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-indigo-500",
  generating: "bg-amber-400",
  pending: "bg-slate-500",
  failed: "bg-red-500",
};

/* ------------------------------------------------------------ stat cards */

function StatCard({
  label,
  value,
  sub,
  tone = "text-ink",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <Card className="p-4">
      <div className="mono-label text-[10px] text-faint mb-2">{label}</div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight ${tone}`}>{value}</div>
      {sub && <div className="mono-label text-[10px] text-muted mt-1">{sub}</div>}
    </Card>
  );
}

/** Horizontal labelled bar — used for per-stage timing and grade/status splits. */
function Bar({
  label,
  value,
  max,
  display,
  color = "bg-indigo-500",
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 flex-shrink-0 text-xs text-muted truncate" title={label}>
        {label}
      </div>
      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 flex-shrink-0 text-right mono-label text-[10px] text-muted tabular-nums">
        {display}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- geval report modal */

function ReportModal({
  project,
  onClose,
}: {
  project: { id: string; name: string };
  onClose: () => void;
}) {
  const [history, setHistory] = useState<StoredEvaluation[] | null>(null);
  const [selected, setSelected] = useState<StoredEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [latest, hist] = await Promise.all([
        fetchProjectEvaluation(project.id),
        fetchProjectEvaluations(project.id),
      ]);
      setHistory(hist);
      setSelected(latest ?? hist[0] ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const fresh = await runProjectEvaluation(project.id);
      setSelected(fresh);
      setHistory((h) => [fresh, ...(h ?? [])]);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Evaluation failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-line rounded-2xl w-full max-w-3xl my-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line sticky top-0 bg-canvas/95 backdrop-blur rounded-t-2xl">
          <div className="min-w-0">
            <div className="mono-label text-[10px] text-indigo-400">// geval report</div>
            <h2 className="text-sm font-bold truncate">{project.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {history && history.length > 1 && selected && (
              <select
                value={selected.id}
                onChange={(e) => setSelected(history.find((h) => h.id === e.target.value) ?? selected)}
                className="bg-surface-2 border border-line rounded-lg text-xs text-ink px-2 py-1.5 focus:outline-none"
              >
                {history.map((h) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.created_at).toLocaleString("en-GB")} · {h.overall_score}%
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleRun}
              disabled={running}
              className="mono-label text-[10px] px-2.5 py-1.5 rounded-lg border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 transition"
            >
              {running ? "Running…" : selected ? "↻ Re-run" : "Run eval"}
            </button>
            <button
              onClick={onClose}
              className="mono-label text-[10px] px-2.5 py-1.5 rounded-lg border border-line text-faint hover:text-ink transition"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-5">
          {error && (
            <div className="text-red-400 text-sm py-2 mb-4 border-l-2 border-red-500/60 pl-3">{error}</div>
          )}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selected ? (
            <ReportView report={selected.report} />
          ) : (
            <div className="text-center py-16 text-muted text-sm">
              No evaluation has run for this project yet.
              {running && " Generating…"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await fetchAdminStats();
        if (alive) setStats(data);
      } catch (err: any) {
        if (alive) setError(err?.response?.data?.error ?? "Failed to load analytics");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const maxStage = stats ? Math.max(1, ...stats.timing.perStage.map((s) => s.avgSeconds)) : 1;
  const maxStatus = stats ? Math.max(1, ...stats.projectsByStatus.map((s) => s.count)) : 1;
  const maxGrade = stats ? Math.max(1, ...stats.geval.gradeDistribution.map((g) => g.count)) : 1;

  return (
    <div className="min-h-screen text-ink flex flex-col">
      <header className="border-b border-line bg-canvas/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/"><Logo size="sm" /></Link>
          <div className="flex items-center gap-3">
            <span className="mono-label text-[10px] text-indigo-400 hidden sm:block">admin</span>
            <span className="mono-label text-[10px] text-muted hidden sm:block">{user?.name}</span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="mono-label text-[10px] text-faint hover:text-ink transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 flex-1 w-full">
        <Kicker className="mb-3">admin · analytics</Kicker>
        <div className="flex items-center justify-between gap-3 mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Platform analytics</h1>
          {stats && (
            <span className="mono-label text-[10px] text-faint">
              as of {new Date(stats.generatedAt).toLocaleString("en-GB")}
            </span>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-sm py-3 mb-6 border-l-2 border-red-500/60 pl-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-2/50 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="space-y-10">
            {/* headline stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Total users"
                value={stats.totals.users.toLocaleString()}
                sub={`+${stats.totals.newUsers7d} this week · ${stats.totals.admins} admin`}
              />
              <StatCard
                label="Projects run"
                value={stats.totals.projects.toLocaleString()}
                sub={`+${stats.totals.newProjects7d} this week`}
              />
              <StatCard
                label="Avg GEval accuracy"
                value={stats.geval.avgScore == null ? "—" : `${stats.geval.avgScore}%`}
                sub={`${stats.geval.evaluatedProjects} evaluated`}
                tone={scoreTone(stats.geval.avgScore)}
              />
              <StatCard
                label="Avg generation time"
                value={fmtDuration(stats.timing.avgSeconds)}
                sub={`${stats.timing.timedProjects} timed runs`}
              />
              <StatCard label="Artifacts generated" value={stats.totals.artifacts.toLocaleString()} />
              <StatCard label="Evaluations run" value={stats.totals.evaluations.toLocaleString()} />
              <StatCard
                label="Deleted projects"
                value={stats.totals.deletedProjects.toLocaleString()}
              />
              <StatCard
                label="GEval range"
                value={
                  stats.geval.minScore == null
                    ? "—"
                    : `${stats.geval.minScore}–${stats.geval.maxScore}%`
                }
              />
            </div>

            {/* GEval + timing detail */}
            <div className="grid md:grid-cols-2 gap-5">
              <Card className="p-5">
                <div className="mono-label text-[10px] text-indigo-400 mb-4">// geval quality</div>
                {stats.geval.evaluatedProjects === 0 ? (
                  <p className="text-sm text-muted">No evaluations recorded yet.</p>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2 mb-5">
                      <span className={`text-4xl font-bold tabular-nums ${scoreTone(stats.geval.avgScore)}`}>
                        {stats.geval.avgScore}%
                      </span>
                      <span className="mono-label text-[10px] text-muted">
                        average across {stats.geval.evaluatedProjects} projects
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {stats.geval.gradeDistribution.map((g) => (
                        <Bar
                          key={g.grade}
                          label={`Grade ${g.grade}`}
                          value={g.count}
                          max={maxGrade}
                          display={`${g.count}`}
                          color="bg-emerald-500"
                        />
                      ))}
                    </div>
                  </>
                )}
              </Card>

              <Card className="p-5">
                <div className="mono-label text-[10px] text-indigo-400 mb-4">// pipeline timing</div>
                {stats.timing.timedProjects === 0 ? (
                  <p className="text-sm text-muted">No timed runs recorded yet.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      {[
                        ["Fastest", stats.timing.minSeconds],
                        ["Average", stats.timing.avgSeconds],
                        ["Slowest", stats.timing.maxSeconds],
                      ].map(([k, v]) => (
                        <div key={k as string} className="rounded-lg bg-surface-2/60 px-3 py-2">
                          <div className="mono-label text-[9px] text-faint">{k}</div>
                          <div className="text-sm font-semibold tabular-nums">
                            {fmtDuration(v as number | null)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {stats.timing.outliersExcluded > 0 && (
                      <p className="mono-label text-[9px] text-amber-400/80 mb-3">
                        {stats.timing.outliersExcluded} outlier
                        {stats.timing.outliersExcluded !== 1 ? "s" : ""} excluded (IQR
                        {stats.timing.outlierThresholdSeconds != null
                          ? ` · > ${fmtDuration(stats.timing.outlierThresholdSeconds)}`
                          : ""}
                        )
                      </p>
                    )}
                    <div className="mono-label text-[9px] text-faint mb-2">avg per stage</div>
                    <div className="space-y-2">
                      {stats.timing.perStage.map((s) => (
                        <Bar
                          key={s.stage}
                          label={`${s.stage}. ${s.name}`}
                          value={s.avgSeconds}
                          max={maxStage}
                          display={`${s.avgSeconds}s`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* projects by status */}
            <Card className="p-5">
              <div className="mono-label text-[10px] text-indigo-400 mb-4">// projects by status</div>
              <div className="space-y-2.5">
                {stats.projectsByStatus.map((s) => (
                  <Bar
                    key={s.status}
                    label={s.status}
                    value={s.count}
                    max={maxStatus}
                    display={`${s.count}`}
                    color={STATUS_COLOR[s.status] ?? "bg-slate-500"}
                  />
                ))}
                {stats.projectsByStatus.length === 0 && (
                  <p className="text-sm text-muted">No projects yet.</p>
                )}
              </div>
            </Card>

            {/* top users */}
            <div>
              <div className="mono-label text-[10px] text-indigo-400 mb-3">// top users by projects</div>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left mono-label text-[10px] text-faint">
                      <th className="px-4 py-2.5 font-normal">User</th>
                      <th className="px-4 py-2.5 font-normal">Email</th>
                      <th className="px-4 py-2.5 font-normal text-right">Projects</th>
                      <th className="px-4 py-2.5 font-normal text-right hidden sm:table-cell">Joined</th>
                      <th className="px-4 py-2.5 font-normal text-right hidden md:table-cell">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topUsers.map((u) => (
                      <tr key={u.id} className="border-b border-line/50 last:border-0">
                        <td className="px-4 py-2.5 font-medium text-ink/90 truncate max-w-[10rem]">{u.name}</td>
                        <td className="px-4 py-2.5 text-muted truncate max-w-[12rem]">{u.email}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-indigo-400 font-semibold">
                          {u.projectCount}
                        </td>
                        <td className="px-4 py-2.5 text-right text-faint mono-label text-[10px] hidden sm:table-cell">
                          {fmtDate(u.createdAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-faint mono-label text-[10px] hidden md:table-cell">
                          {fmtDate(u.lastActive)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* recent projects */}
            <div>
              <div className="mono-label text-[10px] text-indigo-400 mb-3">
                // recent projects <span className="text-faint">· click a row for the GEval report</span>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left mono-label text-[10px] text-faint">
                      <th className="px-4 py-2.5 font-normal">Project</th>
                      <th className="px-4 py-2.5 font-normal hidden sm:table-cell">Owner</th>
                      <th className="px-4 py-2.5 font-normal">Status</th>
                      <th className="px-4 py-2.5 font-normal text-right">Time</th>
                      <th className="px-4 py-2.5 font-normal text-right">GEval</th>
                      <th className="px-4 py-2.5 font-normal text-right hidden md:table-cell">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentProjects.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setReportFor({ id: p.id, name: p.name })}
                        className="border-b border-line/50 last:border-0 cursor-pointer hover:bg-surface transition-colors"
                        title="View GEval report"
                      >
                        <td className="px-4 py-2.5 font-medium text-ink/90 truncate max-w-[12rem]">{p.name}</td>
                        <td className="px-4 py-2.5 text-muted truncate max-w-[10rem] hidden sm:table-cell">
                          {p.ownerName}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={p.status as ProjectStatus} />
                        </td>
                        {(() => {
                          const thr = stats.timing.outlierThresholdSeconds;
                          const isOutlier =
                            p.durationSeconds != null && thr != null && p.durationSeconds > thr;
                          return (
                            <td
                              className={`px-4 py-2.5 text-right tabular-nums mono-label text-[10px] ${
                                isOutlier ? "text-amber-400" : "text-muted"
                              }`}
                              title={isOutlier ? "Outlier — excluded from averages" : undefined}
                            >
                              {fmtDuration(p.durationSeconds)}
                              {isOutlier && " ⚠"}
                            </td>
                          );
                        })()}
                        <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${scoreTone(p.gevalScore)}`}>
                          {p.gevalScore == null ? "—" : `${p.gevalScore}%`}
                        </td>
                        <td className="px-4 py-2.5 text-right text-faint mono-label text-[10px] hidden md:table-cell">
                          {fmtDate(p.createdAt)}
                        </td>
                      </tr>
                    ))}
                    {stats.recentProjects.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-muted text-sm">
                          No projects yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-line py-5 text-center mono-label text-[10px] text-faint">
        Req2UI · Admin · {new Date().getFullYear()}
      </footer>

      {reportFor && <ReportModal project={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}
