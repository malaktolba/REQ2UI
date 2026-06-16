import { Link } from "react-router-dom";
import { ArrowLeft } from "../components/Icons";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur h-16 flex items-center px-8">
        <div className="max-w-6xl mx-auto w-full">
          <Link to="/" className="text-xl font-bold text-white tracking-tight">
            Req<span className="text-indigo-400">2</span>UI
          </Link>
        </div>
      </nav>

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-b from-indigo-600/8 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center relative z-10">
        <div className="text-[120px] font-black leading-none mb-4 select-none text-transparent bg-clip-text bg-gradient-to-b from-slate-700 to-slate-900">
          404
        </div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-slate-400 text-sm mb-10 max-w-xs leading-relaxed">
          The page you're looking for doesn't exist or was moved.
        </p>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-5 py-2.5 rounded-xl transition text-sm"
          >
            <ArrowLeft size={14} /> Home
          </Link>
          <Link
            to="/dashboard"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm shadow-lg shadow-indigo-900/40"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <footer className="border-t border-slate-800 py-6 text-center text-slate-700 text-xs">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
