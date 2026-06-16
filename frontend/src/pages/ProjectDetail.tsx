import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchProject } from "../api/projects";
import type { Project, PipelineStage } from "../types/project";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";

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
];

function StageRow({ stage, name, status }: { stage: number; name: string; status: string }) {
  const icon =
    status === "completed" ? "✓" :
    status === "running" ? "⟳" :
    status === "failed" ? "✕" : "○";

  const color =
    status === "completed" ? "text-green-400" :
    status === "running" ? "text-yellow-400 animate-spin" :
    status === "failed" ? "text-red-400" : "text-slate-600";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <span className={`text-base font-mono w-5 text-center ${color}`}>{icon}</span>
      <span className="text-xs text-slate-500 w-5">{stage}</span>
      <span className={`text-sm ${status === "completed" ? "text-slate-300" : status === "running" ? "text-yellow-300" : "text-slate-500"}`}>
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
      const es = new EventSource(`/api/projects/${id}/generate?token=${token}`);

      es.addEventListener("stage", (e) => {
        const data = JSON.parse(e.data) as PipelineStage;
        setStages((prev) => prev.map((s) => (s.stage === data.stage ? data : s)));
      });

      es.addEventListener("done", () => {
        es.close();
        setGenerating(false);
        fetchProject(id).then(setProject);
        toast.success("All 9 artifacts generated successfully!");
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
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link to="/dashboard" className="text-slate-400 hover:text-white transition text-sm">
            ← Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 text-sm font-medium truncate max-w-xs">{project.name}</span>
          <div className="ml-auto"><StatusBadge status={project.status} /></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-xl font-bold mb-1">{project.name}</h1>
            <p className="text-slate-400 text-sm leading-relaxed">{project.description}</p>
          </div>

          {genError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {genError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating || project.status === "generating"}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
            >
              {generating ? "Generating…" : project.status === "completed" ? "Re-generate" : "Generate artifacts"}
            </button>

            {project.status === "completed" && (
              <button
                onClick={() => navigate(`/projects/${id}/artifacts`)}
                className="border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white font-medium px-5 py-2.5 rounded-xl transition text-sm"
              >
                View artifacts →
              </button>
            )}
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Pipeline stages</h2>
            {stages.length > 0 && (
              <span className="text-xs text-slate-500">
                {stages.filter(s => s.status === "completed").length}/{stages.length}
              </span>
            )}
          </div>
          {stages.length > 0 && (
            <div className="h-1 bg-slate-800 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${(stages.filter(s => s.status === "completed").length / stages.length) * 100}%` }}
              />
            </div>
          )}
          {stages.length === 0 ? (
            <p className="text-slate-600 text-sm">Run generation to see progress here.</p>
          ) : (
            stages.map((s) => (
              <StageRow key={s.stage} stage={s.stage} name={s.name} status={s.status} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
