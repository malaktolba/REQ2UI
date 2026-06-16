import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { ThemeToggle } from "../components/ThemeToggle";
import type { Project } from "../types/project";

const STATUS_ACCENT: Record<string, string> = {
  completed: "bg-indigo-500",
  generating: "bg-yellow-400",
  pending: "bg-slate-700 light:bg-slate-400",
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

  const accent = STATUS_ACCENT[project.status] ?? "bg-slate-700 light:bg-slate-400";

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

      <div className="flex-1 min-w-0 px-4 py-3.5 rounded-xl border border-slate-800/70 light:border-slate-200 group-hover:border-indigo-500/30 light:group-hover:border-indigo-300/60 group-hover:bg-slate-900 light:group-hover:bg-slate-50 transition-colors duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1 flex-wrap">
              <span className="font-semibold text-slate-200 light:text-slate-800 group-hover:text-white light:group-hover:text-slate-900 transition-colors">
                {project.name}
              </span>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-slate-500 light:text-slate-500 text-sm leading-relaxed line-clamp-1 mb-2">
              {project.description}
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-700 light:text-slate-400">
              <span>
                {new Date(project.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {(project.artifact_count ?? 0) > 0 && (
                <span className="text-indigo-500/70 light:text-indigo-600">
                  {project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border transition opacity-0 group-hover:opacity-100 ${
              confirmDelete
                ? "border-red-500/50 text-red-400 bg-red-500/10 light:border-red-300 light:text-red-500 light:bg-red-50"
                : "border-slate-800 light:border-slate-200 text-slate-600 light:text-slate-400 hover:border-red-500/40 hover:text-red-400 light:hover:border-red-200 light:hover:text-red-500"
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
        <div className="h-4 bg-slate-800 light:bg-slate-200 rounded w-1/3 mb-2" />
        <div className="h-3 bg-slate-800/60 light:bg-slate-100 rounded w-3/4 mb-3" />
        <div className="h-3 bg-slate-800/40 light:bg-slate-100 rounded w-1/5" />
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
    <div className="min-h-screen bg-slate-950 light:bg-white text-white light:text-slate-900 flex flex-col transition-colors">
      <header className="border-b border-slate-800 light:border-slate-200 bg-slate-900/60 light:bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="text-base font-bold text-white light:text-slate-900 tracking-tight">
            Req<span className="text-indigo-400 light:text-indigo-600">2</span>UI
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 hidden sm:block mr-2">{user?.name}</span>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 light:text-slate-500 hover:text-slate-300 light:hover:text-slate-700 transition ml-1"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-semibold text-white light:text-slate-900">Projects</h1>
            {!loading && projects.length > 0 && (
              <span className="text-xs text-slate-600 light:text-slate-500 bg-slate-800/60 light:bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                {projects.length}
              </span>
            )}
          </div>
          <Link
            to="/projects/new"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition shadow-lg shadow-indigo-900/30 light:shadow-indigo-100"
          >
            New project
          </Link>
        </div>

        {!loading && projects.length > 0 && (
          <p className="text-xs text-slate-600 light:text-slate-400 mb-8">
            {completedCount} of {projects.length} completed &middot; {artifactTotal} artifacts generated
          </p>
        )}

        {!loading && projects.length === 0 && <div className="mb-4" />}

        {error && (
          <div className="text-red-400 light:text-red-500 text-sm py-3 mb-6 border-l-2 border-red-500/60 pl-4">
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
            <div className="py-20 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 light:bg-indigo-50 border border-indigo-500/20 light:border-indigo-100 flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400 light:text-indigo-600" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <p className="text-slate-300 light:text-slate-700 font-medium mb-1">No projects yet</p>
              <p className="text-slate-600 light:text-slate-400 text-sm mb-6 leading-relaxed">
                Describe a software system and generate a full IEEE 830 SRS
              </p>
              <Link
                to="/projects/new"
                className="inline-block text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition shadow-lg shadow-indigo-900/30 light:shadow-indigo-100"
              >
                Create your first project
              </Link>
            </div>
          ) : (
            projects.map((p) => (
              <ProjectRow key={p.id} project={p} onDelete={handleRemove} />
            ))
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800 light:border-slate-200 py-5 text-center text-slate-700 light:text-slate-400 text-xs">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
