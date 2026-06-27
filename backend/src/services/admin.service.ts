import { sql } from "../db/client";
import { env } from "../config/env";

/**
 * Admin analytics service.
 *
 * Aggregates platform-wide stats for the internal admin dashboard: user and
 * project counts, GEval quality averages (drawn from the `evaluations` table),
 * and pipeline timing (derived from `pipeline_stages.started_at/finished_at`).
 * Read-only — it never mutates artifacts, evaluations, or pipeline state.
 */

/** True when the email is in the ADMIN_EMAILS allowlist (case-insensitive). */
export function isAdminEmail(email: string): boolean {
  return env.ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

/**
 * Resolves whether a user is an admin: either allowlisted by email, or flagged
 * `is_admin` in the database. Used by the requireAdmin gate so a freshly
 * allowlisted email works without a redeploy or manual DB edit.
 */
export async function resolveIsAdmin(userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) return true;
  const rows = (await sql`
    SELECT is_admin FROM users WHERE id = ${userId}
  `) as any[];
  return rows.length > 0 && rows[0].is_admin === true;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

/** Generation-timing aggregates for one scope (built-in only, or all models). */
export interface TimingScope {
  avgSeconds: number | null;
  minSeconds: number | null;
  maxSeconds: number | null;
  timedProjects: number;
  /** Runs classified as outliers by the IQR fence and excluded from the averages. */
  outliersExcluded: number;
  /** Upper IQR fence (seconds); runs above this are treated as outliers. */
  outlierThresholdSeconds: number | null;
  perStage: { stage: number; name: string; avgSeconds: number; runs: number }[];
}

// Human labels for the GEval artifact dimensions (keys come from the report).
const ARTIFACT_LABELS: Record<string, string> = {
  srs: "SRS Document",
  ui: "UI Code",
  uml: "UML Diagrams",
  tests: "Test Cases",
};

export interface AdminStats {
  generatedAt: string;
  totals: {
    users: number;
    newUsers7d: number;
    admins: number;
    projects: number;
    newProjects7d: number;
    deletedProjects: number;
    artifacts: number;
    evaluations: number;
  };
  projectsByStatus: { status: string; count: number }[];
  geval: {
    avgScore: number | null;
    minScore: number | null;
    maxScore: number | null;
    evaluatedProjects: number;
    gradeDistribution: { grade: string; count: number }[];
    perArtifact: { key: string; label: string; avgPercentage: number; projects: number }[];
  };
  // Generation timing in two scopes: `builtin` counts only runs served entirely
  // by the built-in system models; `all` additionally includes BYOK (user's own
  // provider) runs. Shown side by side so BYOK runs don't silently skew the
  // built-in system's speed numbers.
  timing: {
    all: TimingScope;
    builtin: TimingScope;
  };
  // Speed per AI model, derived from per-stage timings. `isByok` separates a
  // user's own provider (Bring-Your-Own-Key) from the built-in system's models,
  // so the built-in model speeds can be read without BYOK runs skewing them.
  modelUsage: {
    provider: string;
    model: string;
    isByok: boolean;
    runs: number;
    avgSeconds: number;
  }[];
  topUsers: {
    id: string;
    name: string;
    email: string;
    projectCount: number;
    createdAt: string;
    lastActive: string | null;
  }[];
  recentProjects: {
    id: string;
    name: string;
    status: string;
    ownerName: string;
    ownerEmail: string;
    createdAt: string;
    durationSeconds: number | null;
    gevalScore: number | null;
    artifactCount: number;
    /** "Built-in" or "BYOK · <model(s)>" — which engine generated the project. */
    engine: string;
  }[];
}

/**
 * Per-project generation wall-time for one scope. The `builtinOnly` flag, when
 * true, restricts to projects whose stages were ALL served by the built-in
 * system (no BYOK stage); when false, all completed projects count. Same IQR
 * outlier handling as before — only the scope filter differs.
 */
function timingScopeQuery(builtinOnly: boolean) {
  return sql`
    WITH durations AS (
      SELECT ps.project_id,
        EXTRACT(EPOCH FROM (MAX(ps.finished_at) - MIN(ps.started_at))) AS seconds,
        bool_or(COALESCE(ps.is_byok, FALSE)) AS any_byok
      FROM pipeline_stages ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.started_at IS NOT NULL AND ps.finished_at IS NOT NULL
        AND ps.status = 'completed'
        AND p.status = 'completed' AND p.deleted_at IS NULL
      GROUP BY ps.project_id
    ),
    clean AS (
      SELECT seconds FROM durations
      WHERE seconds > 0 AND seconds <= 1800
        AND (${builtinOnly} = FALSE OR any_byok = FALSE)
    ),
    bounds AS (
      SELECT
        percentile_cont(0.25) WITHIN GROUP (ORDER BY seconds) AS q1,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY seconds) AS q3
      FROM clean
    ),
    fence AS (
      SELECT q1 - 1.5 * (q3 - q1) AS lo, q3 + 1.5 * (q3 - q1) AS hi FROM bounds
    )
    SELECT
      ROUND(AVG(c.seconds)::numeric, 1) AS avg_seconds,
      ROUND(MIN(c.seconds)::numeric, 1) AS min_seconds,
      ROUND(MAX(c.seconds)::numeric, 1) AS max_seconds,
      COUNT(c.seconds)::int             AS timed_projects,
      ((SELECT COUNT(*) FROM clean) - COUNT(c.seconds))::int AS outliers_excluded,
      ROUND((SELECT hi FROM fence)::numeric, 1) AS outlier_threshold
    FROM clean c, fence f
    WHERE c.seconds >= f.lo AND c.seconds <= f.hi
  `;
}

/** Per-stage averages for one scope (built-in only, or all models). */
function stageScopeQuery(builtinOnly: boolean) {
  return sql`
    WITH sd AS (
      SELECT ps.stage, ps.name,
        EXTRACT(EPOCH FROM (ps.finished_at - ps.started_at)) AS seconds
      FROM pipeline_stages ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.started_at IS NOT NULL AND ps.finished_at IS NOT NULL
        AND ps.status = 'completed'
        AND p.status = 'completed' AND p.deleted_at IS NULL
        AND EXTRACT(EPOCH FROM (ps.finished_at - ps.started_at)) BETWEEN 0 AND 600
        AND (${builtinOnly} = FALSE OR COALESCE(ps.is_byok, FALSE) = FALSE)
    ),
    fence AS (
      SELECT stage,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY seconds) AS q1,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY seconds) AS q3
      FROM sd GROUP BY stage
    )
    SELECT sd.stage, sd.name,
      ROUND(AVG(sd.seconds)::numeric, 2) AS avg_seconds,
      COUNT(*)::int AS runs
    FROM sd JOIN fence f ON f.stage = sd.stage
    WHERE sd.seconds >= f.q1 - 1.5 * (f.q3 - f.q1)
      AND sd.seconds <= f.q3 + 1.5 * (f.q3 - f.q1)
    GROUP BY sd.stage, sd.name ORDER BY sd.stage
  `;
}

/** Build a TimingScope from one timing row + its per-stage rows. */
function buildTimingScope(timingRow: any, stageRows: any[]): TimingScope {
  const tm = timingRow ?? {};
  return {
    avgSeconds: tm.avg_seconds == null ? null : num(tm.avg_seconds),
    minSeconds: tm.min_seconds == null ? null : num(tm.min_seconds),
    maxSeconds: tm.max_seconds == null ? null : num(tm.max_seconds),
    timedProjects: num(tm.timed_projects),
    outliersExcluded: num(tm.outliers_excluded),
    outlierThresholdSeconds: tm.outlier_threshold == null ? null : num(tm.outlier_threshold),
    perStage: stageRows.map((r) => ({
      stage: num(r.stage),
      name: r.name,
      avgSeconds: num(r.avg_seconds),
      runs: num(r.runs),
    })),
  };
}

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalsRows,
    statusRows,
    gevalRows,
    gradeRows,
    artifactGevalRows,
    timingAllRows,
    timingBuiltinRows,
    stageAllRows,
    stageBuiltinRows,
    modelRows,
    topUserRows,
    recentRows,
  ] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_admin = FALSE)                   AS users,
        (SELECT COUNT(*) FROM users WHERE is_admin = FALSE AND created_at > NOW() - INTERVAL '7 days') AS new_users_7d,
        (SELECT COUNT(*) FROM users WHERE is_admin = TRUE)                    AS admins,
        (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL)              AS projects,
        (SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL AND created_at > NOW() - INTERVAL '7 days') AS new_projects_7d,
        (SELECT COUNT(*) FROM projects WHERE deleted_at IS NOT NULL)          AS deleted_projects,
        (SELECT COUNT(*) FROM artifacts)                                      AS artifacts,
        (SELECT COUNT(*) FROM evaluations)                                    AS evaluations
    `,
    sql`
      SELECT status, COUNT(*)::int AS count
      FROM projects WHERE deleted_at IS NULL
      GROUP BY status ORDER BY count DESC
    `,
    // GEval averages over each project's *latest* evaluation only, so re-runs
    // don't double-count a single project. Joined to projects with deleted_at IS
    // NULL so evaluations left behind by soft-deleted projects don't inflate the
    // count (which is why it could read "7 projects" when only 6 are live).
    sql`
      WITH latest AS (
        SELECT DISTINCT ON (e.project_id) e.project_id, e.overall_score
        FROM evaluations e
        JOIN projects p ON p.id = e.project_id AND p.deleted_at IS NULL
        ORDER BY e.project_id, e.created_at DESC
      )
      SELECT
        ROUND(AVG(overall_score)::numeric, 1) AS avg_score,
        MIN(overall_score)                    AS min_score,
        MAX(overall_score)                    AS max_score,
        COUNT(*)::int                         AS evaluated_projects
      FROM latest
    `,
    sql`
      WITH latest AS (
        SELECT DISTINCT ON (e.project_id) e.project_id, e.grade
        FROM evaluations e
        JOIN projects p ON p.id = e.project_id AND p.deleted_at IS NULL
        ORDER BY e.project_id, e.created_at DESC
      )
      SELECT grade, COUNT(*)::int AS count
      FROM latest GROUP BY grade ORDER BY count DESC
    `,
    // Per-artifact accuracy breakdown (SRS / UI / UML / tests): average of each
    // dimension's percentage across each live project's latest evaluation. Drawn
    // from the report JSONB; only dimensions actually evaluated are counted.
    sql`
      WITH latest AS (
        SELECT DISTINCT ON (e.project_id) e.project_id, e.report
        FROM evaluations e
        JOIN projects p ON p.id = e.project_id AND p.deleted_at IS NULL
        ORDER BY e.project_id, e.created_at DESC
      )
      SELECT k.key,
        ROUND(AVG(((l.report->'scores'->k.key)->>'percentage')::numeric), 1) AS avg_pct,
        COUNT(*)::int AS projects
      FROM latest l
      CROSS JOIN (VALUES ('srs'), ('ui'), ('uml'), ('tests')) AS k(key)
      WHERE ((l.report->'scores'->k.key)->>'evaluated')::boolean IS TRUE
        AND (l.report->'scores'->k.key)->>'percentage' IS NOT NULL
      GROUP BY k.key
    `,
    // Per-project generation wall-time and per-stage averages, each computed in
    // two scopes: ALL completed runs, and BUILT-IN-only runs (no BYOK stage).
    // Two-pass outlier handling (30-min hard ceiling + Tukey IQR fence) lives in
    // the helpers; see timingScopeQuery / stageScopeQuery.
    timingScopeQuery(false), // all models
    timingScopeQuery(true), // built-in only
    stageScopeQuery(false), // all models
    stageScopeQuery(true), // built-in only
    // Speed per model: average per-stage call time grouped by provider+model and
    // whether it was a BYOK run. Successful stages in non-deleted projects only,
    // bounded to 10 minutes to drop corrupt spans. Stages from before model
    // attribution existed have a NULL provider and are skipped.
    sql`
      SELECT ps.provider, ps.model, ps.is_byok,
        COUNT(*)::int AS runs,
        ROUND(AVG(EXTRACT(EPOCH FROM (ps.finished_at - ps.started_at)))::numeric, 2) AS avg_seconds
      FROM pipeline_stages ps
      JOIN projects p ON p.id = ps.project_id
      WHERE ps.status = 'completed'
        AND ps.started_at IS NOT NULL AND ps.finished_at IS NOT NULL
        AND ps.provider IS NOT NULL AND p.deleted_at IS NULL
        AND EXTRACT(EPOCH FROM (ps.finished_at - ps.started_at)) BETWEEN 0 AND 600
      GROUP BY ps.provider, ps.model, ps.is_byok
      ORDER BY runs DESC
    `,
    sql`
      SELECT u.id, u.name, u.email, u.created_at,
        COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::int AS project_count,
        MAX(p.created_at) AS last_active
      FROM users u
      LEFT JOIN projects p ON p.user_id = u.id
      WHERE u.is_admin = FALSE
      GROUP BY u.id
      ORDER BY project_count DESC, u.created_at DESC
      LIMIT 12
    `,
    sql`
      SELECT p.id, p.name, p.status, p.created_at,
        u.name AS owner_name, u.email AS owner_email,
        -- Duration only for successful runs; errored/timed-out/in-progress show
        -- "—". NULLIF also drops implausible (pre-fix, multi-hour) spans.
        CASE WHEN p.status = 'completed' THEN (
          SELECT NULLIF(LEAST(
               EXTRACT(EPOCH FROM (MAX(ps.finished_at) - MIN(ps.started_at))), 1801), 1801)
             FROM pipeline_stages ps
             WHERE ps.project_id = p.id
               AND ps.started_at IS NOT NULL AND ps.finished_at IS NOT NULL
               AND ps.status = 'completed'
        ) ELSE NULL END AS duration_seconds,
        (SELECT e.overall_score FROM evaluations e
           WHERE e.project_id = p.id ORDER BY e.created_at DESC LIMIT 1)    AS geval_score,
        (SELECT COUNT(*)::int FROM artifacts a WHERE a.project_id = p.id)   AS artifact_count,
        -- Engine attribution: whether any stage ran on a user's BYOK provider,
        -- and the distinct BYOK model name(s) used (for the label).
        (SELECT bool_or(COALESCE(ps.is_byok, FALSE)) FROM pipeline_stages ps
           WHERE ps.project_id = p.id)                                      AS any_byok,
        (SELECT string_agg(DISTINCT ps.model, ', ') FROM pipeline_stages ps
           WHERE ps.project_id = p.id AND ps.is_byok = TRUE AND ps.model IS NOT NULL) AS byok_models
      FROM projects p
      JOIN users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 10
    `,
  ]);

  const t = (totalsRows as any[])[0] ?? {};
  const g = (gevalRows as any[])[0] ?? {};

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      users: num(t.users),
      newUsers7d: num(t.new_users_7d),
      admins: num(t.admins),
      projects: num(t.projects),
      newProjects7d: num(t.new_projects_7d),
      deletedProjects: num(t.deleted_projects),
      artifacts: num(t.artifacts),
      evaluations: num(t.evaluations),
    },
    projectsByStatus: (statusRows as any[]).map((r) => ({
      status: r.status,
      count: num(r.count),
    })),
    geval: {
      avgScore: g.avg_score == null ? null : num(g.avg_score),
      minScore: g.min_score == null ? null : num(g.min_score),
      maxScore: g.max_score == null ? null : num(g.max_score),
      evaluatedProjects: num(g.evaluated_projects),
      gradeDistribution: (gradeRows as any[]).map((r) => ({
        grade: r.grade,
        count: num(r.count),
      })),
      perArtifact: (artifactGevalRows as any[]).map((r) => ({
        key: r.key,
        label: ARTIFACT_LABELS[r.key] ?? r.key,
        avgPercentage: num(r.avg_pct),
        projects: num(r.projects),
      })),
    },
    timing: {
      all: buildTimingScope((timingAllRows as any[])[0], stageAllRows as any[]),
      builtin: buildTimingScope((timingBuiltinRows as any[])[0], stageBuiltinRows as any[]),
    },
    modelUsage: (modelRows as any[]).map((r) => ({
      provider: r.provider,
      model: r.model,
      isByok: r.is_byok === true,
      runs: num(r.runs),
      avgSeconds: num(r.avg_seconds),
    })),
    topUsers: (topUserRows as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      projectCount: num(r.project_count),
      createdAt: r.created_at,
      lastActive: r.last_active ?? null,
    })),
    recentProjects: (recentRows as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      createdAt: r.created_at,
      durationSeconds: r.duration_seconds == null ? null : num(r.duration_seconds),
      gevalScore: r.geval_score == null ? null : num(r.geval_score),
      artifactCount: num(r.artifact_count),
      engine: r.any_byok ? `BYOK · ${r.byok_models ?? "custom"}` : "Built-in",
    })),
  };
}
