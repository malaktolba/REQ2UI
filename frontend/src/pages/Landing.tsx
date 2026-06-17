import { Link } from "react-router-dom";
import Aurora from "../components/Aurora";
import { BoltIcon, DocumentIcon, DiagramIcon, ExportIcon, ArrowRight } from "../components/Icons";

const FEATURES = [
  {
    Icon: BoltIcon,
    title: "9-Stage AI Pipeline",
    desc: "From raw description to full IEEE 830 SRS in minutes — extraction, requirements, tests, wireframes, UML, and more.",
  },
  {
    Icon: DocumentIcon,
    title: "IEEE 830 Standard Output",
    desc: "Functional, non-functional, and security requirements structured to the IEEE 830-1998 standard automatically.",
  },
  {
    Icon: DiagramIcon,
    title: "UML Diagrams",
    desc: "Auto-generated Use Case, Class, and Sequence diagrams rendered as interactive Mermaid.js visuals.",
  },
  {
    Icon: ExportIcon,
    title: "4 Export Formats",
    desc: "Download your SRS as PDF (with embedded diagrams), DOCX, CSV, or LaTeX — ready to submit.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Aurora hero */}
      <div className="relative h-screen flex flex-col">
        {/* Aurora canvas fills the full hero */}
        <div className="absolute inset-0">
          <Aurora
            colorStops={["#3A29FF", "#7C3AED", "#FF3232"]}
            blend={0.4}
            amplitude={1.1}
            speed={0.4}
          />
        </div>

        {/* Dark overlay so text stays readable */}
        <div className="absolute inset-0 bg-slate-950/60" />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto w-full">
          <span className="text-xl font-bold text-white tracking-tight">
            Req<span className="text-indigo-400">2</span>UI
          </span>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-slate-300 hover:text-white transition px-4 py-2 rounded-lg hover:bg-white/10"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition"
            >
              Get started
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI-Powered Requirements Engineering
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight max-w-3xl mb-6">
            Turn ideas into
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              IEEE-standard specs
            </span>
          </h1>

          <p className="text-slate-400 text-lg sm:text-xl max-w-xl mb-10 leading-relaxed">
            Paste a project description. Req2UI runs a 9-stage AI pipeline and delivers a complete SRS document, UML diagrams, and test cases — export-ready in minutes.
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link
              to="/register"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 rounded-xl transition text-base shadow-lg shadow-indigo-900/40"
            >
              Start for free <ArrowRight className="inline-block ml-1 align-middle" size={15} />
            </Link>
            <Link
              to="/login"
              className="border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium px-7 py-3.5 rounded-xl transition text-base"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-8">
          <div className="flex flex-col items-center gap-1 text-slate-600 text-xs">
            <span>scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
          </div>
        </div>
      </div>

      {/* Features section */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-3">Everything you need, generated</h2>
          <p className="text-slate-400 text-base max-w-md mx-auto">
            One description. Nine AI stages. A complete software specification package.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition"
            >
              <div className="mb-3 text-indigo-400">
                <f.Icon size={24} />
              </div>
              <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline steps */}
      <section className="border-t border-slate-800 bg-slate-900/40 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            {[
              { step: "01", title: "Describe your system", body: "Write a plain-English description of the software you want to build." },
              { step: "02", title: "AI runs 10 stages", body: "The pipeline extracts, structures, and cross-references every artifact — including live UI code — automatically." },
              { step: "03", title: "Download & submit", body: "Export as PDF, DOCX, LaTeX, or CSV — IEEE 830 formatted and ready to hand in." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <span className="text-4xl font-bold text-indigo-500/30 mb-3">{s.step}</span>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to generate your SRS?</h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Free to use. No credit card required.
        </p>
        <Link
          to="/register"
          className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-4 rounded-xl transition text-base shadow-lg shadow-indigo-900/40"
        >
          Create your first project <ArrowRight className="inline-block ml-1 align-middle" size={15} />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 text-center text-slate-600 text-sm">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
