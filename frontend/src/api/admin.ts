import api from "./axios";
import type { AdminStats } from "../types/admin";
import type { StoredEvaluation } from "../types/evaluation";

/** Platform-wide analytics for the admin dashboard (admin-only endpoint). */
export async function fetchAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<{ stats: AdminStats }>("/admin/stats");
  return data.stats;
}

/** Latest GEval report for any project (admin). */
export async function fetchProjectEvaluation(projectId: string): Promise<StoredEvaluation | null> {
  const { data } = await api.get<{ evaluation: StoredEvaluation | null }>(
    `/admin/projects/${projectId}/evaluation`
  );
  return data.evaluation;
}

/** Full GEval history for any project, newest first (admin). */
export async function fetchProjectEvaluations(projectId: string): Promise<StoredEvaluation[]> {
  const { data } = await api.get<{ evaluations: StoredEvaluation[] }>(
    `/admin/projects/${projectId}/evaluations`
  );
  return data.evaluations;
}

/** Trigger a fresh GEval run for any project (admin). */
export async function runProjectEvaluation(projectId: string): Promise<StoredEvaluation> {
  const { data } = await api.post<{ evaluation: StoredEvaluation }>(
    `/admin/projects/${projectId}/evaluate`
  );
  return data.evaluation;
}
