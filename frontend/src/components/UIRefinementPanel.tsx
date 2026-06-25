import { useState } from "react";
import type { RefinementScope, UIRevision } from "../types/project";
import {
  applyRefinement,
  discardRefinement,
  fetchRevisions,
  restoreRevision,
  fetchSuggestions,
  errorMessage,
} from "../api/projects";
import { useToast } from "../context/ToastContext";
import { CheckIcon } from "./Icons";

interface Screen {
  id: string;
  name: string;
  route?: string;
}

interface PendingMeta {
  prompt?: string;
  scope?: RefinementScope;
  summary?: string[];
  screensChanged?: string[];
}

const EXAMPLES = [
  "Make the cards more compact",
  "Add a search bar to the top of this page",
  "Change the whole app to a dark luxury style",
  "Make this page look more modern",
  "Add a notification dropdown in the navbar",
];

const SCOPES: { id: RefinementScope; label: string; hint: string }[] = [
  { id: "page", label: "Current page", hint: "Affects only the page you're viewing" },
  { id: "pages", label: "Selected pages", hint: "Pick which pages to change" },
  { id: "design_system", label: "Entire design system", hint: "Applies to every generated page" },
];

/**
 * Post-generation AI refinement controls. Drives the refine SSE to stage a
 * preview, then surfaces Apply / Discard / Modify, plus AI suggestions and the
 * version-history restore list. The staged preview itself is rendered by the
 * parent (UICodeView) from the `pending` artifact; this panel owns the actions.
 */
export function UIRefinementPanel({
  projectId,
  screens,
  currentScreenId,
  currentScreenName,
  pending,
  onRefreshed,
}: {
  projectId: string;
  screens: Screen[];
  currentScreenId: string | null;
  currentScreenName?: string;
  pending?: { __refinement?: PendingMeta } | null;
  onRefreshed: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<RefinementScope>("page");
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false); // apply/discard in flight

  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<UIRevision[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const meta = pending?.__refinement;
  const hasPending = !!pending;

  function targetScreenIds(): string[] {
    if (scope === "design_system") return [];
    if (scope === "page") return currentScreenId ? [currentScreenId] : [];
    return [...selectedPages];
  }

  const canPreview =
    !!prompt.trim() &&
    !running &&
    (scope === "design_system" ||
      (scope === "page" && !!currentScreenId) ||
      (scope === "pages" && selectedPages.size > 0));

  function startPreview() {
    if (!canPreview) return;
    setRunning(true);
    setProgress("Analysing change…");

    const token = sessionStorage.getItem("access_token") ?? "";
    const base = import.meta.env.VITE_API_BASE_URL ?? "";
    const params = new URLSearchParams({
      token,
      prompt: prompt.trim(),
      scope,
      screens: targetScreenIds().join(","),
    });
    const es = new EventSource(`${base}/api/projects/${projectId}/refine?${params.toString()}`);

    let settled = false;

    es.addEventListener("stage", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      if (d.detail) {
        setProgress(
          d.progress && d.progress.total > 0
            ? `${d.detail} · ${d.progress.current}/${d.progress.total}`
            : d.detail
        );
      }
    });

    es.addEventListener("done", async () => {
      settled = true;
      es.close();
      setRunning(false);
      setProgress("");
      await onRefreshed(); // pending artifact now exists → parent renders the preview
      toast.success("Preview ready — review and apply.");
    });

    es.addEventListener("error", (e: any) => {
      settled = true;
      es.close();
      setRunning(false);
      setProgress("");
      const msg = e.data ? JSON.parse(e.data)?.error : null;
      toast.error(msg ?? "Refinement failed.");
    });

    es.onerror = () => {
      if (settled) return;
      es.close();
      setRunning(false);
      setProgress("");
      toast.error("Connection lost during refinement.");
    };
  }

  async function apply() {
    setBusy(true);
    try {
      await applyRefinement(projectId);
      setPrompt("");
      await onRefreshed();
      toast.success("Changes applied.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to apply changes."));
    } finally {
      setBusy(false);
    }
  }

  async function discard(keepPrompt: boolean) {
    setBusy(true);
    try {
      await discardRefinement(projectId);
      if (!keepPrompt) setPrompt("");
      await onRefreshed();
      toast.info(keepPrompt ? "Edit your request and preview again." : "Changes discarded.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to discard changes."));
    } finally {
      setBusy(false);
    }
  }

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    try {
      setSuggestions(await fetchSuggestions(projectId));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load suggestions."));
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function toggleHistory() {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && revisions === null) {
      try {
        setRevisions(await fetchRevisions(projectId));
      } catch (err) {
        toast.error(errorMessage(err, "Failed to load history."));
      }
    }
  }

  async function restore(version: number) {
    setRestoring(version);
    try {
      await restoreRevision(projectId, version);
      setRevisions(await fetchRevisions(projectId));
      await onRefreshed();
      toast.success(`Restored version ${version}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to restore."));
    } finally {
      setRestoring(null);
    }
  }

  const inputClass =
    "w-full bg-slate-800/80 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-200 light:text-slate-800 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none";

  return (
    <div className="bg-slate-900 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h3 className="text-sm font-bold text-slate-100 light:text-slate-900">Refine with AI</h3>
        </div>
        <button
          onClick={toggleHistory}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition"
        >
          {historyOpen ? "Hide history" : "History"}
        </button>
      </div>

      {/* ── Pending preview banner (Apply / Discard / Modify) ── */}
      {hasPending ? (
        <div className="rounded-xl border border-indigo-500/40 light:border-indigo-300 bg-indigo-500/10 light:bg-indigo-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-indigo-300 light:text-indigo-700 uppercase tracking-wide">
            Changes detected — previewing below
          </p>
          <ul className="space-y-1">
            {(meta?.summary ?? ["Updated the selected screens"]).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-200 light:text-slate-700">
                <CheckIcon size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={apply}
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {busy ? "Applying…" : "Apply changes"}
            </button>
            <button
              onClick={() => discard(false)}
              disabled={busy}
              className="border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-600 hover:text-white light:hover:text-slate-900 text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={() => discard(true)}
              disabled={busy}
              className="text-slate-400 light:text-slate-500 hover:text-white light:hover:text-slate-900 text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              Modify request
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Prompt ── */}
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1500}
            placeholder="Describe changes you want to make…"
            className={inputClass}
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-indigo-300 light:hover:text-indigo-600 transition"
              >
                {ex}
              </button>
            ))}
          </div>

          {/* ── Scope ── */}
          <div>
            <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-1.5">Apply to</p>
            <div className="flex flex-wrap gap-1.5">
              {SCOPES.map((s) => {
                const active = scope === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setScope(s.id)}
                    title={s.hint}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      active
                        ? "border-indigo-500 bg-indigo-500/15 light:bg-indigo-50 text-indigo-300 light:text-indigo-700"
                        : "border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-slate-600 light:hover:border-slate-400"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            {scope === "page" && (
              <p className="text-xs text-slate-500 mt-1.5">
                Editing <span className="text-slate-300 light:text-slate-700">{currentScreenName ?? "the current page"}</span>.
              </p>
            )}
            {scope === "design_system" && (
              <p className="text-xs text-slate-500 mt-1.5">All {screens.length} pages will be updated.</p>
            )}
            {scope === "pages" && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {screens.map((s) => {
                  const on = selectedPages.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        setSelectedPages((prev) => {
                          const next = new Set(prev);
                          next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                          return next;
                        })
                      }
                      className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                        on
                          ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                          : "border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-slate-600"
                      }`}
                    >
                      {on && <CheckIcon size={12} className="flex-shrink-0" />}
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={startPreview}
              disabled={!canPreview}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              {running ? "Generating preview…" : "Preview changes"}
            </button>
            <button
              onClick={loadSuggestions}
              disabled={loadingSuggestions || running}
              className="text-sm px-4 py-2 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition disabled:opacity-50"
            >
              {loadingSuggestions ? "Thinking…" : "Suggest improvements"}
            </button>
            {running && progress && (
              <span className="flex items-center gap-2 text-xs text-indigo-400">
                <span className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                {progress}
              </span>
            )}
          </div>

          {/* ── Suggestions ── */}
          {suggestions && (
            <div className="rounded-xl border border-slate-800 light:border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-2">
                Suggested improvements — click one to use it
              </p>
              {suggestions.length === 0 ? (
                <p className="text-xs text-slate-500">No suggestions right now.</p>
              ) : (
                <ul className="space-y-1.5">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setPrompt(s)}
                        className="text-left text-sm text-slate-300 light:text-slate-700 hover:text-indigo-300 light:hover:text-indigo-600 transition flex items-start gap-2"
                      >
                        <span className="text-indigo-400 flex-shrink-0">＋</span>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {/* ── History ── */}
      {historyOpen && (
        <div className="rounded-xl border border-slate-800 light:border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-2">Version history</p>
          {revisions === null ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : revisions.length === 0 ? (
            <p className="text-xs text-slate-500">No previous versions yet. Apply a change to start the history.</p>
          ) : (
            <ul className="space-y-1.5">
              {revisions.map((r) => (
                <li
                  key={r.version}
                  className="flex items-center justify-between gap-3 text-sm border-b border-slate-800/60 light:border-slate-200 last:border-0 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="text-slate-300 light:text-slate-700">v{r.version} · {r.label}</span>
                    <span className="block text-[11px] text-slate-600">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => restore(r.version)}
                    disabled={restoring !== null}
                    className="flex-shrink-0 text-xs px-3 py-1 rounded-lg border border-slate-700 light:border-slate-300 text-slate-400 light:text-slate-600 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 transition disabled:opacity-50"
                  >
                    {restoring === r.version ? "Restoring…" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
