import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import Aurora from "../components/Aurora";
import { BoltIcon, DocumentIcon, DiagramIcon, ExportIcon, ArrowRight } from "../components/Icons";
import { buttonClass, Kicker, Logo } from "../components/ui";
import { Reveal, Stagger, CountUp } from "../components/motion";

const FEATURES = [
  {
    id: "F-01",
    Icon: BoltIcon,
    title: "10-Stage AI Pipeline",
    desc: "From raw description to full IEEE 830 SRS in minutes — extraction, requirements, tests, wireframes, UML, and live UI code.",
  },
  {
    id: "F-02",
    Icon: DocumentIcon,
    title: "IEEE 830 Standard Output",
    desc: "Functional, non-functional, and security requirements structured to the IEEE 830-1998 standard automatically.",
  },
  {
    id: "F-03",
    Icon: DiagramIcon,
    title: "UML Diagrams",
    desc: "Auto-generated Use Case, Class, and Sequence diagrams rendered as interactive Mermaid.js visuals.",
  },
  {
    id: "F-04",
    Icon: ExportIcon,
    title: "4 Export Formats",
    desc: "Download your SRS as PDF (with embedded diagrams), DOCX, CSV, or LaTeX — ready to submit.",
  },
];

// Measured across benchmark runs — see thesis §7.1/§7.3 (SRS quality metrics).
const STATS: { to: number; decimals?: number; suffix?: string; label: string }[] = [
  { to: 10, label: "AI pipeline stages" },
  { to: 97.6, decimals: 1, suffix: "%", label: "Avg SRS accuracy" },
  { to: 100, suffix: "%", label: "IEEE 830 conformance" },
  { to: 4, label: "Export formats" },
];

const STEPS = [
  { step: "01", title: "Describe your system", body: "Write a plain-English description of the software you want to build." },
  { step: "02", title: "AI runs 10 stages", body: "The pipeline extracts, structures, and cross-references every artifact — including live UI code — automatically." },
  { step: "03", title: "Download & submit", body: "Export as PDF, DOCX, LaTeX, or CSV — IEEE 830 formatted and ready to hand in." },
];

export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Scroll-linked parallax: as the hero scrolls away, the copy drifts up,
  // fades, and shrinks slightly while the aurora layer moves slower (depth).
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const copyScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const auroraY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const gridY = useTransform(scrollYProgress, [0, 1], [0, 80]);

  const style = reduce ? {} : { y: copyY, opacity: copyOpacity, scale: copyScale };

  return (
    <div className="min-h-screen text-ink overflow-x-hidden">
      {/* ---------------------------------------------------------- Hero --- */}
      <div ref={heroRef} className="relative h-screen flex flex-col">
        <motion.div className="absolute inset-0" style={reduce ? {} : { y: auroraY }}>
          <Aurora colorStops={["#0e7490", "#0ea5e9", "#22d3ee"]} blend={0.4} amplitude={1.05} speed={0.35} />
        </motion.div>
        <div className="absolute inset-0 bg-canvas/70" />
        {/* faint blueprint grid emphasised over the hero */}
        <motion.div
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-indigo-500) 1px, transparent 1px), linear-gradient(90deg, var(--color-indigo-500) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(80% 60% at 50% 40%, #000 10%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(80% 60% at 50% 40%, #000 10%, transparent 75%)",
            ...(reduce ? {} : { y: gridY }),
          }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto w-full">
          <Logo />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-muted hover:text-ink transition px-4 py-2 rounded-lg hover:bg-white/5">
              Sign in
            </Link>
            <Link to="/register" className={buttonClass("primary", "sm")}>
              Get started
            </Link>
          </div>
        </nav>

        {/* Hero copy */}
        <motion.div
          className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6"
          style={style}
        >
          <div className="animate-fade-up mb-7">
            <span className="mono-label inline-flex items-center gap-2 text-[11px] text-indigo-300 border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              AI-Powered Requirements Engineering
            </span>
          </div>

          <h1
            className="animate-fade-up font-display font-black tracking-tighter leading-[0.9] text-7xl sm:text-8xl lg:text-[10rem] mb-4"
            style={{ animationDelay: "0.06s" }}
          >
            Req<span className="text-indigo-400">2</span>UI
          </h1>

          <p
            className="animate-fade-up font-display font-bold tracking-tight text-3xl sm:text-4xl lg:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-400 to-cyan-200 light:from-indigo-500 light:via-indigo-400 light:to-indigo-600 mb-6"
            style={{ animationDelay: "0.12s" }}
          >
            Requirements, engineered.
          </p>

          <p
            className="animate-fade-up text-muted text-lg sm:text-xl max-w-xl mb-10 leading-relaxed"
            style={{ animationDelay: "0.18s" }}
          >
            Paste a project description. Req2UI runs a 10-stage AI pipeline and delivers a complete IEEE 830 SRS, UML diagrams, test cases, and live UI code — export-ready in minutes.
          </p>

          <div className="animate-fade-up flex items-center gap-4 flex-wrap justify-center" style={{ animationDelay: "0.24s" }}>
            <Link to="/register" className={buttonClass("primary", "lg")}>
              Start a build <ArrowRight className="align-middle" size={16} />
            </Link>
            <Link to="/login" className={buttonClass("secondary", "lg")}>
              Sign in
            </Link>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="relative z-10 flex justify-center pb-8"
          animate={reduce ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex flex-col items-center gap-1 text-faint mono-label text-[10px]">
            <span>scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-faint to-transparent" />
          </div>
        </motion.div>
      </div>

      {/* --------------------------------------------------- By the numbers - */}
      <section className="border-b border-line bg-surface/40">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {STATS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.08} className="text-center relative">
                {i > 0 && (
                  <span className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-12 w-px bg-line" />
                )}
                <div className="font-display font-black text-5xl sm:text-6xl text-indigo-400 tabular-nums leading-none mb-2">
                  <CountUp to={s.to} decimals={s.decimals} suffix={s.suffix} />
                </div>
                <div className="mono-label text-[10px] text-faint">{s.label}</div>
              </Reveal>
            ))}
          </div>
          <p className="text-center mono-label text-[9px] text-faint/70 mt-10">
            measured across benchmark runs · IEEE 830-1998
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------ Features --- */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal className="text-center mb-16">
          <Kicker className="justify-center mb-4">capabilities</Kicker>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Everything you need, generated</h2>
          <p className="text-muted text-base max-w-md mx-auto">
            One description. Ten AI stages. A complete software specification package.
          </p>
        </Reveal>

        <Stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <Stagger.Item key={f.id}>
              <motion.div
                whileHover={reduce ? undefined : { y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className="bp-frame group bg-surface border border-line rounded-2xl p-6 hover:border-indigo-500/40 transition-colors h-full"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="text-indigo-400 group-hover:scale-110 transition-transform origin-left">
                    <f.Icon size={24} />
                  </div>
                  <span className="mono-label text-[10px] text-faint">{f.id}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            </Stagger.Item>
          ))}
        </Stagger>
      </section>

      {/* --------------------------------------------------- How it works -- */}
      <section className="border-y border-line bg-surface/40 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <Kicker className="justify-center mb-4">process</Kicker>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">How it works</h2>
          </Reveal>
          <div className="relative grid sm:grid-cols-3 gap-10 sm:gap-8">
            {/* connector line that "draws" itself across the steps */}
            {!reduce && (
              <motion.div
                className="hidden sm:block absolute top-7 left-[16%] right-[16%] h-px origin-left bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ duration: 1, ease: "easeInOut" }}
              />
            )}
            {STEPS.map((s, i) => (
              <Reveal key={s.step} from="up" delay={i * 0.12} className="relative flex flex-col items-center text-center">
                <span className="font-display text-5xl font-extrabold text-indigo-500/25 mb-3 tabular-nums bg-canvas px-2 relative z-10">{s.step}</span>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- CTA ----- */}
      <Reveal as="section" className="py-24 text-center px-6">
        <h2 className="text-3xl font-bold tracking-tight mb-4">Ready to generate your SRS?</h2>
        <p className="text-muted mb-8 max-w-md mx-auto">Free to use. No credit card required.</p>
        <Link to="/register" className={buttonClass("primary", "lg")}>
          Create your first project <ArrowRight className="align-middle" size={16} />
        </Link>
      </Reveal>

      {/* ------------------------------------------------------- Footer --- */}
      <footer className="border-t border-line py-8 text-center text-faint mono-label text-[10px]">
        Req2UI · AASTMT Graduation Project · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
