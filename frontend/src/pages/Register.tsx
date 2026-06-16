import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";

function passwordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: "", color: "", width: "w-0" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
  if (score <= 2) return { label: "Fair", color: "bg-yellow-500", width: "w-2/4" };
  if (score <= 3) return { label: "Good", color: "bg-blue-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-green-500", width: "w-full" };
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const strength = passwordStrength(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(typeof msg === "string" ? msg : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 light:bg-slate-50 flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-indigo-600/10 via-purple-600/5 to-transparent rounded-full blur-3xl pointer-events-none light:opacity-0" />

      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 max-w-6xl mx-auto w-full">
        <Link to="/" className="text-xl font-bold text-white light:text-slate-900 tracking-tight">
          Req<span className="text-indigo-400 light:text-indigo-600">2</span>UI
        </Link>
        <ThemeToggle />
      </nav>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 light:bg-indigo-50 border border-indigo-500/30 light:border-indigo-200 text-indigo-300 light:text-indigo-600 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 light:bg-indigo-500 animate-pulse" />
            Free to use
          </div>
          <h1 className="text-3xl font-bold text-white light:text-slate-900 mb-1">Create your account</h1>
          <p className="text-slate-400 light:text-slate-500 text-sm">Start generating IEEE-standard requirements</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 light:bg-white rounded-2xl p-8 border border-slate-800 light:border-slate-200 space-y-5 light:shadow-sm"
        >
          {error && (
            <div className="bg-red-500/10 light:bg-red-50 border border-red-500/30 light:border-red-200 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 light:text-slate-700 mb-1.5">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="Jane Smith"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 light:text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 light:text-slate-700 mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="Min 8 characters"
            />
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-slate-700 light:bg-slate-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className="text-xs text-slate-500">
                  Strength: <span className="font-medium text-white light:text-slate-900">{strength.label}</span>
                  {" · "}Use uppercase, numbers &amp; symbols for a stronger password.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || password.length < 8}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-900/40 light:shadow-indigo-200"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-400 light:text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-400 light:text-indigo-600 hover:text-indigo-300 light:hover:text-indigo-700 transition font-medium">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center mt-6 text-xs text-slate-600 light:text-slate-400">
          <Link to="/" className="hover:text-slate-400 light:hover:text-slate-600 transition">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
