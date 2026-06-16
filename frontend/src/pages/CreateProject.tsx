import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createProject } from "../api/projects";
import { useToast } from "../context/ToastContext";
import { ArrowLeft } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";

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
          <span className="text-slate-300 light:text-slate-700 text-sm font-medium">New Project</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            New{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Project
            </span>
          </h1>
          <p className="text-slate-400 light:text-slate-500 leading-relaxed">
            Describe your software system. Be as detailed as possible — better input means better requirements.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-200 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 light:text-slate-700 mb-1.5">Project name</label>
            <input
              type="text"
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800/80 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="My Software System"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-300 light:text-slate-700">Description</label>
              <span className={`text-xs ${description.length > MAX_DESC * 0.9 ? "text-yellow-400" : "text-slate-600 light:text-slate-400"}`}>
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
              className="w-full bg-slate-800/80 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-3 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
              placeholder="Describe your system in detail — its purpose, users, main features, and any constraints…"
            />
          </div>

          <div>
            <p className="text-xs text-slate-600 light:text-slate-400 mb-2 uppercase tracking-wider font-medium">Try an example</p>
            <div className="space-y-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setDescription(prompt)}
                  className="w-full text-left text-xs bg-slate-900 light:bg-slate-50 border border-slate-800 light:border-slate-200 hover:border-indigo-500/40 light:hover:border-indigo-300 rounded-xl px-4 py-3 text-slate-400 light:text-slate-500 hover:text-slate-200 light:hover:text-slate-700 transition leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || name.length < 1 || description.length < 10}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-900/40 light:shadow-indigo-100"
          >
            {loading ? "Creating…" : "Create project"}
          </button>
        </form>
      </main>

      <footer className="border-t border-slate-800 light:border-slate-200 py-6 text-center text-slate-700 light:text-slate-400 text-xs">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
