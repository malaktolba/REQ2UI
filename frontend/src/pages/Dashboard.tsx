import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo, Kicker, buttonClass } from "../components/ui";
import { Stagger } from "../components/motion";
import type { Project } from "../types/project";

const STATUS_ACCENT: Record<string, string> = {
  completed: "bg-indigo-500",
  generating: "bg-amber-400",
  pending: "bg-faint",
  failed: "bg-red-500",
};

function ProjectRow({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const accent = STATUS_ACCENT[project.status] ?? "bg-faint";

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    await onDelete(project.id);
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group flex items-start gap-3 cursor-pointer py-1"
    >
      <div className="pt-[18px] flex-shrink-0">
        <div className={`w-2 h-2 rounded-full ${accent} ${project.status === "generating" ? "animate-pulse" : ""}`} />
      </div>

      <div className="flex-1 min-w-0 px-4 py-3.5 rounded-xl border border-line group-hover:border-indigo-500/40 group-hover:bg-surface transition-colors duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <span className="font-semibold text-ink/90 group-hover:text-ink transition-colors">
                {project.name}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted text-sm leading-relaxed line-clamp-1 mb-2">
              {project.description}
            </p>
            <div className="flex items-center gap-3 mono-label text-[10px] text-faint">
              <span>
                {new Date(project.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {(project.artifact_count ?? 0) > 0 && (
                <span className="text-indigo-400">
                  {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex-shrink-0 mono-label text-[10px] px-2.5 py-1 rounded-lg border transition opacity-0 group-hover:opacity-100 ${
              confirmDelete
                ? "border-red-500/50 text-red-400 bg-red-500/10"
                : "border-line text-faint hover:border-red-500/40 hover:text-red-400"
            }`}
          >
            {deleting ? "…" : confirmDelete ? "Sure?" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 py-1 animate-pulse">
      <div className="pt-[18px] flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-slate-800 light:bg-slate-200" />
      </div>
      <div className="flex-1 px-4 py-3.5">
        <div className="h-4 bg-surface-2 rounded w-1/3 mb-2" />
        <div className="h-3 bg-surface-2/60 rounded w-3/4 mb-3" />
        <div className="h-3 bg-surface-2/40 rounded w-1/5" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { projects, loading, error, remove } = useProjects();
  const toast = useToast();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  async function handleRemove(id: string) {
    try {
      await remove(id);
      toast.success("Project deleted.");
    } catch {
      toast.error("Failed to delete project.");
    }
  }

  const completedCount = projects.filter((p) => p.status === "completed").length;
  const artifactTotal = projects.reduce((s, p) => s + (p.artifact_count ?? 0), 0);

  return (
    <div className="min-h-screen text-ink flex flex-col">
      <header className="border-b border-line bg-canvas/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/"><Logo size="sm" /></Link>
          <div className="flex items-center gap-2">
            <span className="mono-label text-[10px] text-muted hidden sm:block mr-2">{user?.name}</span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="mono-label text-[10px] text-faint hover:text-ink transition ml-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
        <Kicker className="mb-3">workspace</Kicker>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            {!loading && projects.length > 0 && (
              <span className="mono-label text-[10px] text-muted bg-surface border border-line px-1.5 py-0.5 rounded tabular-nums">
                {projects.length}
              </span>
            )}
          </div>
          <Link to="/projects/new" className={buttonClass("primary", "sm")}>
            New project
          </Link>
        </div>

        {!loading && projects.length > 0 && (
          <p className="mono-label text-[10px] text-faint mb-8">
            {completedCount} of {projects.length} completed &middot; {artifactTotal} artifacts generated
          </p>
        )}

        {!loading && projects.length === 0 && <div className="mb-4" />}

        {error && (
          <div className="text-red-400 text-sm py-3 mb-6 border-l-2 border-red-500/60 pl-4">
            {error}
          </div>
        )}

        <div>
          {loading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : projects.length === 0 ? (
            <div className="bp-frame py-20 text-center border border-dashed border-line rounded-2xl">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-ink font-semibold mb-1">No projects yet</p>
              <p className="text-muted text-sm mb-6 leading-relaxed">
                Describe a software system and generate a full IEEE 830 SRS
              </p>
              <Link to="/projects/new" className={buttonClass("primary", "md")}>
                Create your first project
              </Link>
            </div>
          ) : (
            <Stagger>
              {projects.map((p) => (
                <Stagger.Item key={p.id}>
                  <ProjectRow project={p} onDelete={handleRemove} />
                </Stagger.Item>
              ))}
            </Stagger>
          )}
        </div>
      </main>

      <footer className="border-t border-line py-5 text-center mono-label text-[10px] text-faint">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
