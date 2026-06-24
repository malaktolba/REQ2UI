import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchProject, fetchProjectWithStages, updateProject } from "../api/projects";
import type { Project, PipelineStage, ProjectMetadata } from "../types/project";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { CheckIcon, XIcon, SpinnerIcon, CircleIcon, ArrowLeft, ArrowRight } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";

const STAGE_NAMES = [
  "Requirement Extraction",
  "Functional Requirements (IEEE 830)",
  "Non-Functional Requirements",
  "Security Requirements (OWASP)",
  "Functional Test Cases (IEEE 829)",
  "Security Test Cases",
  "UI Wireframe Descriptions",
  "Traceability Matrix",
  "UML Diagrams",
  "UI Code Generation",
];

/** Turn a raw backend/Groq error into something a user can act on. */
function humanizeGenError(raw: string): string {
  if (/rate.?limit|429|tokens per day|TPD/i.test(raw)) {
    const retry = raw.match(/try again in ([\dhms.\s]+?)[.\"]/i)?.[1]?.trim();
    return `Groq daily token limit reached — the free tier allows ~100k tokens/day and a full run uses most of it. ${
      retry ? `Try again in ${retry}.` : "Try again later."
    } Or upgrade the Groq plan for higher limits.`;
  }
  return raw;
}

function StageIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckIcon size={15} className="text-green-400" />;
  if (status === "running")   return <SpinnerIcon size={15} className="text-yellow-400 animate-spin" />;
  if (status === "failed")    return <XIcon size={15} className="text-red-400" />;
  return <CircleIcon size={15} className="text-slate-600" />;
}

function StageRow({ stage, name, status, detail, progress }: {
  stage: number;
  name: string;
  status: string;
  detail?: string;
  progress?: { current: number; total: number };
}) {
  const showSub = status === "running" && (detail || progress);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 light:border-slate-200 last:border-0">
      <span className="w-5 flex justify-center flex-shrink-0">
        <StageIcon status={status} />
      </span>
      <span className="text-xs text-slate-500 w-5">{stage}</span>
      <div className="min-w-0">
        <span className={`text-sm ${status === "completed" ? "text-slate-300 light:text-slate-700" : status === "running" ? "text-yellow-300 light:text-yellow-600" : "text-slate-500"}`}>
          {name}
        </span>
        {showSub && (
          <span className="block text-xs text-slate-500 truncate">
            {detail}
            {progress && progress.total > 0 ? ` · ${progress.current}/${progress.total}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editMeta, setEditMeta] = useState<ProjectMetadata>({});
  const [saving, setSaving] = useState(false);

  const META_FIELDS: { key: keyof ProjectMetadata; label: string; placeholder: string; full?: boolean }[] = [
    { key: "organization", label: "Organization / company", placeholder: "Acme Corp" },
    { key: "industry", label: "Industry / domain", placeholder: "Healthcare, Fintech…" },
    { key: "audience", label: "Target users / audience", placeholder: "Clinicians, patients…", full: true },
    { key: "author", label: "Prepared by", placeholder: "Account name if blank" },
    { key: "contact_email", label: "Contact email", placeholder: "Account email if blank" },
    { key: "version", label: "Document version", placeholder: "1.0" },
  ];

  useEffect(() => {
    if (!id) return;
    fetchProjectWithStages(id)
      .then(({ project: p, stages: existing }) => {
        setProject(p);
        // Seed any previously-run stages so a resumed/interrupted run shows the
        // work already done, rather than starting the list from scratch.
        if (existing.length) setStages(existing);
        setLoading(false);
      })
      .catch(() => {
        // 404 / not accessible — drop the spinner and show the
        // "Project not found" state instead of spinning forever.
        setLoading(false);
      });
  }, [id]);

  async function handleGenerate() {
    if (!id) return;
    setGenerating(true);
    setGenError("");

    // Seed pending stages immediately for UX
    setStages(STAGE_NAMES.map((name, i) => ({
      stage: i + 1,
      name,
      status: "pending",
      error: null,
      started_at: null,
      finished_at: null,
    })));

    try {
      const token = sessionStorage.getItem("access_token");
      const base = import.meta.env.VITE_API_BASE_URL ?? "";
      const es = new EventSource(`${base}/api/projects/${id}/generate?token=${token}`);

      // Captured in the closure so the connection-drop handler can surface the
      // real per-stage error (e.g. a Groq rate limit) instead of a generic
      // "connection lost" — the stream always closes after a failed stage.
      let stageError = "";
      let settled = false;

      es.addEventListener("stage", (e) => {
        const data = JSON.parse(e.data) as PipelineStage;
        setStages((prev) => prev.map((s) => (s.stage === data.stage ? data : s)));
        if (data.status === "failed" && data.error) stageError = data.error;
      });

      es.addEventListener("done", () => {
        settled = true;
        es.close();
        setGenerating(false);
        fetchProject(id).then(setProject);
        toast.success("All 10 artifacts generated successfully!");
      });

      es.addEventListener("error", (e: any) => {
        settled = true;
        es.close();
        const raw = e.data ? JSON.parse(e.data)?.error : stageError || "Generation failed";
        setGenError(humanizeGenError(raw || "Generation failed"));
        setGenerating(false);
        toast.error("Pipeline failed. Please try again.");
      });

      es.onerror = () => {
        if (settled) return; // normal close after done/error already handled
        es.close();
        setGenError(
          stageError ? humanizeGenError(stageError) : "Connection lost during generation."
        );
        setGenerating(false);
      };
    } catch {
      setGenError("Failed to start generation.");
      setGenerating(false);
    }
  }

  function startEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description);
    setEditMeta(project.metadata ?? {});
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!id || !project) return;
    setSaving(true);
    try {
      // Send every metadata key (blanks included) so cleared fields are removed
      // — the backend trims blanks and merges the result onto stored metadata.
      const metadata = Object.fromEntries(
        Object.entries(editMeta).map(([k, v]) => [k, (v ?? "").trim()])
      ) as ProjectMetadata;
      const updated = await updateProject(id, {
        name: editName.trim(),
        description: editDesc.trim(),
        metadata,
      });
      setProject(updated);
      setEditing(false);
      toast.success("Project updated.");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Project not found.{" "}
        <Link to="/dashboard" className="text-indigo-400 ml-1">Go back</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 light:bg-white text-white light:text-slate-900 flex flex-col transition-colors">
      <header className="border-b border-slate-800 light:border-slate-200 bg-slate-900/60 light:bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/" className="text-xl font-bold text-white light:text-slate-900 tracking-tight">
            Req<span className="text-indigo-400 light:text-indigo-600">2</span>UI
          </Link>
          <span className="text-slate-700 light:text-slate-300 text-lg font-light">/</span>
          <Link to="/dashboard" className="text-slate-400 light:text-slate-600 hover:text-white light:hover:text-slate-900 transition text-sm flex items-center gap-1">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-slate-700 light:text-slate-300 text-lg font-light">/</span>
          <span className="text-slate-300 light:text-slate-700 text-sm font-medium truncate max-w-xs">{project.name}</span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <StatusBadge status={project.status} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <div className="space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
                className="w-full bg-slate-800 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-lg font-bold text-white light:text-slate-900 focus:outline-none focus:border-indigo-500 transition"
                placeholder="Project name"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={5}
                maxLength={5000}
                className="w-full bg-slate-800 light:bg-white border border-slate-700 light:border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-300 light:text-slate-700 focus:outline-none focus:border-indigo-500 transition resize-none leading-relaxed"
                placeholder="Project description"
              />

              {/* Organization & document details (optional) */}
              <div className="rounded-xl border border-slate-800 light:border-slate-200 p-4">
                <p className="text-xs font-medium text-slate-400 light:text-slate-600 mb-3">
                  Organization &amp; document details
                  <span className="text-slate-600 light:text-slate-400 font-normal"> · optional, enriches the SRS &amp; export title page</span>
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {META_FIELDS.map((f) => (
                    <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                      <label className="block text-xs text-slate-500 light:text-slate-500 mb-1">{f.label}</label>
                      <input
                        type={f.key === "contact_email" ? "email" : "text"}
                        value={editMeta[f.key] ?? ""}
                        onChange={(e) => setEditMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                        maxLength={400}
                        className="w-full bg-slate-800 light:bg-white border border-slate-700 light:border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-200 light:text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editName.trim() || !editDesc.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-slate-400 hover:text-white light:hover:text-slate-900 text-sm px-4 py-2 rounded-lg border border-slate-700 light:border-slate-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <div className="flex items-start gap-2">
                <h1 className="text-2xl font-bold mb-2 flex-1">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    {project.name}
                  </span>
                </h1>
                <button
                  onClick={startEdit}
                  title="Edit project"
                  className="mt-1 flex-shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-slate-300 light:hover:text-slate-700 hover:bg-slate-800 light:hover:bg-slate-100 transition opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2l2 2-7 7H3v-2l7-7z"/>
                  </svg>
                </button>
              </div>
              <p className="text-slate-400 light:text-slate-600 text-sm leading-relaxed">{project.description}</p>
              {project.metadata && Object.values(project.metadata).some(Boolean) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {([
                    ["organization", "Org"],
                    ["industry", "Industry"],
                    ["audience", "Users"],
                    ["author", "By"],
                    ["version", "v"],
                  ] as [keyof ProjectMetadata, string][])
                    .filter(([k]) => project.metadata?.[k])
                    .map(([k, label]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 text-xs bg-slate-900 light:bg-slate-100 border border-slate-800 light:border-slate-200 rounded-full px-2.5 py-1 text-slate-400 light:text-slate-600"
                      >
                        <span className="text-slate-600 light:text-slate-400">{label}:</span>
                        {project.metadata![k]}
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}

          {genError && (
            <div className="bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-200 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-xl">
              {genError}
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleGenerate}
              disabled={generating || project.status === "generating"}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/40 light:shadow-indigo-100"
            >
              {generating ? "Generating…" : project.status === "completed" ? "Re-generate" : "Generate artifacts"}
            </button>

            {(project.status === "completed" || stages.some((s) => s.status === "completed")) && (
              <button
                onClick={() => navigate(`/projects/${id}/artifacts`)}
                className="border border-slate-700 light:border-slate-300 hover:border-indigo-500/60 light:hover:border-indigo-400 text-slate-300 light:text-slate-600 hover:text-white light:hover:text-slate-900 font-medium px-5 py-2.5 rounded-xl transition text-sm flex items-center gap-1.5"
              >
                View artifacts <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="bg-slate-900 light:bg-slate-50 border border-slate-800 light:border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Pipeline</h2>
            {stages.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 light:text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {stages.filter(s => s.status === "completed").length}/{stages.length}
              </span>
            )}
          </div>
          {stages.length > 0 && (
            <div className="h-1 bg-slate-800 light:bg-slate-200 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${(stages.filter(s => s.status === "completed").length / stages.length) * 100}%` }}
              />
            </div>
          )}
          {stages.length === 0 ? (
            <p className="text-slate-600 light:text-slate-400 text-sm">Run generation to see progress here.</p>
          ) : (
            stages.map((s) => (
              <StageRow key={s.stage} stage={s.stage} name={s.name} status={s.status} detail={s.detail} progress={s.progress} />
            ))
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800 light:border-slate-200 py-6 text-center text-slate-700 light:text-slate-400 text-xs">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
