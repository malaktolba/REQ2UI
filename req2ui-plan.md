# Req2UI — Implementation Plan

---

## Phase 1 — Foundation & Auth (Day 1)

**Goal:** Project scaffold + authentication system fully working.

### Backend
- [x] Express + TypeScript project setup
- [x] Neon PostgreSQL connection
- [x] Database migrations (all 6 tables)
- [x] bcrypt password hashing (cost 12)
- [x] JWT access tokens (15 min expiry)
- [x] Refresh token rotation with theft detection
- [x] httpOnly cookie for refresh token
- [x] Account lockout after 5 failed attempts
- [x] Rate limiting on auth endpoints (5 req / 15 min)
- [x] Helmet.js security headers
- [x] Zod input validation
- [x] `POST /api/auth/register`
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/refresh`
- [x] `POST /api/auth/logout`
- [x] `GET  /api/auth/me`

### Frontend
- [x] React + TypeScript + Vite setup
- [x] Tailwind CSS configured
- [x] Axios instance with silent token refresh
- [x] Auth context + useAuth hook
- [x] Session restore on page reload
- [x] Login page
- [x] Register page with password strength hints
- [x] Protected route guard

---

## Phase 2 — Projects CRUD (Day 2)

**Goal:** Users can create, view, and delete projects. Dashboard shows all projects.

### Backend
- [x] `POST   /api/projects` — create project
- [x] `GET    /api/projects` — list user projects (with artifact count)
- [x] `GET    /api/projects/:id` — get single project
- [x] `PUT    /api/projects/:id` — update project
- [x] `DELETE /api/projects/:id` — soft delete
- [x] All routes protected by auth middleware

### Frontend
- [x] Dashboard page with project cards grid
- [x] Skeleton loading states
- [x] StatusBadge component (pending / generating / completed / failed)
- [x] ProjectCard with two-click delete confirmation
- [x] Create Project page with character counter + example prompts
- [x] Project Detail page with pipeline stage list
- [x] useProjects hook

---

## Phase 3 — AI Pipeline (Day 3)

**Goal:** 8-stage chained AI pipeline generates all artifacts. SSE streams progress to frontend in real time.

### Backend
- [ ] Groq API integration (llama-3.3-70b-versatile)
- [ ] callGPT() wrapper with retry logic + JSON mode enforced
- [ ] Stage 1 — Requirement extraction
- [ ] Stage 2 — Functional requirements (IEEE 830)
- [ ] Stage 3 — Non-functional requirements
- [ ] Stage 4 — Security requirements (OWASP Top 10)
- [ ] Stage 5 — Functional test cases (IEEE 829)
- [ ] Stage 6 — Security test cases
- [ ] Stage 7 — UI wireframe descriptions
- [ ] Stage 8 — Traceability matrix
- [ ] Pipeline orchestrator — context accumulation across stages
- [ ] Each stage output saved to DB (upsertable)
- [ ] Project status updates (pending → generating → completed / failed)
- [ ] SSE streaming endpoint POST /api/projects/:id/generate
- [ ] GET /api/projects/:id/artifacts
- [ ] GET /api/projects/:id/artifacts/:type
- [ ] Auth middleware supports ?token= query param for SSE

### Frontend
- [ ] generateService.ts — SSE client
- [ ] ProjectDetail — live pipeline progress (spinner → checkmark per stage)
- [ ] Generate button wired
- [ ] Error handling + retry on failed generation

---

## Phase 4 — Artifacts Viewer (Day 4)

**Goal:** Users can browse all generated artifacts in a tabbed viewer.

### Frontend
- [ ] Artifacts page /projects/:id/artifacts
- [ ] Tab bar: FR | NFR | Security | Func TC | Sec TC | Wireframes | Traceability
- [ ] Functional requirements table (ID, title, priority, description, acceptance criteria)
- [ ] Non-functional requirements table
- [ ] Security requirements table (with OWASP category)
- [ ] Functional test cases table (steps, expected result)
- [ ] Security test cases table (attack vector, severity)
- [ ] Wireframes viewer (screen list + components)
- [ ] Traceability matrix table (FR → TC → Security mapping)
- [ ] Coverage summary (total / covered / percentage)

---

## Phase 5 — Export Engine (Day 5)

**Goal:** Users can export all artifacts as PDF, DOCX, or CSV in one click.

### Backend
- [ ] Install: pdfkit, docx, csv-writer
- [ ] PDF export service — structured layout with all artifacts
- [ ] DOCX export service — IEEE 830 formatted document
- [ ] CSV export — traceability matrix as spreadsheet
- [ ] POST /api/projects/:id/export — body: { format: "pdf"|"docx"|"csv" }
- [ ] GET  /api/projects/:id/exports — list past exports

### Frontend
- [ ] Export page /projects/:id/export
- [ ] Format selector (PDF / DOCX / CSV)
- [ ] Export button with loading state
- [ ] Download link on completion
- [ ] Past exports list with timestamps

---

## Phase 6 — Polish & Security Hardening (Day 6)

**Goal:** Production-ready quality. No broken flows. Secure.

### Backend
- [ ] CORS locked to production frontend URL
- [ ] All error messages sanitized (no stack traces in production)
- [ ] Input validation on all remaining endpoints
- [ ] Rate limit on generation endpoint (10 / hour)

### Frontend
- [ ] Edit project modal/page
- [ ] Toast notifications for all actions
- [ ] Empty states on all pages
- [ ] Loading spinners everywhere
- [ ] Mobile responsive layout check
- [ ] 404 page

---

## Phase 7 — Demo Prep (Day 7)

**Goal:** Flawless live demo for graduation examiners.

- [ ] End-to-end test with a realistic project description
- [ ] Fix any broken flows found during testing
- [ ] Seed a demo account with a pre-generated project
- [ ] Prepare a backup video recording of the full flow
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Set all production environment variables
- [ ] Confirm HTTPS on both deployments
- [ ] Test the deployed version end-to-end

---

## Key APIs Summary

| Method | Endpoint | Status |
|--------|----------|--------|
| POST | /api/auth/register | Phase 1 |
| POST | /api/auth/login | Phase 1 |
| POST | /api/auth/refresh | Phase 1 |
| POST | /api/auth/logout | Phase 1 |
| GET  | /api/auth/me | Phase 1 |
| GET  | /api/projects | Phase 2 |
| POST | /api/projects | Phase 2 |
| GET  | /api/projects/:id | Phase 2 |
| PUT  | /api/projects/:id | Phase 2 |
| DELETE | /api/projects/:id | Phase 2 |
| POST | /api/projects/:id/generate | Phase 3 |
| GET  | /api/projects/:id/artifacts | Phase 3 |
| GET  | /api/projects/:id/artifacts/:type | Phase 3 |
| POST | /api/projects/:id/export | Phase 5 |
| GET  | /api/projects/:id/exports | Phase 5 |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon) |
| Auth | JWT + bcrypt + httpOnly cookies |
| AI | Groq API - llama-3.3-70b-versatile (free) → swap to GPT-4o for production |
| Export | pdfkit, docx.js, csv-writer |
| Deployment | Vercel (frontend) + Render (backend) |

---

*Req2UI — AASTMT Graduation Project*