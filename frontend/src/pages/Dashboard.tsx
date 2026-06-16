import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { useProjects } from "../hooks/useProjects";
import { ProjectCard } from "../components/ProjectCard";
import { useToast } from "../context/ToastContext";
import { ArrowRight } from "../components/Icons";

function SkeletonCard() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 animate-pulse">
      <div className="h-4 bg-slate-800 rounded-lg w-3/4 mb-3" />
      <div className="h-3 bg-slate-800 rounded-lg mb-2" />
      <div className="h-3 bg-slate-800 rounded-lg w-5/6 mb-4" />
      <div className="h-3 bg-slate-800 rounded-lg w-1/4" />
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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Req<span className="text-indigo-400">2</span>UI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <p className="text-slate-500 text-sm mb-1">Welcome back, {user?.name?.split(" ")[0]}</p>
            <h2 className="text-3xl font-bold">
              Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Projects
              </span>
            </h2>
          </div>
          <Link
            to="/projects/new"
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/40 flex items-center gap-2"
          >
            New project <ArrowRight size={14} />
          </Link>
        </div>

        {/* Stats */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-sm">
            {[
              { label: "Total", value: projects.length },
              { label: "Completed", value: projects.filter(p => p.status === "completed").length },
              { label: "Artifacts", value: projects.reduce((s, p) => s + (p.artifact_count ?? 0), 0) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-center">
                <div className="text-2xl font-bold text-indigo-400">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-2xl py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-slate-300 font-semibold mb-1">No projects yet</p>
            <p className="text-slate-600 text-sm mb-6">Describe a system and let AI generate your full SRS</p>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/40"
            >
              Create your first project <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onDelete={handleRemove} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-slate-700 text-xs">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
