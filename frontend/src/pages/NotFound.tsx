import { Link } from "react-router-dom";
import { ArrowLeft } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo, Kicker, buttonClass } from "../components/ui";

export default function NotFound() {
  return (
    <div className="min-h-screen text-ink flex flex-col">
      <nav className="border-b border-line bg-canvas/70 backdrop-blur h-16 flex items-center px-8">
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center relative z-10">
        <Kicker className="justify-center mb-4">error 404</Kicker>
        <div className="font-display text-[120px] font-black leading-none mb-4 select-none text-transparent bg-clip-text bg-gradient-to-b from-line to-surface-2">
          404
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Page not found</h1>
        <p className="text-muted text-sm mb-10 max-w-xs leading-relaxed">
          The page you're looking for doesn't exist or was moved.
        </p>
        <div className="flex items-center gap-3">
          <Link to="/" className={buttonClass("secondary", "md")}>
            <ArrowLeft size={14} /> Home
          </Link>
          <Link to="/dashboard" className={buttonClass("primary", "md")}>
            Dashboard
          </Link>
        </div>
      </div>

      <footer className="border-t border-line py-6 text-center mono-label text-[10px] text-faint">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
