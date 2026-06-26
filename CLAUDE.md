# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

REQ2UI is a full-stack SaaS app that converts raw software requirements into complete SRS documents (IEEE 830) via a 10-stage AI pipeline. It generates functional/non-functional/security requirements, test cases, UML diagrams, traceability matrices, and UI code — then exports as PDF, DOCX, CSV, or LaTeX.

## Commands

### Backend
```bash
cd backend
npm run dev          # ts-node-dev with hot reload on port 4000
npm run build        # tsc → dist/
npm start            # node dist/index.js (production)
npm run migrate      # run DB migrations against Neon
npm test             # jest --runInBand
```

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server on port 5173 (proxies /api → localhost:4000)
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm run preview      # preview production build
```

### Full local dev
Start backend first, then frontend. The Vite dev server proxies `/api/*` to `http://localhost:4000`.

## Environment Variables

**Backend** (`.env` in `backend/`):
```
DATABASE_URL=postgresql://...     # Neon serverless connection string
JWT_SECRET=<random>
JWT_REFRESH_SECRET=<random>
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`.env` in `frontend/`):
```
VITE_API_BASE_URL=    # leave empty for local dev; Vite proxy handles /api
```

## Architecture

### Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS v4, Vite, React Router 7, Axios
- **Backend**: Node.js, Express 4, TypeScript
- **Database**: PostgreSQL via `@neondatabase/serverless` (Neon)
- **AI**: Groq SDK (`llama-3.3-70b-versatile`) for stages 1–9; Google Gemini 2.5 Flash-Lite for stage 10 (UI code)
- **Export**: LaTeX → PDF via Tectonic (compiled server-side), docx.js, csv-writer, resvg-js (SVG→PNG)
- **Deployment**: Vercel (frontend) + Render (backend)

### The AI Pipeline (core feature)

`backend/src/services/pipeline.service.ts` runs 10 sequential stages, each calling an LLM:

| Stage | Output | LLM |
|-------|--------|-----|
| 1 | Requirement extraction (actors, summary) | Groq |
| 2 | Functional requirements (IEEE 830) | Groq |
| 3 | Non-functional requirements | Groq |
| 4 | Security requirements (OWASP Top 10) | Groq |
| 5 | Functional test cases (IEEE 829) | Groq |
| 6 | Security test cases | Groq |
| 7 | UI wireframe descriptions | Groq |
| 8 | Traceability matrix | Groq |
| 9 | UML diagrams — 6–8 across multiple types (use case, class, ER, sequence, activity, state, component) as Mermaid | Groq |
| 10 | UI HTML code (multipass: design system + per-screen) | Gemini |

Pipeline is streamed to the frontend via **SSE** at `GET /api/projects/:id/generate?token=<jwt>`. Each stage upserts to the `artifacts` table (JSONB `content`). Stage progress is tracked in `pipeline_stages`.

Stage 10 uses two Gemini passes: (1) generate a shared design system (navbar, footer, Tailwind config), (2) generate HTML for each distinct screen category (auth, dashboard, settings, profile, create, list, report). `selectDistinctScreens()` deduplicates screens by category to avoid near-duplicate pages.

**Wireframes ⟵ UI alignment.** The early Stage 7 wireframes don't constrain the (creatively generated) UI. Instead, *after* Stage 10 completes, `deriveWireframesFromUI()` runs the relationship in reverse: a light Groq model reverse-engineers each generated UI page's HTML into an ordered low-fidelity block list (controlled vocabulary: navbar/hero/stats_row/card_grid/table/sidebar/chart/form/…), then rewrites the `wireframes` artifact so each screen's components mirror the layout that was actually built (screen metadata is preserved; screens with no UI counterpart borrow their category's layout). The resolved brand accent is persisted on `ui_code.design_system.accent` and copied onto `wireframes.accent` for tinting. The step never throws and never blocks generation — on failure the original wireframes stay intact. The frontend renders wireframes as a desktop **browser mockup** (`BrowserMockup`/`WireframeBlock` in `ArtifactsViewer.tsx`) tinted to the accent.

### GEval Quality Evaluation

After generation, an independent **GEval (LLM-as-a-Judge)** step grades artifact *quality* (separate from `metrics.service.ts`, which does rule-based conformance scoring). It does **not** generate or modify artifacts.

- `backend/src/config/evaluation.ts` — version-controlled, configurable rubric: artifact weights (SRS 30%, UI 35%, UML 20%, tests 15%), per-artifact criteria with weights + checks, 1–5 scale, grade thresholds, and the judge prompt builder. Bump `EVALUATION_CONFIG_VERSION` on any rubric change.
- `backend/src/services/evaluation.service.ts` — the GEval evaluator (`gevalEvaluator` implements the pluggable `Evaluator` interface). Judges each dimension via Groq in parallel, converts weighted 1–5 scores to percentages, and aggregates an overall % (re-normalising over evaluated dimensions only). Pure aggregation helpers (`aggregateArtifact`, `aggregateOverall`) are unit-tested. Missing artifacts / judge failures degrade gracefully (dimension marked un-evaluated) — evaluation **never blocks generation**.
- Persisted per-project (history) in the `evaluations` table (append-only JSONB report).
- Routes (`backend/src/routes/evaluation.routes.ts`): `POST /api/projects/:id/evaluate`, `GET .../evaluation` (latest), `GET .../evaluations` (history). The generate SSE stream also emits an `evaluation` event after the pipeline completes.
- Frontend: `components/QualityReport.tsx` (overall ring, per-artifact cards, strengths/issues/recommendations) shown as the **Quality** tab in the Artifacts viewer and as a section on the completed project detail page.

### Authentication

JWT-based with silent refresh:
- Access token (15 min) stored in `sessionStorage`
- Refresh token (7 days) in httpOnly cookie, hashed in DB
- Token family tracking for theft detection
- Account lockout after 5 failed attempts
- SSE endpoint accepts token via `?token=` query param (SSE can't set headers)
- Axios interceptors in `frontend/src/api/axios.ts` handle silent 401 refresh with request queuing

### Database Schema (8 tables)
- `users` — auth + lockout fields
- `refresh_tokens` — hashed tokens with family for theft detection
- `projects` — user's projects with soft delete (`deleted_at`)
- `artifacts` — JSONB content per type, UNIQUE(project_id, type), upserted each run
- `pipeline_stages` — per-stage status tracking
- `exports` — export file references
- `ui_revisions` — UI-code version history for AI refinement (undo/restore)
- `evaluations` — append-only GEval quality-evaluation history (JSONB report per run)

### Frontend Structure
- `src/api/` — Axios client + per-resource helpers
- `src/context/` — AuthContext (session), ToastContext (notifications), ThemeContext (dark/light)
- `src/pages/` — Dashboard, ProjectDetail, ArtifactsViewer, UICodePreview, etc.
- `src/components/` — Shared UI primitives

### Export System
`backend/src/services/export.service.ts`:
- **PDF**: `generateLaTeX()` renders a thesis-styled IEEE 830 `report` (title page, front matter, colour-headed `xltabular` requirement tables, UML chapter, UI appendix). `compileLaTeX()` writes it to a temp dir and shells out to **Tectonic** (single self-contained TeX binary; resolves the TOC in one pass) to produce the PDF. UML Mermaid SVGs captured client-side are rasterised to PNG via resvg-js and embedded as figures (falling back to Mermaid source if an image is missing). `TECTONIC_PATH` overrides the binary location.
- **DOCX**: `ieeeSections()` → docx.js. **CSV**: the traceability matrix.
- **LaTeX bundle**: `generateLaTeXZip()` (via `JSZip`) builds an **Overleaf-ready `.zip`** containing `main.tex`, the rendered UML diagrams as PNG figures under `figures/`, and a `README.txt`. The same client-captured Mermaid SVGs are rasterised to PNG here; the `.tex` references `figures/diagram_N.png`. Served at `POST /export/latex-zip` (accepts `{ diagramSvgs }`); the frontend's **LaTeX** export button uses it. The raw `.tex` source is still downloadable directly (`GET /export/latex`).
- **Tectonic resolution** (`resolveTectonic()`): uses `TECTONIC_PATH` → `tectonic` on `PATH` → otherwise, on Linux, **downloads the pinned static (musl) binary once** into a cache dir (`TECTONIC_CACHE_DIR`, default `os.tmpdir()`) and reuses it. This makes PDF export work on the plain Node Render web service (no Docker) with no infra changes; the first compile after a cold start pays a one-time binary + TeX-package download. On non-Linux dev hosts (Windows/macOS) without a local `tectonic`, PDF export throws a clear error. A `backend/Dockerfile` (Node 20 + Tectonic preinstalled) also exists for container deploys.

## Deployment

- **Frontend**: Vercel; `vercel.json` has the SPA fallback (`/(.*) → /index.html`). Build uses `CI=false npm run build`.
- **Backend**: Render; runs as a **Node** web service (`render.yaml`: `env: node`, `npm install && npm run build` → `npm start`). PDF export needs Tectonic, which the app self-bootstraps at runtime (see Export System) — no Docker required. A `backend/Dockerfile` exists as an alternative container deploy but is **not** what the live service uses.
- **Live**: frontend at `req-2-ui.vercel.app`, backend at `req2ui-backend.onrender.com` (note: no dashes). The frontend's backend URL is the Vercel build-time env `VITE_API_BASE_URL`.
