import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 text-center">
      <div className="text-8xl font-black text-slate-800 mb-6 select-none">404</div>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-400 text-sm mb-8 max-w-xs">
        The page you're looking for doesn't exist or was moved.
      </p>
      <Link
        to="/dashboard"
        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
