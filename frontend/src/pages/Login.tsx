import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Input, Label, Kicker, Logo, buttonClass } from "../components/ui";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Accent glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top nav */}
      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 max-w-6xl mx-auto w-full">
        <Link to="/"><Logo /></Link>
        <ThemeToggle />
      </nav>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Kicker className="justify-center mb-4">{showChooser ? "session" : "authenticate"}</Kicker>
          <h1 className="text-3xl font-bold tracking-tight mb-1">{showChooser ? "You're signed in" : "Sign in"}</h1>
          <p className="text-muted text-sm">
            {showChooser ? "Continue, or use a different account" : "Continue building your requirements"}
          </p>
        </div>

        {showChooser ? (
          <div className="bp-frame bg-surface rounded-2xl p-8 border border-line space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-[#04181d] font-display font-bold flex-shrink-0">
                {(user!.name || user!.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{user!.name || user!.email}</p>
                <p className="text-xs text-muted truncate">{user!.email}</p>
              </div>
            </div>
            <Button onClick={() => navigate(from, { replace: true })} className="w-full">
              Continue as {user!.name || user!.email.split("@")[0]}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setSwitching(true); setError(""); setEmail(""); setPassword(""); }}
              className="w-full"
            >
              Sign in with a different account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bp-frame bg-surface rounded-2xl p-8 border border-line space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-sm text-muted">
              Don't have an account?{" "}
              <Link to="/register" className="text-indigo-400 hover:text-indigo-300 transition font-medium">
                Create one
              </Link>
            </p>
          </form>
        )}

        {switching && user && (
          <p className="text-center mt-4 text-sm text-muted">
            <button
              type="button"
              onClick={() => { setSwitching(false); setError(""); }}
              className="text-indigo-400 hover:text-indigo-300 transition font-medium"
            >
              ← Back to {user.email}
            </button>
          </p>
        )}

        <p className="text-center mt-6 mono-label text-[10px] text-faint">
          <Link to="/" className={buttonClass("ghost", "sm", "!px-2 !py-1")}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
