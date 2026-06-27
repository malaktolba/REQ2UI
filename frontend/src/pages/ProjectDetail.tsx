import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchProject, fetchProjectWithStages, updateProject, errorMessage } from "../api/projects";
import type { Project, PipelineStage, ProjectMetadata, UIPreferences } from "../types/project";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { CheckIcon, XIcon, SpinnerIcon, CircleIcon, ArrowLeft, ArrowRight } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { UIPreferencesForm, UIPreferencesSummary } from "../components/UIPreferencesForm";
import { cleanPreferences, summarizePreferences } from "../config/uiPreferences";
import { Button, Input, Textarea, Label, Logo, Kicker, buttonClass } from "../components/ui";
import { LoadingScreen } from "../components/LoadingScreen";
import { GenerationProgress } from "../components/GenerationProgress";
import { LiveArtifactPreview } from "../components/LiveArtifactPreview";
import { AnimatePresence, motion } from "motion/react";

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
  if (status === "completed")
    return (
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="inline-flex"
      >
        <CheckIcon size={15} className="text-indigo-400" />
      </motion.span>
    );
  if (status === "running")   return <SpinnerIcon size={15} className="text-amber-400 animate-spin" />;
  if (status === "failed")    return <XIcon size={15} className="text-red-400" />;
  return <CircleIcon size={15} className="text-faint" />;
}

function StageRow({ stage, name, status, detail, progress }: {
  stage: number;
  name: string;
  status: string;
  detail?: string;
  progress?: { current: number; total: number };
}) {
  const showSub = status === "running" && (detail || progress);
  const running = status === "running";
  return (
    <motion.div
      layout
      animate={running ? { backgroundColor: "color-mix(in srgb, var(--color-indigo-500) 7%, transparent)" } : { backgroundColor: "rgba(0,0,0,0)" }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg border-b border-line last:border-0"
    >
      <span className="w-5 flex justify-center flex-shrink-0">
        <StageIcon status={status} />
      </span>
      <span className="mono-label text-[10px] text-faint w-5">{stage}</span>
      <div className="min-w-0">
        <span className={`text-sm transition-colors ${status === "completed" ? "text-ink/80" : running ? "text-amber-400" : "text-faint"}`}>
          {name}
        </span>
        {showSub && (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="block text-xs text-muted truncate"
          >
            {detail}
            {progress && progress.total > 0 ? ` · ${progress.current}/${progress.total}` : ""}
          </motion.span>
        )}
      </div>
    </motion.div>
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
  const [editPrefs, setEditPrefs] = useState<UIPreferences>({});
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
    setEditPrefs(project.ui_preferences ?? {});
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
        ui_preferences: cleanPreferences(editPrefs),
      });
      setProject(updated);
      setEditing(false);
      toast.success("Project updated.");
    } catch (err: any) {
      toast.error(errorMessage(err, "Failed to save changes."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading project" />;
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Project not found.{" "}
        <Link to="/dashboard" className="text-indigo-400 ml-1">Go back</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink flex flex-col">
      <header className="border-b border-line bg-canvas/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link to="/"><Logo size="sm" /></Link>
          <span className="text-faint text-lg font-light">/</span>
          <Link to="/dashboard" className="text-muted hover:text-ink transition text-sm flex items-center gap-1">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <span className="text-faint text-lg font-light">/</span>
          <span className="mono-label text-[10px] text-ink truncate max-w-xs">{project.name}</span>
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
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={200}
                className="!text-lg !font-bold"
                placeholder="Project name"
              />
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={5}
                maxLength={5000}
                placeholder="Project description"
              />

              {/* Organization & document details (optional) */}
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-medium text-muted mb-3">
                  Organization &amp; document details
                  <span className="text-faint font-normal"> · optional, enriches the SRS &amp; export title page</span>
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {META_FIELDS.map((f) => (
                    <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                      <Label htmlFor={`em-${f.key}`}>{f.label}</Label>
                      <Input
                        id={`em-${f.key}`}
                        type={f.key === "contact_email" ? "email" : "text"}
                        value={editMeta[f.key] ?? ""}
                        onChange={(e) => setEditMeta((m) => ({ ...m, [f.key]: e.target.value }))}
                        maxLength={400}
                        placeholder={f.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* UI design preferences (optional) */}
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-medium text-muted mb-3">
                  UI Design Preferences
                  <span className="text-faint font-normal"> · optional, guides UI code generation</span>
                </p>
                <UIPreferencesForm value={editPrefs} onChange={setEditPrefs} />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={saving || !editName.trim() || !editDesc.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <Kicker className="mb-3">project</Kicker>
              <div className="flex items-start gap-2">
                <h1 className="text-3xl font-bold tracking-tight mb-2 flex-1">{project.name}</h1>
                <button
                  onClick={startEdit}
                  title="Edit project"
                  className="mt-1 flex-shrink-0 p-1.5 rounded-lg text-faint hover:text-ink hover:bg-surface transition opacity-0 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2l2 2-7 7H3v-2l7-7z"/>
                  </svg>
                </button>
              </div>
              <p className="text-muted text-sm leading-relaxed">{project.description}</p>
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
                        className="inline-flex items-center gap-1 text-xs bg-surface border border-line rounded-full px-2.5 py-1 text-muted"
                      >
                        <span className="mono-label text-[9px] text-faint">{label}:</span>
                        {project.metadata![k]}
                      </span>
                    ))}
                </div>
              )}
              {summarizePreferences(project.ui_preferences).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {summarizePreferences(project.ui_preferences).map((l) => (
                    <span
                      key={l}
                      className="inline-flex items-center gap-1 text-xs bg-indigo-500/10 border border-indigo-500/25 rounded-full px-2.5 py-1 text-indigo-300"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {genError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-lg">
              {genError}
            </div>
          )}

          {/* Pre-generation summary of UI design preferences (editable above). */}
          {!editing && project.status !== "completed" && (
            <UIPreferencesSummary lines={summarizePreferences(project.ui_preferences)} />
          )}

          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating || project.status === "generating"}>
              {generating
                ? "Generating…"
                : project.status === "completed"
                ? "Re-generate"
                : project.status === "failed"
                ? "Resume generation"
                : "Generate artifacts"}
            </Button>

            {(() => {
              const isGenerating = generating || project.status === "generating";
              const hasArtifacts =
                project.status === "completed" || stages.some((s) => s.status === "completed");
              if (!hasArtifacts) return null;
              // Navigating away tears down the SSE stream, which aborts an in-flight
              // run (generation isn't backgrounded). Disable the button until done.
              return (
                <button
                  onClick={() => navigate(`/projects/${id}/artifacts`)}
                  disabled={isGenerating}
                  title={isGenerating ? "Available once generation finishes" : undefined}
                  className={buttonClass("secondary", "md")}
                >
                  View artifacts <ArrowRight size={14} />
                </button>
              );
            })()}
          </div>

        </div>

        {/* Pipeline stages */}
        <div className="bg-surface border border-line rounded-2xl p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="mono-label text-[11px] text-muted">Pipeline</h2>
            {stages.length > 0 && (
              <span className="mono-label inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 px-2 py-0.5 rounded-full">
                {stages.filter(s => s.status === "completed").length}/{stages.length}
              </span>
            )}
          </div>
          <AnimatePresence>
            {stages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <GenerationProgress stages={stages} generating={generating} />
                {id && <LiveArtifactPreview projectId={id} stages={stages} />}
              </motion.div>
            )}
          </AnimatePresence>
          {stages.length === 0 ? (
            <p className="text-muted text-sm">Run generation to see progress here.</p>
          ) : (
            stages.map((s) => (
              <StageRow key={s.stage} stage={s.stage} name={s.name} status={s.status} detail={s.detail} progress={s.progress} />
            ))
          )}
        </div>
      </main>

      <footer className="border-t border-line py-6 text-center mono-label text-[10px] text-faint">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
