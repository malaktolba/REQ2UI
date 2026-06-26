import { sql } from "./client";

async function migrate() {
  console.log("Running migrations…");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email       TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name        TEXT NOT NULL,
      failed_attempts INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Admin flag for the internal analytics dashboard. Defaults false; promoted
  // either by listing an email in ADMIN_EMAILS (auto-applied on auth) or by
  // flipping this column directly. Idempotent for pre-existing databases.
  await sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT UNIQUE NOT NULL,
      family      UUID NOT NULL,
      revoked     BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
      ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      deleted_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Backfill for databases created before `metadata` existed (idempotent).
  await sql`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  // Optional UI design preferences captured before generation (idempotent).
  // Existing projects default to '{}' → AI picks the design (backward compatible).
  await sql`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS ui_preferences JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS artifacts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      content     JSONB NOT NULL,
      version     INT NOT NULL DEFAULT 1,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, type)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS exports (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      format      TEXT NOT NULL,
      file_path   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Version history for the AI UI-refinement feature. Each row is a snapshot of
  // a committed `ui_code` artifact state, captured before a refinement/restore
  // replaces it — letting users undo/restore previous UI states.
  await sql`
    CREATE TABLE IF NOT EXISTS ui_revisions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version     INT  NOT NULL,
      content     JSONB NOT NULL,
      label       TEXT NOT NULL,
      scope       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, version)
    )
  `;

  // GEval quality-evaluation history. Each row is one evaluation run of a
  // project's artifacts: the overall percentage + grade for quick listing, and
  // the full structured report (per-artifact scores, strengths, issues,
  // recommendations) in JSONB. `version` records the rubric/prompt version used,
  // so historical scores stay interpretable as the criteria evolve. Kept separate
  // from `artifacts` because evaluation is independent of generation and append-
  // only (history per project), not an upserted single-row-per-type artifact.
  await sql`
    CREATE TABLE IF NOT EXISTS evaluations (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      method        TEXT NOT NULL DEFAULT 'geval',
      version       TEXT NOT NULL,
      overall_score INT  NOT NULL,
      grade         TEXT NOT NULL,
      report        JSONB NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS evaluations_project_created_idx
      ON evaluations (project_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      stage       INT NOT NULL,
      name        TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',
      error       TEXT,
      started_at  TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      UNIQUE(project_id, stage)
    )
  `;

  console.log("Migrations complete.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
