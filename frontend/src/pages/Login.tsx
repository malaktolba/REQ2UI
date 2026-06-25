import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // When already signed in, offer the current account instead of the form;
  // "switching" reveals the form so a different account can sign in.
  const [switching, setSwitching] = useState(false);
  const showChooser = !!user && !switching;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 light:bg-slate-50 flex flex-col items-center justify-center px-4 relative overflow-hidden transition-colors">
      {/* Ambient glow — hidden in light mode */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-indigo-600/10 via-purple-600/5 to-transparent rounded-full blur-3xl pointer-events-none light:opacity-0" />

      {/* Top nav */}
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
            Welcome back
          </div>
          <h1 className="text-3xl font-bold text-white light:text-slate-900 mb-1">
            {showChooser ? "You're signed in" : "Sign in"}
          </h1>
          <p className="text-slate-400 light:text-slate-500 text-sm">
            {showChooser ? "Continue, or use a different account" : "Continue building your requirements"}
          </p>
        </div>

        {showChooser ? (
          <div className="bg-slate-900 light:bg-white rounded-2xl p-8 border border-slate-800 light:border-slate-200 space-y-4 light:shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {(user!.name || user!.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white light:text-slate-900 truncate">{user!.name || user!.email}</p>
                <p className="text-xs text-slate-400 light:text-slate-500 truncate">{user!.email}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(from, { replace: true })}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-900/40 light:shadow-indigo-200"
            >
              Continue as {user!.name || user!.email.split("@")[0]}
            </button>
            <button
              onClick={() => { setSwitching(true); setError(""); setEmail(""); setPassword(""); }}
              className="w-full border border-slate-700 light:border-slate-300 text-slate-300 light:text-slate-700 hover:border-indigo-500 hover:text-white light:hover:text-slate-900 font-medium py-3 rounded-xl transition"
            >
              Sign in with a different account
            </button>
          </div>
        ) : (
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 light:bg-slate-50 border border-slate-700 light:border-slate-300 rounded-xl px-4 py-2.5 text-white light:text-slate-900 placeholder-slate-500 light:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-indigo-900/40 light:shadow-indigo-200"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-center text-sm text-slate-400 light:text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="text-indigo-400 light:text-indigo-600 hover:text-indigo-300 light:hover:text-indigo-700 transition font-medium">
              Create one
            </Link>
          </p>
        </form>
        )}

        {switching && user && (
          <p className="text-center mt-4 text-sm text-slate-400 light:text-slate-500">
            <button
              type="button"
              onClick={() => { setSwitching(false); setError(""); }}
              className="text-indigo-400 light:text-indigo-600 hover:text-indigo-300 light:hover:text-indigo-700 transition font-medium"
            >
              ← Back to {user.email}
            </button>
          </p>
        )}

        <p className="text-center mt-6 text-xs text-slate-600 light:text-slate-400">
          <Link to="/" className="hover:text-slate-400 light:hover:text-slate-600 transition">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
