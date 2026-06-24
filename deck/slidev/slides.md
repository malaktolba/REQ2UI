---
theme: default
title: Req2UI — From Natural Language to Secure Software Artifacts Using AI
info: B.Sc. Software Engineering graduation defense — AASTMT 2025/2026
colorSchema: dark
fonts:
  sans: Inter
  mono: Fira Code
transition: fade
layout: cover
logo: /aast-logo.png
section: Title
---

<div class="pill">B.Sc. Software Engineering — Graduation Project Defense</div>

<h1 class="cover-title">Req2UI</h1>

<div class="cover-tagline">From Natural Language to Secure Software Artifacts Using AI</div>

<div class="accent" />

<div class="cover-meta">Arab Academy for Science, Technology &amp; Maritime Transport (AASTMT) — College of Computing and Information Technology, Smart Village — 2025/2026</div>

<div class="cover-people">
  <div><span class="lbl">Team</span> Mennatallah Hany · Mayar Hany · Yasmin Haitham · Malak Tarek · Mohamed Bassem</div>
  <div class="mt-2"><span class="lbl">Supervisor</span> Dr. Salma Radwan Abdel-Hamid</div>
</div>

<!--
- Introduce the team and the project name "Req2UI" — a Software Engineering graduation project at AASTMT, supervised by Dr. Salma Radwan Abdel-Hamid.
- One-line pitch: turn a natural-language description of a software system into a complete, security-aware artifact bundle using AI.
- Academic context: B.Sc. defense, College of Computing and Information Technology, Smart Village, 2025/2026.
- Promise a ~20-minute walkthrough: motivation, architecture, demo, validation.
- Invite questions at the end; the live demo can be opened on request.
-->

---
layout: topic
section: Agenda
title: "What we'll cover"
subtitle: "Eight sections, ~20 minutes."
---

<div class="grid grid-cols-4 gap-4 mt-6">
  <div class="card"><div class="num">01</div><h3 class="mt-3">Motivation &amp; Problem</h3><p>Why manual SRS fails.</p></div>
  <div class="card"><div class="num">02</div><h3 class="mt-3">Objectives &amp; Related Work</h3><p>What we set out to do.</p></div>
  <div class="card"><div class="num">03</div><h3 class="mt-3">Solution &amp; Architecture</h3><p>The big idea.</p></div>
  <div class="card"><div class="num">04</div><h3 class="mt-3">The 10-Stage Pipeline</h3><p>Centerpiece.</p></div>
  <div class="card"><div class="num">05</div><h3 class="mt-3">Concurrency &amp; Security</h3><p>Fast &amp; safe.</p></div>
  <div class="card"><div class="num">06</div><h3 class="mt-3">UML, UI &amp; Traceability</h3><p>The outputs.</p></div>
  <div class="card"><div class="num">07</div><h3 class="mt-3">Tech Stack &amp; Demo</h3><p>What's running.</p></div>
  <div class="card"><div class="num">08</div><h3 class="mt-3">Testing &amp; Future Work</h3><p>Validation + roadmap.</p></div>
</div>

<!--
- 8 sections, ~20 minutes. Sections 1–3 set up motivation, objectives, and the solution at a high level.
- Sections 4–6 dive into the pipeline, concurrency, security, and the generated UML / UI / traceability outputs.
- Sections 7–8 cover the live demo, validation, and where the work goes next.
- Detailed Q&A is at the end; short clarifications between sections are welcome.
-->

---
layout: topic
section: Motivation
title: "Why Req2UI?"
subtitle: "Manual SRS authoring fails the modern team."
---

<div class="grid grid-cols-3 gap-5 mt-8">
  <div class="card card-accent">
    <div class="kicker">01</div>
    <h3 class="mt-3" style="font-size:22px">Slow</h3>
    <p class="mt-2">Requirements authored by hand take days to weeks per project. Iteration is painful and feedback loops are long — especially when stakeholders pivot mid-cycle.</p>
  </div>
  <div class="card card-accent">
    <div class="kicker">02</div>
    <h3 class="mt-3" style="font-size:22px">Inconsistent</h3>
    <p class="mt-2">Style, depth, and terminology drift across teams and projects. Two engineers reading the same input produce two very different SRS documents.</p>
  </div>
  <div class="card card-accent">
    <div class="kicker">03</div>
    <h3 class="mt-3" style="font-size:22px">Insecure</h3>
    <p class="mt-2">Security requirements are routinely missing or bolted on late — treated as an afterthought rather than a first-class deliverable of the spec phase.</p>
  </div>
</div>

<!--
- Manual SRS authoring fails the modern team in three concrete ways.
- Slow: days to weeks per project; long iteration loops when stakeholders pivot.
- Inconsistent: style, depth, terminology drift between engineers.
- Insecure: security requirements missing or bolted on late.
- These three pains are exactly what Req2UI was built to remove.
-->

---
layout: topic
section: Problem
title: "The tooling gap"
subtitle: "Today's tools each cover only one slice — none spans the whole flow."
---

<div class="grid grid-cols-3 gap-5 mt-6">
  <div class="card"><div class="kicker">A</div><h3 class="mt-2">Requirements tools</h3><p>Generate an SRS document and stop there. No downstream artifacts, no security generation, no traceability to tests or UI.</p></div>
  <div class="card"><div class="kicker">B</div><h3 class="mt-2">UI prototyping tools</h3><p>Produce screens and components, but assume requirements are already settled upstream. No link back to a spec.</p></div>
  <div class="card"><div class="kicker">C</div><h3 class="mt-2">Test automation tools</h3><p>Assume requirements exist. They generate tests from an external spec or from code — not from natural language.</p></div>
</div>

<div class="banner mt-7">
  <b>No tool auto-generates security requirements.</b> &nbsp;And <b>no tool keeps end-to-end traceability</b> across artifacts.
</div>

<!--
- Today's tools each cover only one slice of the spec phase — none spans the whole flow.
- Requirements tools stop at the SRS; UI prototypers assume requirements exist; test automators read an external spec or code, not natural language.
- Two specific gaps: no tool auto-generates security requirements, and no tool keeps end-to-end traceability across artifacts.
- This fragmentation is exactly the gap Req2UI closes.
-->

---
layout: topic
section: Objectives
title: "Five objectives"
subtitle: "What Req2UI set out to deliver."
---

<div class="grid grid-cols-5 gap-4 mt-8">
  <div class="card"><div class="num">01</div><h3 class="mt-3">Single input</h3><p>A plain-language description of a software system — no structured forms, no DSL.</p></div>
  <div class="card"><div class="num">02</div><h3 class="mt-3">Full SRS</h3><p>A complete IEEE 830 SRS: functional, non-functional &amp; security requirements.</p></div>
  <div class="card"><div class="num">03</div><h3 class="mt-3">Test cases</h3><p>Functional tests (IEEE 829) + security tests driven by OWASP Top 10 (2021).</p></div>
  <div class="card"><div class="num">04</div><h3 class="mt-3">UML + UI</h3><p>UML diagrams (use-case, class, sequence) + runnable HTML/Tailwind per screen.</p></div>
  <div class="card"><div class="num">05</div><h3 class="mt-3">Traceability + export</h3><p>End-to-end traceability + export as PDF, DOCX, LaTeX &amp; CSV.</p></div>
</div>

<!--
- Five objectives, mapping directly to the deliverables validated later.
- 1: a single natural-language input — no structured forms, no DSL.
- 2: a full IEEE 830 SRS — functional, non-functional, security.
- 3: tests — functional (IEEE 829) + security (OWASP Top 10 2021).
- 4 & 5: UML + runnable UI per screen, with traceability and four export targets.
-->

---
layout: topic
section: Related Work
title: "What exists, what's missing"
subtitle: "Each category covers one slice. Req2UI spans all five."
---

<table class="deck-table mt-5">
  <thead><tr><th>Category</th><th>Requirements</th><th>UI prototype</th><th>Tests</th><th>Security</th><th>Traceability</th></tr></thead>
  <tbody>
    <tr><td>Requirements generators</td><td class="yes">✓</td><td class="no">✕</td><td class="no">✕</td><td class="no">✕</td><td class="no">✕</td></tr>
    <tr><td>UI prototypers</td><td class="no">✕</td><td class="yes">✓</td><td class="no">✕</td><td class="no">✕</td><td class="no">✕</td></tr>
    <tr><td>Test automators</td><td class="no">✕</td><td class="no">✕</td><td class="yes">✓</td><td class="no">✕</td><td class="no">✕</td></tr>
    <tr><td>Security scanners</td><td class="no">✕</td><td class="no">✕</td><td class="partial">partial</td><td class="yes">✓</td><td class="no">✕</td></tr>
    <tr class="ours"><td>Req2UI &nbsp;<span class="pill" style="padding:2px 10px;font-size:11px">ours</span></td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td></tr>
  </tbody>
</table>

<div class="mt-5" style="color:#a5b4fc;font-style:italic;font-size:14px">First integrated NL → SRS → UI → functional + security tests pipeline, with auto security generation and full traceability.</div>

<!--
- Walk the table left to right: each category covers one slice — requirements, UI, tests, or security.
- Security scanners only "partial" on tests because they don't generate security requirements or run from natural language.
- Bottom row: Req2UI is the only entry with all five columns checked.
- The gap is integration, not any single capability.
-->

---
layout: topic
section: Solution
title: "One input. A complete, security-aware suite."
subtitle: "A single natural-language description drives a 10-stage AI pipeline."
---

<div class="grid items-stretch gap-3 mt-8" style="grid-template-columns:1fr auto 1fr auto 1fr">
  <div class="card card-accent"><div class="kicker">Step 01</div><h3 class="mt-3">Natural-language input</h3><p>The user describes the system in plain English.</p></div>
  <div class="flow-arrow">→</div>
  <div class="card card-accent"><div class="kicker">Step 02</div><h3 class="mt-3">10-stage AI pipeline</h3><p>Groq + Gemini generate artifacts concurrently.</p></div>
  <div class="flow-arrow">→</div>
  <div class="card card-accent"><div class="kicker">Step 03</div><h3 class="mt-3">Artifact suite</h3><p>SRS · tests · UML · UI code · traceability · exports.</p></div>
</div>

<div class="banner mt-7" style="display:flex;align-items:center;gap:14px">
  <span class="kicker">Export as</span>
  <span class="tag">PDF</span><span class="tag">DOCX</span><span class="tag">LaTeX</span><span class="tag">CSV</span>
</div>

<!--
- One input, full suite: the user describes a system in plain English and gets a complete, security-aware artifact bundle.
- Three stages: NL input, the 10-stage pipeline (Groq + Gemini, concurrent), and the artifact suite.
- Security is generated, not bolted on — it's a first-class pipeline stage.
- Export targets cover whatever format the audience needs.
-->

---
layout: topic
section: Architecture
title: "Layered architecture"
subtitle: "React SPA → Express API → Groq / Gemini → Neon Postgres."
---

<div class="grid gap-6 mt-4" style="grid-template-columns:1.25fr 1fr">
  <div class="card" style="display:flex;align-items:center;justify-content:center;background:#fff">
    <img src="/architecture.png" style="max-height:330px" alt="System architecture" />
  </div>
  <div class="flex flex-col gap-3">
    <div class="card"><div class="kicker">Presentation</div><h3 class="mt-1">React 19 SPA</h3><p>TypeScript app — Tailwind v4, Vite, React Router 7. An SSE listener streams live pipeline progress.</p></div>
    <div class="card"><div class="kicker">Application</div><h3 class="mt-1">Express 4 API</h3><p>Orchestrates the 10-stage pipeline. JWT auth, Zod validation, Helmet, rate limiting.</p></div>
    <div class="card"><div class="kicker">Data</div><h3 class="mt-1">PostgreSQL on Neon</h3><p>Serverless Postgres. Every artifact is keyed by (project, type) — the basis for resumability.</p></div>
  </div>
</div>

<!--
- Three clean layers: a React SPA on the front, an Express API in the middle, Postgres on Neon at the back.
- Front end is a TypeScript SPA with Tailwind + an SSE listener so the user watches the pipeline run live.
- The Express API is the brain — orchestrates the 10 stages and hardens every request (JWT, Zod, Helmet, rate limits).
- Neon Postgres is serverless; keying every artifact by (project, type) is what makes resume-on-failure possible.
-->

---
layout: topic
section: Pipeline
title: "The 10-stage pipeline"
subtitle: "From natural language to runnable artifacts."
---

<div class="dense">
<div class="grid grid-cols-5 gap-3 mt-3">
  <div class="card"><div class="num" style="font-size:19px">01</div><h3 class="mt-1">Requirement Extraction</h3><p>Parse NL; emit IEEE 830 narrative.</p></div>
  <div class="card"><div class="num" style="font-size:19px">02</div><h3 class="mt-1">Functional Reqs</h3><p>IEEE 830 "the system shall…".</p></div>
  <div class="card"><div class="num" style="font-size:19px">03</div><h3 class="mt-1">Non-Functional Reqs</h3><p>Performance, usability, reliability + metrics.</p></div>
  <div class="card"><div class="num" style="font-size:19px">04</div><h3 class="mt-1">Security Reqs</h3><p>Mapped to OWASP Top 10 (2021).</p></div>
  <div class="card"><div class="num" style="font-size:19px">05</div><h3 class="mt-1">Functional Tests</h3><p>IEEE 829 structured cases.</p></div>
  <div class="card"><div class="num" style="font-size:19px">06</div><h3 class="mt-1">Security Tests</h3><p>Attack-vector driven, OWASP-aligned.</p></div>
  <div class="card"><div class="num" style="font-size:19px">07</div><h3 class="mt-1">UI Wireframes</h3><p>Per-screen layout &amp; components.</p></div>
  <div class="card"><div class="num" style="font-size:19px">08</div><h3 class="mt-1">Traceability Matrix</h3><p>Req ↔ test ↔ security, coverage %.</p></div>
  <div class="card"><div class="num" style="font-size:19px">09</div><h3 class="mt-1">UML Diagrams</h3><p>Use-case, class, sequence (Mermaid).</p></div>
  <div class="card"><div class="num" style="font-size:19px">10</div><h3 class="mt-1">Runnable UI Code</h3><p>HTML + Tailwind, two-pass.</p></div>
</div>
</div>

<div class="banner mt-4" style="display:flex;gap:24px;flex-wrap:wrap;font-size:12.5px">
  <span>⑂ &nbsp;Sequential 1–2 · parallel 3–5 · 6–7 · 8–10</span>
  <span>◈ &nbsp;Stages 1–9 · Groq llama-3.3-70b</span>
  <span>◇ &nbsp;Stage 10 · Gemini 2.5-flash-lite</span>
</div>

<!--
- The pipeline is the centerpiece — ten stages turn one paragraph of NL into a full artifact suite.
- Stages 1 and 2 are sequential (stage 2 gates the rest); then parallelism layers in: 3–5 together, then 6–7, then 8–10.
- Stages 1–9 run on Groq's llama-3.3-70b — text artifacts, JSON-structured.
- Stage 10, the runnable UI code, is delegated to Google Gemini 2.5-flash-lite because code is its specialty.
- The 10-stage split is also what makes resume-on-failure cheap: each stage is independently persistable.
-->

---
layout: topic
section: Two-LLM Strategy
title: "Two LLMs, one pipeline"
subtitle: "Each model owns what it's best at."
---

<div class="grid grid-cols-2 gap-6 mt-6">
  <div class="card card-accent">
    <h3 style="font-size:24px;color:#818cf8">Groq</h3>
    <div class="kicker" style="font-family:Fira Code,monospace">llama-3.3-70b-versatile</div>
    <ul class="mt-4" style="color:#94a3b8;font-size:14px;line-height:1.9;list-style:disc;padding-left:18px">
      <li>Drives <b style="color:#e2e8f0">stages 1–9</b> — narrative, requirements, tests, traceability, UML.</li>
      <li>Fast inference on Groq's LPU keeps the pipeline responsive.</li>
      <li>Structured JSON output for reliable downstream parsing.</li>
      <li>Cost-efficient for high-volume text generation.</li>
    </ul>
  </div>
  <div class="card card-accent">
    <h3 style="font-size:24px;color:#60a5fa">Google Gemini</h3>
    <div class="kicker" style="font-family:Fira Code,monospace">gemini-2.5-flash-lite</div>
    <ul class="mt-4" style="color:#94a3b8;font-size:14px;line-height:1.9;list-style:disc;padding-left:18px">
      <li>Drives <b style="color:#e2e8f0">stage 10</b> — runnable UI code generation.</li>
      <li>Two-pass: a shared design system, then one HTML page per screen.</li>
      <li>Strong code generation at a fraction of a large model's cost.</li>
      <li>Produces Tailwind-styled, runnable HTML out of the box.</li>
    </ul>
  </div>
</div>

<div class="mt-5 muted" style="text-align:center;font-size:13px">A pipeline router dispatches each stage to its assigned model — no manual handoff.</div>

<!--
- Two LLMs, not one — each chosen for what it's actually best at.
- Groq llama-3.3-70b handles stages 1–9: fast on Groq's LPU, cheap, clean structured JSON.
- Gemini 2.5-flash-lite owns stage 10 — runnable UI code — because code is its specialty.
- The split keeps cost low: we don't pay premium-model prices for text we can generate cheaper.
- A pipeline router dispatches each stage to its model automatically.
-->

---
layout: topic
section: Concurrency
title: "Parallel stages, resumable runs"
subtitle: "Independent stages run concurrently; failures pick up where they stopped."
---

<div class="card mt-3" style="padding:16px 24px">
  <div class="grid items-center" style="grid-template-columns:230px 1fr;row-gap:11px">
    <div class="kicker" style="color:#818cf8">Lane A · sequential</div>
    <div><span class="tag">01</span> <span class="flow-arrow">→</span> <span class="tag">02</span></div>
    <div class="kicker" style="color:#818cf8">Lane B · parallel (after 02)</div>
    <div><span class="tag">03</span> <span class="tag">04</span> <span class="tag">05</span></div>
    <div class="kicker" style="color:#818cf8">Lane C · parallel (after 05)</div>
    <div><span class="tag">06</span> <span class="tag">07</span></div>
    <div class="kicker" style="color:#818cf8">Lane D · parallel (after 07)</div>
    <div><span class="tag">08</span> <span class="tag">09</span> <span class="tag">10</span></div>
  </div>
</div>

<div class="grid grid-cols-3 gap-4 mt-4">
  <div class="card"><h3>Persisted artifacts</h3><p>Every artifact saved keyed by (project, type).</p></div>
  <div class="card"><h3>Resume on failure</h3><p>Interrupted runs pick up from the last saved stage — no re-do.</p></div>
  <div class="card"><h3>Live progress</h3><p>Status pushed to the browser in real time via SSE.</p></div>
</div>

<!--
- Concurrency is layered, not flat. Lane A runs stage 01 then 02 sequentially (stage 02 gates the rest via a floor check).
- Lane B then fans out 03–05 in parallel; Lane C runs 06–07; Lane D finishes with 08–10.
- Layered parallelism cuts wall-clock time without making the dependency graph chaotic.
- Every artifact is persisted keyed by (project, type) — that lets a failed run resume from the last saved stage.
- Live progress is streamed to the browser via SSE.
-->

---
layout: topic
section: Security
title: "Security, not bolted on"
subtitle: "OWASP Top 10 requirements generated in stage 4; the auth stack hardened end-to-end."
---

<div class="banner mt-2"><span class="pill" style="margin-right:10px">Stage 4</span> Auto-generates security requirements aligned to OWASP Top 10 (2021).</div>

<div class="dense">
<div class="grid grid-cols-4 gap-3 mt-4">
  <div class="card"><h3>JWT access tokens</h3><p>15-minute TTL; signed &amp; verified per request.</p></div>
  <div class="card"><h3>Rotating refresh tokens</h3><p>7-day TTL, SHA-256 hashed, family theft detection.</p></div>
  <div class="card"><h3>bcrypt hashing</h3><p>Password hashing at cost factor 12.</p></div>
  <div class="card"><h3>Account lockout</h3><p>Locks for 15 min after 5 failed logins.</p></div>
  <div class="card"><h3>Helmet + CORS</h3><p>Security headers + strict CORS allow-list.</p></div>
  <div class="card"><h3>Zod validation</h3><p>Every API route validates its payload.</p></div>
  <div class="card"><h3>Rate limiting</h3><p>Auth (5/15min) + generation (10/hr) throttled.</p></div>
  <div class="card"><h3>Secrets in env</h3><p>API keys in env vars, never in source.</p></div>
</div>
</div>

<!--
- Security is generated, not bolted on — stage 4 auto-emits OWASP Top 10 (2021) requirements as part of the spec.
- Auth stack hardened end-to-end: JWT access tokens (15-min TTL), rotating refresh tokens (SHA-256 hashed, family-theft detection).
- Passwords use bcrypt at cost factor 12; accounts lock for 15 minutes after five failed logins.
- Every route validates payloads with Zod; Helmet sets headers; CORS is an allow-list; rate-limits guard auth (5/15min) and generation (10/hr).
- Two layers: requirements generated in the spec, controls enforced in the app.
-->

---
layout: topic
section: UML + UI Code
title: "Diagrams and runnable UI"
subtitle: "Mermaid → PNG for UML; HTML + Tailwind per screen for UI."
---

<div class="grid gap-6 mt-4" style="grid-template-columns:1fr 1fr">
  <div class="card" style="display:flex;align-items:center;justify-content:center;background:#fff">
    <img src="/class.png" style="max-height:330px" alt="Generated class diagram" />
  </div>
  <div class="flex flex-col gap-4">
    <div class="card"><div class="kicker" style="color:#818cf8">UML — use-case · class · sequence</div>
      <p class="mt-2">Diagrams are emitted as <b style="color:#e2e8f0">Mermaid</b> — editable, version-controllable text — then rasterized to PNG via resvg-js for embedding in the PDF export.</p></div>
    <div class="card"><div class="kicker" style="color:#60a5fa">UI code (stage 10) — two-pass</div>
      <p class="mt-2"><b style="color:#e2e8f0">Pass 1</b> generates a shared design system (colors, type, spacing, components). <b style="color:#e2e8f0">Pass 2</b> emits one HTML + Tailwind page per distinct screen, all consuming it — a consistent, runnable prototype.</p></div>
  </div>
</div>

<!--
- UML — use-case, class, sequence — is emitted as Mermaid, so it's editable text and version-controllable.
- We rasterize Mermaid to PNG via resvg-js so the same diagrams embed cleanly into the PDF export.
- UI code is stage 10, run by Gemini, using a deliberate two-pass strategy.
- Pass 1 generates a shared design system; Pass 2 emits one HTML + Tailwind page per distinct screen consuming it — low-fidelity but consistent and runnable.
-->

---
layout: topic
section: Traceability
title: "Every artifact links to every other"
subtitle: "An illustrative matrix with coverage %, plus four export targets."
---

<div class="grid gap-6 mt-4" style="grid-template-columns:1.3fr 1fr">
  <div>
    <table class="deck-table">
      <thead><tr><th>Requirement</th><th>Test case</th><th>Security</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td><span style="color:#818cf8">FR-01</span> User login</td><td>TC-001</td><td>—</td><td class="yes">✓</td></tr>
        <tr><td><span style="color:#818cf8">SR-01</span> OWASP A07</td><td>—</td><td>STC-005</td><td class="yes">✓</td></tr>
        <tr><td><span style="color:#818cf8">FR-04</span> Export PDF</td><td>TC-018</td><td>—</td><td class="yes">✓</td></tr>
        <tr><td><span style="color:#818cf8">NFR-02</span> Response &lt; 500ms</td><td>TC-022</td><td>—</td><td class="yes">✓</td></tr>
        <tr><td><span style="color:#818cf8">SR-03</span> OWASP A03</td><td>—</td><td>STC-009</td><td class="yes">✓</td></tr>
      </tbody>
    </table>
    <div class="banner mt-4" style="font-size:13px"><b>Example coverage:</b> each FR maps to a test case; each SR to a security test. Real coverage is computed per project.</div>
  </div>
  <div class="grid grid-cols-2 gap-3" style="align-content:start">
    <div class="card"><h3 style="font-size:15px">PDF</h3><p>Stakeholder-ready bundle.</p></div>
    <div class="card"><h3 style="font-size:15px">DOCX</h3><p>Editable for downstream revision.</p></div>
    <div class="card"><h3 style="font-size:15px">LaTeX</h3><p>Academic / publication-ready.</p></div>
    <div class="card"><h3 style="font-size:15px">CSV</h3><p>Machine-readable matrix.</p></div>
  </div>
</div>

<!--
- The traceability matrix is generated, not maintained by hand — each requirement links to its test case and (where applicable) its security control.
- The rows shown are illustrative; real coverage is computed per project (every FR has a test, every SR has a security test).
- The same matrix drives exports, so a stakeholder's PDF matches what the engineer sees in-app.
- Four formats cover every audience: PDF (stakeholders), DOCX (editing), LaTeX (academic), CSV (tooling).
-->

---
layout: topic
section: Walkthrough
title: "One paragraph → a full spec"
subtitle: "A worked example — illustrative output from a single description."
---

<div class="grid gap-5 mt-3" style="grid-template-columns:0.9fr 1.1fr">
  <div class="card" style="background:#0b1426">
    <div class="kicker" style="color:#818cf8">Input · natural language</div>
    <p class="mt-3" style="color:#cbd5e1;font-size:14px;line-height:1.7">"A web app where students enroll in courses, submit assignments, and instructors grade them. Users sign in with email and password; admins manage accounts."</p>
    <div class="mt-4 flow-arrow" style="font-size:18px">↓ &nbsp;<span class="kicker" style="color:#64748b">10-stage pipeline</span></div>
  </div>
  <div class="dense flex flex-col gap-2.5">
    <div class="card"><b style="color:#818cf8;font-size:12px">FR-002 · High</b><p style="margin-top:3px">The system shall allow students to enroll in available courses.</p></div>
    <div class="card"><b style="color:#818cf8;font-size:12px">NFR-001 · Performance</b><p style="margin-top:3px">Respond within 2 s for 95% of requests <span class="muted">· metric tracked</span>.</p></div>
    <div class="card"><b style="color:#60a5fa;font-size:12px">SR-001 · OWASP A01 Broken Access Control</b><p style="margin-top:3px">Enforce role-based access control with least privilege.</p></div>
    <div class="card"><b style="color:#34d399;font-size:12px">TC-001 → covers FR-002</b><p style="margin-top:3px">Enroll in a course → confirmation shown; course appears in "My courses".</p></div>
    <div class="card" style="background:rgba(79,70,229,.1)"><b style="font-size:12px">Traceability</b><p style="margin-top:3px">FR-002 → TC-001 · SR-003 &nbsp;|&nbsp; every requirement linked.</p></div>
  </div>
</div>

<!--
- Make it concrete: from one short paragraph the pipeline derives the whole spec.
- This is an illustrative example, not a fixed template — point out the IEEE 830 functional requirement, the measurable NFR, the OWASP-mapped security requirement, and the IEEE 829 test case that traces back to it.
- The traceability link is generated automatically — no manual mapping.
- This is the single most convincing artifact to demo live if the committee asks.
-->

---
layout: topic
section: Tech Stack
title: "Built on a modern TypeScript stack"
subtitle: "One language end-to-end — frontend, backend, and tooling."
---

<div class="grid grid-cols-2 gap-5 mt-6">
  <div class="card"><div class="kicker" style="color:#818cf8">Frontend</div><div class="mt-3">
    <span class="tag">React 19</span><span class="tag">TypeScript</span><span class="tag">Tailwind CSS v4</span><span class="tag">Vite</span><span class="tag">React Router 7</span></div></div>
  <div class="card"><div class="kicker" style="color:#818cf8">Backend</div><div class="mt-3">
    <span class="tag">Node.js</span><span class="tag">Express 4</span><span class="tag">TypeScript</span><span class="tag">JWT</span><span class="tag">Zod</span><span class="tag">Helmet</span><span class="tag">bcrypt</span></div></div>
  <div class="card"><div class="kicker" style="color:#60a5fa">Data &amp; AI</div><div class="mt-3">
    <span class="tag">PostgreSQL · Neon</span><span class="tag">Groq llama-3.3-70b</span><span class="tag">Gemini 2.5-flash-lite</span></div></div>
  <div class="card"><div class="kicker" style="color:#60a5fa">Export &amp; deploy</div><div class="mt-3">
    <span class="tag">pdfkit</span><span class="tag">docx.js</span><span class="tag">csv-writer</span><span class="tag">resvg-js</span><span class="tag">Vercel (FE)</span><span class="tag">Render (BE)</span></div></div>
</div>

<!--
- One language end-to-end: TypeScript across the React SPA, the Express API, and shared types.
- Frontend: React 19 on Vite with Tailwind v4 and React Router 7; React 19 concurrent features power the live SSE progress UI.
- Backend: Express 4 with JWT auth, Zod validation, Helmet headers, bcrypt hashing.
- Data: serverless Postgres on Neon — pay-per-use, branchable.
- AI consumed as managed APIs (Groq, Gemini); export toolchain runs server-side; deploy is split Vercel (FE) + Render (BE).
-->

---
layout: topic
section: Product
title: "The product, live"
subtitle: "Deployed and running at req-2-ui.vercel.app — real screens."
---

<div class="grid grid-cols-3 gap-5 mt-4">
  <div>
    <div class="browser">
      <div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">req-2-ui.vercel.app/</span></div>
      <img class="bimg" src="/screens/landing.png" />
    </div>
    <div class="cap"><b>Landing</b> — the pitch in one screen.</div>
  </div>
  <div>
    <div class="browser">
      <div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/login</span></div>
      <img class="bimg" src="/screens/login.png" />
    </div>
    <div class="cap"><b>Sign in</b> — JWT auth, silent refresh.</div>
  </div>
  <div>
    <div class="browser">
      <div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/register</span></div>
      <img class="bimg" src="/screens/register.png" />
    </div>
    <div class="cap"><b>Register</b> — bcrypt, Zod-validated.</div>
  </div>
</div>

<div class="mt-5 muted" style="text-align:center;font-size:13px">Live and deployed: Vercel (frontend) + Render (backend) + Neon (database).</div>

<!--
- These are real, live screens from the deployed app at req-2-ui.vercel.app — not mockups.
- Landing communicates the value proposition; sign-in and register show the hardened auth flow (JWT, silent refresh, bcrypt, Zod validation).
- The whole product is deployed: Vercel front end, Render back end, Neon database.
- Offer to open it live for the committee.
-->

---
layout: topic
section: Live Demo
title: "Inside the app"
subtitle: "The authenticated workflow — four screens we can walk through live."
---

<div class="grid grid-cols-4 gap-4 mt-5">
  <div>
    <div class="browser"><div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/dashboard</span></div>
      <div class="ph"><span class="big">Dashboard</span><span>screenshot to be added</span></div></div>
    <div class="cap">Project list, status badges, quick actions.</div>
  </div>
  <div>
    <div class="browser"><div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/projects/:id</span></div>
      <div class="ph"><span class="big">Project Detail</span><span>live SSE progress</span></div></div>
    <div class="cap">10 stages streaming live; re-run or resume.</div>
  </div>
  <div>
    <div class="browser"><div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/artifacts</span></div>
      <div class="ph"><span class="big">Artifacts Viewer</span><span>SRS · tests · UML</span></div></div>
    <div class="cap">Every artifact, individually downloadable.</div>
  </div>
  <div>
    <div class="browser"><div class="bar"><span class="bdot"/><span class="bdot"/><span class="bdot"/><span class="burl">/ui-preview</span></div>
      <div class="ph"><span class="big">UI Preview</span><span>generated HTML</span></div></div>
    <div class="cap">Generated screens in a sandboxed iframe.</div>
  </div>
</div>

<div class="mt-5 muted" style="text-align:center;font-size:13px">Best seen live — a full walkthrough is available on request.</div>

<!--
- The authenticated workflow, behind login. (Placeholder frames here — drop real captures into public/screens/ and swap the .ph blocks for <img>.)
- Dashboard: project list, status badges, last-run timestamp, quick actions.
- Project Detail (centerpiece): the 10-stage pipeline with live SSE progress; re-run or resume from any saved stage.
- Artifacts Viewer: lists every artifact (SRS, tests, UML, UI code), each downloadable.
- UI Preview: opens the generated HTML + Tailwind per screen in a sandboxed iframe.
- Offer a live walkthrough.
-->

---
layout: topic
section: Spotlight
title: "The AI writes runnable UI"
subtitle: "Stage 10 — Gemini generates real HTML + Tailwind, not just descriptions."
---

<div class="grid gap-5 mt-3" style="grid-template-columns:1fr 1fr">
  <div class="flex flex-col gap-3">
    <div class="card card-accent"><b style="color:#818cf8;font-size:12.5px">Pass 1 · design system</b><p style="margin-top:4px">A shared navbar, footer, Tailwind theme, and component language — so every screen is consistent.</p></div>
    <div class="card card-accent"><b style="color:#60a5fa;font-size:12.5px">Pass 2 · per-screen pages</b><p style="margin-top:4px">One complete HTML page per <em>distinct</em> screen (deduplicated by category), all consuming the design system.</p></div>
    <div class="card"><b style="font-size:12.5px">Result</b><p style="margin-top:4px">Low-fidelity but <b style="color:#e2e8f0">runnable</b> — opens straight in a browser; great for early stakeholder feedback.</p></div>
  </div>
  <div>
    <div class="kicker" style="color:#64748b">Representative generated output</div>

```html
<nav class="bg-slate-900 border-b border-slate-800">
  <div class="flex items-center justify-between px-6 h-14">
    <span class="font-bold text-indigo-400">CourseHub</span>
    <a class="btn-primary" href="/enroll">Enroll</a>
  </div>
</nav>
<main class="grid gap-4 p-8 md:grid-cols-3">
  <article class="rounded-xl bg-slate-900 p-5">
    <h3 class="font-semibold">Intro to Databases</h3>
    <p class="text-slate-400">12 lessons · 4 assignments</p>
    <button class="mt-3 btn-primary">Enroll now</button>
  </article>
</main>
```

  </div>
</div>

<!--
- This is the project's "wow" — the system doesn't just describe screens, it generates runnable HTML + Tailwind.
- Two-pass: a shared design system first, then one page per distinct screen, all consuming it — consistency by construction.
- The snippet is representative generated output (Tailwind-styled, runnable). Offer to open a generated screen live.
- It's intentionally low-fidelity — a prototype scaffold, not production markup.
-->

---
layout: topic
section: Testing
title: "Validated, not just demoed"
subtitle: "Automated tests + standards conformance across every artifact type."
---

<div class="grid grid-cols-3 gap-4 mt-6">
  <div class="card card-accent"><div class="num">24</div><div class="kicker mt-2">Automated tests passing</div><p class="mt-1">Across 2 suites: auth routes + export service.</p></div>
  <div class="card"><h3 style="color:#818cf8">IEEE 830</h3><p class="mt-1">Generated SRS follows IEEE 830 structure.</p></div>
  <div class="card"><h3 style="color:#818cf8">IEEE 829</h3><p class="mt-1">Test cases use IEEE 829 fields.</p></div>
  <div class="card"><h3 style="color:#60a5fa">OWASP Top 10 (2021)</h3><p class="mt-1">Every SR linked to a Top-10 category.</p></div>
  <div class="card"><h3 style="color:#60a5fa">IEEE 12207</h3><p class="mt-1">Process standard followed end-to-end.</p></div>
  <div class="card"><h3 style="color:#818cf8">UML</h3><p class="mt-1">Use-case, class, sequence per the UML spec.</p></div>
</div>

<!--
- Validation is two-pronged: automated tests for code paths, standards-based conformance for artifacts.
- 24 automated tests pass across 2 suites — auth routes (registration, login, refresh, lockout) and export service (PDF/DOCX/CSV/LaTeX generation).
- SRS follows IEEE 830; test cases follow IEEE 829; security requirements map to OWASP Top 10 (2021); process aligns to IEEE 12207; diagrams follow the UML spec.
-->

---
layout: topic
section: By the Numbers
title: "Req2UI by the numbers"
subtitle: "One paragraph in — a whole spec phase out."
---

<div class="grid grid-cols-3 gap-5 mt-7">
  <div class="card"><div class="stat">10 <span class="u">stages</span></div><p class="mt-2">end-to-end AI pipeline.</p></div>
  <div class="card"><div class="stat">10 <span class="u">artifact types</span></div><p class="mt-2">reqs, tests, UML, UI, traceability.</p></div>
  <div class="card"><div class="stat">2 <span class="u">LLMs</span></div><p class="mt-2">Groq for text, Gemini for code.</p></div>
  <div class="card"><div class="stat">10 <span class="u">OWASP cats</span></div><p class="mt-2">Top 10 (2021) mapped in stage 4.</p></div>
  <div class="card"><div class="stat">4 <span class="u">export formats</span></div><p class="mt-2">PDF · DOCX · LaTeX · CSV.</p></div>
  <div class="card"><div class="stat">24 <span class="u">tests passing</span></div><p class="mt-2">across auth + export suites.</p></div>
</div>

<div class="mt-6 muted" style="text-align:center;font-size:13px">Three IEEE standards (830, 829, 12207) · resumable, concurrent runs · live streamed to the browser.</div>

<!--
- Quantify the value: one short paragraph produces a full spec phase.
- 10 stages, 10 artifact types, 2 specialized LLMs, OWASP Top 10 coverage, 4 export formats, 24 passing tests.
- Reinforce standards conformance and the engineering niceties (resumable, concurrent, streamed).
- These are concrete, defensible numbers — all traceable to the codebase.
-->

---
layout: topic
section: Value
title: "Manual spec phase vs. Req2UI"
subtitle: "Same deliverables — a fraction of the effort."
---

<table class="deck-table mt-4">
  <thead><tr><th style="width:26%">Dimension</th><th>Manual / today's tools</th><th>Req2UI</th></tr></thead>
  <tbody>
    <tr><td>Time to first draft</td><td>Days to weeks <span class="muted">(typical)</span></td><td class="yes">Minutes</td></tr>
    <tr><td>Consistency</td><td>Varies by author</td><td class="yes">Standardised, IEEE-structured</td></tr>
    <tr><td>Security requirements</td><td>Often skipped / late</td><td class="yes">OWASP Top 10, by default</td></tr>
    <tr><td>Test cases</td><td>Separate effort</td><td class="yes">Generated (functional + security)</td></tr>
    <tr><td>UI prototype</td><td>Different tool, no link to spec</td><td class="yes">Generated, requirement-driven</td></tr>
    <tr><td>Traceability</td><td>Manual or missing</td><td class="yes">Automatic, end-to-end</td></tr>
  </tbody>
</table>

<div class="mt-4 muted" style="font-size:12.5px">Time figures are typical/illustrative, not a controlled benchmark.</div>

<!--
- Same deliverables a team would produce by hand — at a fraction of the effort and with no gaps.
- The honest framing: time figures are typical/illustrative, not a controlled benchmark.
- The real wins are structural: security and traceability come for free, and the UI prototype is driven by the requirements rather than drawn separately.
-->

---
layout: topic
section: Results
title: "What we delivered"
subtitle: "Five objectives, five outcomes — all met."
---

<div class="flex flex-col gap-3 mt-5">
  <div class="card" style="display:flex;align-items:center;gap:18px;padding:14px 20px"><span class="num" style="font-size:22px">01</span><div style="flex:1"><b>Single input</b> — accepts free-form plain-language descriptions.</div><span class="pill" style="background:rgba(52,211,153,.12);border-color:#1f6f53;color:#34d399">Met</span></div>
  <div class="card" style="display:flex;align-items:center;gap:18px;padding:14px 20px"><span class="num" style="font-size:22px">02</span><div style="flex:1"><b>Full SRS</b> — IEEE 830 with functional, non-functional &amp; security requirements.</div><span class="pill" style="background:rgba(52,211,153,.12);border-color:#1f6f53;color:#34d399">Met</span></div>
  <div class="card" style="display:flex;align-items:center;gap:18px;padding:14px 20px"><span class="num" style="font-size:22px">03</span><div style="flex:1"><b>Test cases</b> — functional (IEEE 829) + security (OWASP-driven).</div><span class="pill" style="background:rgba(52,211,153,.12);border-color:#1f6f53;color:#34d399">Met</span></div>
  <div class="card" style="display:flex;align-items:center;gap:18px;padding:14px 20px"><span class="num" style="font-size:22px">04</span><div style="flex:1"><b>UML + UI</b> — Mermaid diagrams + HTML/Tailwind per screen.</div><span class="pill" style="background:rgba(52,211,153,.12);border-color:#1f6f53;color:#34d399">Met</span></div>
  <div class="card" style="display:flex;align-items:center;gap:18px;padding:14px 20px"><span class="num" style="font-size:22px">05</span><div style="flex:1"><b>Traceability + exports</b> — coverage matrix + PDF/DOCX/LaTeX/CSV.</div><span class="pill" style="background:rgba(52,211,153,.12);border-color:#1f6f53;color:#34d399">Met</span></div>
</div>

<!--
- Each of the five objectives from slide 5 maps to a concrete, demonstrable deliverable.
- Single input; full IEEE 830 SRS; IEEE 829 + OWASP test cases; Mermaid UML + HTML/Tailwind UI; coverage matrix + four export bundles.
- The gap from the problem statement is closed: first integrated pipeline of its kind.
-->

---
layout: topic
section: Limits & Future
title: "Honest limits, clear roadmap"
subtitle: "What's bounded — and where we go next."
---

<div class="grid grid-cols-2 gap-6 mt-5">
  <div class="card">
    <div class="kicker" style="color:#fbbf24">Limitations</div>
    <ul class="mt-3" style="color:#94a3b8;font-size:13.5px;line-height:1.8;list-style:disc;padding-left:18px">
      <li>Output quality tracks the LLM and the detail of the input.</li>
      <li>Throughput is bounded by free-tier API rate limits (Groq &amp; Gemini).</li>
      <li>Generated UI is a low-fidelity prototype — not production markup.</li>
      <li>Some NFR targets (load, full WCAG) need dedicated test runs.</li>
      <li>OWASP coverage is Top-10-only; ASVS depth is future work.</li>
    </ul>
  </div>
  <div class="card card-accent">
    <div class="kicker" style="color:#818cf8">Future work</div>
    <ul class="mt-3" style="color:#94a3b8;font-size:13.5px;line-height:1.8;list-style:disc;padding-left:18px">
      <li>Admin dashboard for project + user management.</li>
      <li>In-app artifact editing and refinement.</li>
      <li>Self-critique refinement loops (LLM reviews its own output).</li>
      <li>More export targets (Markdown, OpenAPI).</li>
      <li>Domain fine-tuning / retrieval augmentation; ASVS-level security.</li>
      <li>Auto-run generated tests against the generated UI.</li>
    </ul>
  </div>
</div>

<!--
- Be candid, then point forward. Output quality tracks both the LLM and the user's input detail.
- Throughput is gated by free-tier rate limits — a budget unlock, not an architectural one.
- Generated UI is intentionally low-fidelity; some NFR targets still need dedicated runs; OWASP is Top-10-only today.
- Roadmap is concrete and incremental: admin tooling, in-app editing, self-critique loops, more exports, fine-tuning, ASVS, auto-running tests.
-->

---
layout: statement
section: Conclusion
---

<div class="eyebrow">Conclusion</div>
<h1 class="mt-3">Req2UI closes <span class="grad">the gap.</span></h1>
<p>The first integrated pipeline covering natural language → SRS → UI prototype → functional + security test cases — with automatic security generation and full end-to-end traceability.</p>
<div class="tagline">One input · ten stages · a complete, security-aware artifact suite</div>
<div class="mt-6"><span class="tag">IEEE 830</span><span class="tag">IEEE 829</span><span class="tag">OWASP Top 10 (2021)</span></div>

<!--
- One sentence: Req2UI closes the gap stated earlier.
- The pipeline is the first integrated coverage from natural language to SRS, to UI prototype, to functional and security test cases.
- Two differentiators to remember: security is generated, not bolted on; traceability is end-to-end.
- Pause briefly, then invite questions.
-->

---
layout: topic
section: References
title: "References & standards"
subtitle: "Grounded in the literature and recognised standards."
---

<div class="grid gap-6 mt-3" style="grid-template-columns:1.5fr 1fr">
  <div class="dense">
    <div class="kicker" style="color:#818cf8">Selected references</div>
    <ol class="mt-3" style="color:#94a3b8;font-size:12px;line-height:1.55;padding-left:20px">
      <li>O. Matsuura et al. — <i>Automatic generation of web-based UI prototypes from UML requirements models.</i></li>
      <li>R. Khankhoje — <i>An In-Depth Review of Test Automation Frameworks: Types and Trade-offs.</i></li>
      <li>B. Wei (2023) — <i>Requirements Are All You Need: From Requirements to Code with LLMs.</i></li>
      <li>S. K. T. Pushparaj et al. — <i>A Survey on Automatic Test Case Generation.</i></li>
      <li>A. Fatima et al. (2025) — <i>NLP-based generation of software test cases.</i></li>
      <li>A. Goknil et al. (2015) — <i>Automatic Generation of System Test Cases from Use Case Specifications.</i></li>
      <li>R. Batool et al. (2025) — <i>Automated Categorization of Software Security Requirements.</i></li>
    </ol>
  </div>
  <div class="flex flex-col gap-3">
    <div class="card"><div class="kicker" style="color:#60a5fa">Standards applied</div>
      <div class="mt-3"><span class="tag">IEEE 830</span><span class="tag">IEEE 829</span><span class="tag">IEEE 12207</span><span class="tag">OWASP Top 10 (2021)</span><span class="tag">UML</span><span class="tag">WCAG 2.1 AA</span></div></div>
    <div class="card"><div class="kicker">Built with</div>
      <div class="mt-3"><span class="tag">React 19</span><span class="tag">Express</span><span class="tag">Neon Postgres</span><span class="tag">Groq</span><span class="tag">Gemini</span><span class="tag">Slidev</span></div></div>
  </div>
</div>

<!--
- Credibility slide: the approach is grounded in the literature (requirements-to-code with LLMs, NLP-based test generation, security-requirement extraction) and built on recognised standards (IEEE 830/829/12207, OWASP Top 10, UML).
- Keep brief; this is here so the committee can see the academic footing and ask for specifics.
-->

---
layout: statement
section: Thank You
---

<h1>Thank <span class="grad">you.</span></h1>
<p>Questions are welcome — on any stage, decision, or trade-off.</p>

<div class="cover-people mt-8" style="text-align:center">
  <div><span class="lbl">Team</span> Mennatallah Hany · Mayar Hany · Yasmin Haitham · Malak Tarek · Mohamed Bassem</div>
  <div class="mt-2"><span class="lbl">Supervisor</span> Dr. Salma Radwan Abdel-Hamid</div>
  <div class="muted mt-3" style="font-size:13px">Arab Academy for Science, Technology &amp; Maritime Transport — 2025/2026</div>
</div>

<!--
- Keep it warm and brief. Thank the committee for their time and attention.
- Thank our supervisor Dr. Salma Radwan Abdel-Hamid for her guidance and feedback.
- Thank the team — Mennatallah, Mayar, Yasmin, Malak, and Mohamed.
- Acknowledge AASTMT and the College of Computing and Information Technology.
- Open the floor: ready to go deep on architecture, security, or the pipeline.
-->
