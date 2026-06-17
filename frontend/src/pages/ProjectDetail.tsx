import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchProject } from "../api/projects";
import type { Project, PipelineStage } from "../types/project";
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

function StageIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckIcon size={15} className="text-green-400" />;
  if (status === "running")   return <SpinnerIcon size={15} className="text-yellow-400 animate-spin" />;
  if (status === "failed")    return <XIcon size={15} className="text-red-400" />;
  return <CircleIcon size={15} className="text-slate-600" />;
}

function StageRow({ stage, name, status }: { stage: number; name: string; status: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 light:border-slate-200 last:border-0">
      <span className="w-5 flex justify-center flex-shrink-0">
        <StageIcon status={status} />
      </span>
      <span className="text-xs text-slate-500 w-5">{stage}</span>
      <span className={`text-sm ${status === "completed" ? "text-slate-300 light:text-slate-700" : status === "running" ? "text-yellow-300 light:text-yellow-600" : "text-slate-500"}`}>
        {name}
      </span>
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

  useEffect(() => {
    if (!id) return;
    fetchProject(id).then((p) => {
      setProject(p);
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

      es.addEventListener("stage", (e) => {
        const data = JSON.parse(e.data) as PipelineStage;
        setStages((prev) => prev.map((s) => (s.stage === data.stage ? data : s)));
      });

      es.addEventListener("done", () => {
        es.close();
        setGenerating(false);
        fetchProject(id).then(setProject);
        toast.success("All 10 artifacts generated successfully!");
      });

      es.addEventListener("error", (e: any) => {
        es.close();
        const msg = e.data ? JSON.parse(e.data)?.error : "Generation failed";
        setGenError(msg ?? "Generation failed");
        setGenerating(false);
        toast.error("Pipeline failed. Please try again.");
      });

      es.onerror = () => {
        es.close();
        setGenError("Connection lost during generation.");
        setGenerating(false);
      };
    } catch {
      setGenError("Failed to start generation.");
      setGenerating(false);
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
          <div>
            <h1 className="text-2xl font-bold mb-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                {project.name}
              </span>
            </h1>
            <p className="text-slate-400 light:text-slate-600 text-sm leading-relaxed">{project.description}</p>
          </div>

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

            {project.status === "completed" && (
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
              <StageRow key={s.stage} stage={s.stage} name={s.name} status={s.status} />
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
