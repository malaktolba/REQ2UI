# Req2UI

> **AASTMT Graduation Project** — Transforms a natural-language software description into a full set of IEEE-standard artifacts using an 8-stage AI pipeline.

---

## What it does

Paste a project description and Req2UI generates:

| # | Artifact | Standard |
|---|----------|----------|
| 1 | Requirement extraction | — |
| 2 | Functional requirements | IEEE 830 |
| 3 | Non-functional requirements | IEEE 830 |
| 4 | Security requirements | OWASP Top 10 |
| 5 | Functional test cases | IEEE 829 |
| 6 | Security test cases | — |
| 7 | UI wireframe descriptions | — |
| 8 | Traceability matrix | — |

All artifacts are viewable in a tabbed UI and exportable as **PDF**, **DOCX**, or **CSV**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS v4, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon serverless) |
| Auth | JWT (15 min) + Refresh tokens + httpOnly cookies |
| AI | Groq API — llama-3.3-70b-versatile |
| Export | pdfkit, docx.js, csv-writer |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Groq](https://console.groq.com) API key (free)

### 1. Clone the repo

```bash
git clone https://github.com/malaktolba/REQ2UI.git
cd REQ2UI
```

### 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, GROQ_API_KEY
npm install
npm run migrate
npm run dev        # runs on http://localhost:4000
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev        # runs on http://localhost:5173
```

---

## Project Structure

```
REQ2UI/
├── backend/
│   ├── src/
│   │   ├── config/       # env validation
│   │   ├── db/           # Neon client + migrations
│   │   ├── middleware/   # JWT auth guard
│   │   ├── routes/       # auth, projects, generate
│   │   └── services/     # Groq wrapper, pipeline orchestrator, token service
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/          # axios instance + API helpers
│   │   ├── components/   # StatusBadge, ProjectCard, ProtectedRoute
│   │   ├── context/      # AuthContext
│   │   ├── hooks/        # useAuth, useProjects
│   │   ├── pages/        # Login, Register, Dashboard, CreateProject, ProjectDetail
│   │   └── types/        # shared TypeScript types
│   └── package.json
└── req2ui-plan.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project + stages |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Soft delete |
| GET | `/api/projects/:id/generate` | Run pipeline (SSE stream) |
| GET | `/api/projects/:id/artifacts` | All artifacts |
| GET | `/api/projects/:id/artifacts/:type` | Single artifact |

---

*Built for AASTMT graduation — 2026*
