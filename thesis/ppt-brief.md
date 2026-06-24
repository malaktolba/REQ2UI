# Req2UI — Presentation Brief for a Slide-Generation Agent

Paste this entire file into the PPT agent. It contains (1) the prompt, (2) the
factual context, (3) the slide-by-slide outline, and (4) the visual direction.

---

## 1) PROMPT (paste this first)

> You are an expert presentation designer. Create a polished, professional
> **graduation-thesis defense deck** (16:9) for the project described in the
> CONTEXT below. Audience: a university thesis examination committee
> (technical, academic). Tone: confident, precise, academic but not dry.
>
> Requirements:
> - Follow the SLIDE OUTLINE exactly (one slide per item, ~18–22 slides).
> - Each slide: a short headline + 3–5 concise bullets (max ~12 words each).
>   Never paste paragraphs; presentations are talking aids, not documents.
> - Add a brief **speaker note** under each slide (2–4 sentences) the presenter
>   can read aloud.
> - Use the VISUAL DIRECTION for colors, typography, and mood — dark, modern,
>   technical, with an indigo accent. Consistent master layout across slides.
> - Where a slide implies a diagram (architecture, pipeline, sequence), describe
>   or lay out a clean diagram using shapes/boxes/arrows — do not just list text.
> - Include slide numbers and a footer with the project short name "Req2UI".
> - End with a "Thank you / Questions" slide.
>
> Generate the deck now.

---

## 2) CONTEXT (the facts — keep accurate)

**Project title:** Req2UI — From Natural Language to Secure Software Artifacts Using AI
**Type:** B.Sc. Software Engineering graduation project
**Institution:** Arab Academy for Science, Technology & Maritime Transport (AASTMT),
College of Computing and Information Technology, Smart Village — 2025/2026
**Team:** Mennatallah Hany, Mayar Hany, Yasmin Haitham, Malak Tarek, Mohamed Bassem
**Supervisor:** Dr. Salma Radwan Abdel-Hamid

**One-line pitch:** A web app that turns a plain-language description of a software
system into a complete, security-aware set of software-engineering artifacts —
automatically.

**The problem:** Writing a Software Requirements Specification (SRS) by hand is slow,
inconsistent, and error-prone. Security requirements are often missing. Existing tools
each cover only ONE slice (requirements docs, OR UI prototyping, OR test automation) —
none span the whole flow, and none auto-generate security requirements or keep
traceability between artifacts.

**The solution:** From a single natural-language input, Req2UI runs a **10-stage AI
pipeline** that produces:
1. Requirement extraction + IEEE 830 narrative (abstract, scope, objectives)
2. Functional requirements (IEEE 830, "The system shall…")
3. Non-functional requirements (with measurable metrics)
4. Security requirements mapped to the **OWASP Top 10 (2021)**
5. Functional test cases (IEEE 829)
6. Security test cases (attack-vector driven)
7. UI wireframe descriptions
8. Requirements traceability matrix (with coverage %)
9. UML diagrams (use-case, class, sequence — as Mermaid)
10. Runnable UI code (HTML + Tailwind, per-screen)

Then it exports everything as **PDF, DOCX, LaTeX, and CSV**.

**Key technical highlights (differentiators — emphasize these):**
- **Two LLMs:** Groq (`llama-3.3-70b`) drives stages 1–9; Google Gemini
  (`2.5-flash-lite`) generates UI code in stage 10 (two passes: a shared design
  system, then one HTML page per distinct screen).
- **Concurrent, layered pipeline:** independent stages run in parallel (3–5, then
  6–7, then 8–10) to cut generation time.
- **Resumable:** every artifact is saved keyed by (project, type); an interrupted
  run resumes from where it stopped instead of redoing everything.
- **Live streaming:** progress is pushed to the browser in real time via
  Server-Sent Events (SSE).
- **Security-by-design auth:** JWT access tokens (15 min) + rotating refresh tokens
  (7 days, SHA-256 hashed) with **token-family theft detection**, bcrypt password
  hashing (cost 12), account lockout after 5 failed logins, Helmet headers, CORS,
  Zod input validation, and rate limiting.
- **End-to-end traceability:** requirements ↔ test cases ↔ security requirements.

**Tech stack:**
- Frontend: React 19, TypeScript, Tailwind CSS v4, Vite, React Router 7
- Backend: Node.js, Express 4, TypeScript
- Database: PostgreSQL (Neon serverless)
- Export: pdfkit, docx.js, csv-writer, resvg-js (SVG→PNG for diagrams)
- Deployment: Vercel (frontend) + Render (backend)

**Validation / results:**
- Automated test suite: **24 tests passing** across 2 suites (auth routes; export service).
- Generated artifacts conform to **IEEE 830** (SRS), **IEEE 829** (test docs), and
  **OWASP Top 10** (security).
- Standards followed: IEEE 12207 (lifecycle), IEEE 830, IEEE 829, UML, OWASP.

**Research gap it closes:** the first integrated pipeline covering
*natural language → SRS → UI prototype → functional + security test cases* with
automatic security generation and full traceability.

**Limitations (be honest):** output quality depends on LLM and input detail;
throughput is bounded by API rate limits (free tiers); generated UI is a low-fidelity
prototype; some non-functional targets (load, full WCAG) still need dedicated test runs.

**Future work:** admin dashboard; in-app artifact editing/refinement; self-critique
refinement loops; more export targets; domain fine-tuning / retrieval augmentation;
ASVS-level security; auto-running generated tests against generated UI.

---

## 3) SLIDE OUTLINE (one slide each)

1. **Title** — project title, subtitle, team, supervisor, university, year, AAST logo.
2. **Agenda** — the sections of the talk.
3. **Motivation** — manual SRS is slow, inconsistent, insecure.
4. **Problem Statement** — fragmented tools, no auto security, no traceability.
5. **Objectives** — 5 project objectives (see context).
6. **Related Work & Gap** — competitors cover one slice each; comparison highlights.
7. **Proposed Solution** — the big idea: NL input → full artifact suite (one visual).
8. **System Architecture** — layered diagram: React SPA → Express API → Groq/Gemini → Neon DB.
9. **The 10-Stage Pipeline** — the centerpiece; show all 10 stages as a flow.
10. **Two-LLM Strategy** — Groq for text artifacts, Gemini for UI code; why.
11. **Concurrency & Resumability** — layered parallel stages; resume on failure.
12. **Security by Design** — OWASP-mapped requirements + the auth/security stack.
13. **UML & UI Code Generation** — Mermaid diagrams + 2-pass HTML/Tailwind generation.
14. **Traceability & Exports** — matrix + PDF/DOCX/LaTeX/CSV.
15. **Tech Stack** — frontend / backend / DB / deployment (logos).
16. **Live Demo** — screenshots: dashboard, project detail (live progress), artifacts viewer, UI preview.
17. **Testing & Validation** — 24 passing tests; IEEE 829 generated tests; standards.
18. **Results** — what was achieved vs the objectives.
19. **Limitations & Future Work** — honest constraints + roadmap.
20. **Conclusion** — restate the contribution in one line.
21. **Thank You / Questions.**

---

## 4) VISUAL DIRECTION (match the project's real look)

- **Mood:** modern, technical, dark — like a developer tool / SaaS product.
- **Background:** very dark slate (`#020617` / `#0F172A`); surfaces slightly lighter (`#1E293B`).
- **Primary accent:** indigo (`#4F46E5` / `#6366F1`) for highlights, arrows, key terms.
- **Secondary accent:** bright blue (`#2563EB`) and navy (`#1A3A52`) — these match the
  thesis document and exported PDF/LaTeX, so the deck feels part of the same project.
- **Text:** near-white (`#F1F5F9`) on dark; muted slate (`#94A3B8`) for secondary text.
- **Typography:** clean sans-serif (Inter / Helvetica style); large bold headlines,
  generous spacing.
- **Diagrams:** rounded boxes, thin connectors, indigo arrows; label clearly; avoid clutter.
- **Icons:** simple line icons (lock = security, layers = pipeline, database, branching = flow).
- **Consistency:** same header position, footer ("Req2UI"), and slide numbers throughout.
- **Avoid:** stock-photo clutter, rainbow palettes, dense paragraphs, clip-art.

> Optional: the AAST logo is available in the thesis figures as `aast-logo.png` — use it
> on the title slide. The same UML figures (architecture, pipeline/sequence, class,
> use-case, activity) exist as PNGs in the thesis `figures/` folder and can be dropped
> onto the architecture/pipeline slides.
