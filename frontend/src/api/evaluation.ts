import api from "./axios";
import type { StoredEvaluation } from "../types/evaluation";

/** Runs a fresh GEval evaluation of the project's current artifacts. */
export async function runEvaluation(id: string): Promise<StoredEvaluation> {
  const { data } = await api.post<{ evaluation: StoredEvaluation }>(`/projects/${id}/evaluate`);
  return data.evaluation;
}

/** Latest stored evaluation for the project, or null if none has been run. */
export async function fetchEvaluation(id: string): Promise<StoredEvaluation | null> {
  const { data } = await api.get<{ evaluation: StoredEvaluation | null }>(`/projects/${id}/evaluation`);
  return data.evaluation;
}

/** Full evaluation history for the project (newest first). */
export async function fetchEvaluationHistory(id: string): Promise<StoredEvaluation[]> {
  const { data } = await api.get<{ evaluations: StoredEvaluation[] }>(`/projects/${id}/evaluations`);
  return data.evaluations;
}
