import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, Input, Label, Kicker, Logo, buttonClass } from "../components/ui";

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
  if (score <= 3) return { label: "Good", color: "bg-indigo-400", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[420px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <nav className="absolute top-0 left-0 right-0 h-16 flex items-center justify-between px-8 max-w-6xl mx-auto w-full">
        <Link to="/"><Logo /></Link>
        <ThemeToggle />
      </nav>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Kicker className="justify-center mb-4">new account</Kicker>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Create your account</h1>
          <p className="text-muted text-sm">Start generating IEEE-standard requirements</p>
        </div>

        <form onSubmit={handleSubmit} className="bp-frame bg-surface rounded-2xl p-8 border border-line space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 light:text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" />
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className="text-xs text-muted">
                  Strength: <span className="font-medium text-ink">{strength.label}</span>
                  {" · "}Use uppercase, numbers &amp; symbols for a stronger password.
                </p>
              </div>
            )}
          </div>

          <Button type="submit" disabled={loading || password.length < 8} className="w-full">
            {loading ? "Creating account…" : "Create account"}
          </Button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 transition font-medium">
              Sign in
            </Link>
          </p>
        </form>

        <p className="text-center mt-6">
          <Link to="/" className={buttonClass("ghost", "sm", "!px-2 !py-1 mono-label !text-[10px] !text-faint")}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
