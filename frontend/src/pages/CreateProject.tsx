import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createProject } from "../api/projects";
import { useToast } from "../context/ToastContext";

const EXAMPLE_PROMPTS = [
  "A mobile app for university students to track attendance and grades with professor notifications.",
  "An e-commerce platform for handmade crafts with seller dashboards and buyer reviews.",
  "A telemedicine app connecting patients with doctors for video consultations and prescriptions.",
];

const MAX_DESC = 5000;

export default function CreateProject() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const project = await createProject({ name, description });
      toast.success("Project created! Run the pipeline to generate artifacts.");
      navigate(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Failed to create project.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center gap-3">
          <Link to="/dashboard" className="text-slate-400 hover:text-white transition text-sm">
            ← Back
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-300 text-sm font-medium">New Project</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Create a new project</h1>
        <p className="text-slate-400 mb-8">
          Describe your software system. Be as detailed as possible — better input means better requirements.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Project name</label>
            <input
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="My Software System"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-300">Project description</label>
              <span className={`text-xs ${description.length > MAX_DESC * 0.9 ? "text-yellow-400" : "text-slate-500"}`}>
                {description.length}/{MAX_DESC}
              </span>
            </div>
            <textarea
              required
              minLength={10}
              maxLength={MAX_DESC}
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
              placeholder="Describe your system in detail — its purpose, users, main features, and any constraints…"
            />
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">Try an example:</p>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setDescription(prompt)}
                  className="w-full text-left text-xs bg-slate-800/60 border border-slate-700 hover:border-indigo-500/50 rounded-lg px-3 py-2 text-slate-400 hover:text-slate-200 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || name.length < 1 || description.length < 10}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
        </form>
      </main>
    </div>
  );
}
