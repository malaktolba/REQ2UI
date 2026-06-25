# Req2UI

> **AASTMT Graduation Project** — Transforms a natural-language software description into a complete set of IEEE-standard software engineering artifacts using a 10-stage AI pipeline.

**Live demo:** [req-2-ui.vercel.app](https://req-2-ui.vercel.app)

---

## What it does

Paste a project description and Req2UI streams through 10 pipeline stages, generating:

| # | Artifact | Standard | LLM |
|---|----------|----------|-----|
| 1 | Requirement extraction + SRS narrative | — | Groq |
| 2 | Functional requirements | IEEE 830 | Groq |
| 3 | Non-functional requirements | IEEE 830 | Groq |
| 4 | Security requirements | OWASP Top 10 (2021) | Groq |
| 5 | Functional test cases | IEEE 829 | Groq |
| 6 | Security test cases | — | Groq |
| 7 | UI wireframe descriptions | — | Groq |
| 8 | Traceability matrix | — | Groq |
| 9 | UML diagrams (Use Case, Class, Sequence) | UML 2.x / Mermaid.js | Groq |
| 10 | UI code (HTML + Tailwind, per screen) | — | Gemini |

Artifacts are viewable in an IEEE 830-structured SRS document tab and individually, with export to **PDF**, **DOCX**, **CSV**, and **LaTeX**.

### UI code generation (Stage 10)

Stage 10 is a two-pass Gemini process designed for coherent, realistic prototypes:

- **Shared design system + component kit** — pass one produces a navbar, footer, and a reusable set of canonical Tailwind class strings (buttons, inputs, cards, badges, tables, empty states) that every screen reuses verbatim, so pages stay visually consistent instead of drifting.
- **Shared sample data** — realistic, domain-appropriate records are generated once and threaded through every screen, so the same entities recur and the app feels connected.
- **Requirement grounding** — each screen's prompt is grounded in its components and the functional requirements relevant to it (with a sensible fallback), plus rules for Lucide icons, accessibility (landmarks, `aria`, AA contrast), responsiveness, and loading/empty/error states.
- **Deterministic theming** — the accent is owned by code: picking a custom primary colour derives a full 50–900 scale and remaps Tailwind's `indigo`, so the whole app recolours reliably. The preview also offers **instant, no-AI recolor** across accent swatches.
- **Robustness** — generated HTML is validated for completeness and regenerated once at a larger token budget if truncated.
- **Post-generation refinement** — refine the result with natural-language instructions scoped to a page, several pages, or the whole design system; changes are previewed as a pending revision before being applied, discarded, or rolled back via revision history.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| Backend | Node.js 22, Express, TypeScript |
| Database | PostgreSQL (Neon serverless) |
| Auth | JWT (15 min access) + Refresh tokens + httpOnly cookies |
| AI | Groq API — llama-3.3-70b-versatile (requirements/analysis) · Gemini 2.5 Flash-Lite (UI code generation) |
| Export | pdfkit, docx.js, Mermaid.js → PNG (resvg-js) |
| UML rendering | Mermaid.js (browser) + resvg-js (PDF export) |
| Deployment | Vercel (frontend) · Render (backend) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (free tier works)
- A [Groq](https://console.groq.com) API key (free)
- A [Gemini](https://aistudio.google.com/apikey) API key (free) — used for UI code generation

### 1. Clone

```bash
git clone https://github.com/malaktolba/REQ2UI.git
cd REQ2UI
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, GROQ_API_KEY, GEMINI_API_KEY, FRONTEND_URL
npm install
npm run migrate      # creates tables in Neon
npm run dev          # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
# VITE_API_BASE_URL is empty for local dev — Vite proxy forwards /api → localhost:4000
npm install
npm run dev          # http://localhost:5173
```

---

## Project Structure

```
REQ2UI/
├── backend/
│   ├── src/
│   │   ├── config/         # env validation (zod)
│   │   ├── db/             # Neon client + migrations
│   │   ├── middleware/      # JWT auth guard
│   │   ├── routes/         # auth · projects · generate · export · artifacts
│   │   └── services/
│   │       ├── groq.service.ts      # Groq SDK wrapper (analysis stages)
│   │       ├── gemini.service.ts    # Gemini SDK wrapper (UI code gen)
│   │       ├── pipeline.service.ts  # 10-stage orchestrator + SSE
│   │       └── export.service.ts    # PDF · DOCX · LaTeX · CSV
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/            # axios instance + project helpers
│   │   ├── components/     # Icons, ThemeToggle, ProtectedRoute, Toast
│   │   ├── context/        # AuthContext · ToastContext · ThemeContext
│   │   ├── pages/
│   │   │   ├── ArtifactsViewer.tsx  # tabbed SRS viewer + IEEE 830 doc view
│   │   │   ├── ProjectDetail.tsx     # SSE pipeline progress
│   │   │   ├── Dashboard.tsx
│   │   │   └── ...
│   │   └── types/
│   └── vercel.json
├── thesis/                 # LaTeX graduation thesis + UML figures (see thesis/README.md)
├── deck/                   # defense presentation (see deck/README.md)
│   ├── slidev/             #   primary: code-based Slidev deck
│   └── legacy-pptx/        #   fallback: editable PowerPoint
├── render.yaml
└── README.md
```

---

## Thesis & Presentation

Academic deliverables live alongside the code:

| Folder | What | Build |
|--------|------|-------|
| [`thesis/`](thesis/) | IEEE 830-structured LaTeX thesis + PlantUML figures | Overleaf (pdfLaTeX) — see `thesis/README.md` |
| [`deck/slidev/`](deck/slidev/) | Defense deck (Markdown + Slidev), 27 slides | `npm install && npm run export` — see `deck/slidev/README.md` |
| [`deck/legacy-pptx/`](deck/legacy-pptx/) | Earlier PowerPoint deck (hand-editable fallback) | open in PowerPoint |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, sets httpOnly refresh cookie |
| POST | `/api/auth/refresh` | Rotate access token |
| POST | `/api/auth/logout` | Clear cookies |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create project (optional `metadata`, `ui_preferences`) |
| GET | `/api/projects/:id` | Get project + stage statuses |
| PUT | `/api/projects/:id` | Update project name / metadata |
| DELETE | `/api/projects/:id` | Soft delete |
| GET | `/api/projects/:id/generate` | Run pipeline — SSE stream (`?token=<jwt>`) |
| GET | `/api/projects/:id/generate/ui-code` | Re-run only Stage 10 (UI code) — SSE |
| GET | `/api/projects/:id/refine` | AI-refine generated UI — SSE (`?prompt=&scope=`) |
| POST | `/api/projects/:id/ui-code/apply` | Apply the pending refined UI |
| POST | `/api/projects/:id/ui-code/discard` | Discard the pending refined UI |
| GET | `/api/projects/:id/ui-code/revisions` | List UI revision history |
| POST | `/api/projects/:id/ui-code/revisions/:version/restore` | Roll back to a UI revision |
| GET | `/api/projects/:id/ui-code/suggestions` | Suggested refinement prompts |
| GET | `/api/projects/:id/artifacts` | All artifacts |
| GET | `/api/projects/:id/artifacts/:type` | Single artifact |
| POST | `/api/projects/:id/export/pdf` | Export PDF (body: `{ diagramSvgs }`) |
| GET | `/api/projects/:id/export/docx` | Export DOCX |
| GET | `/api/projects/:id/export/csv` | Export CSV |
| GET | `/api/projects/:id/export/latex` | Export LaTeX (.tex) |

---

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Backend | Render (free) | `render.yaml` · build: `npm install --include=dev && npm run build` |
| Frontend | Vercel | `frontend/vercel.json` · root dir: `frontend/` |

**Required env vars on Render:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `FRONTEND_URL`, `NODE_ENV=production`

**Required env vars on Vercel:** `VITE_API_BASE_URL=https://req2ui-backend.onrender.com`

---

*Built for AASTMT graduation — 2026*
