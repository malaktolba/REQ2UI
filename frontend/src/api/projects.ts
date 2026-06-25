import api from "./axios";
import type { Project, Artifact, PipelineStage, ProjectMetadata, UIPreferences, UIRevision } from "../types/project";

/**
 * Coerces an Axios/API error into a human-readable string. A 400 from the
 * backend returns a Zod `flatten()` object (`{ formErrors, fieldErrors }`),
 * which must never be passed to React as a child — render this instead.
 */
export function errorMessage(err: any, fallback = "Something went wrong."): string {
  const data = err?.response?.data?.error;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const field = Object.entries(data.fieldErrors ?? {})
      .map(([k, msgs]) => `${k}: ${(msgs as string[])?.join(", ")}`)
      .join(" · ");
    const form = (data.formErrors ?? []).join(", ");
    return [form, field].filter(Boolean).join(" · ") || fallback;
  }
  return err?.response?.data?.error ?? err?.message ?? fallback;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data } = await api.get<{ projects: Project[] }>("/projects");
  return data.projects;
}

export async function fetchProject(id: string): Promise<Project> {
  const { data } = await api.get<{ project: Project }>(`/projects/${id}`);
  return data.project;
}

/** Project plus its persisted pipeline stages — used to render prior progress. */
export async function fetchProjectWithStages(
  id: string
): Promise<{ project: Project; stages: PipelineStage[] }> {
  const { data } = await api.get<{ project: Project; stages: PipelineStage[] }>(`/projects/${id}`);
  return { project: data.project, stages: data.stages ?? [] };
}

export async function createProject(payload: {
  name: string;
  description: string;
  metadata?: ProjectMetadata;
  ui_preferences?: UIPreferences;
}): Promise<Project> {
  const { data } = await api.post<{ project: Project }>("/projects", payload);
  return data.project;
}

export async function updateProject(
  id: string,
  payload: { name?: string; description?: string; metadata?: ProjectMetadata; ui_preferences?: UIPreferences }
): Promise<Project> {
  const { data } = await api.put<{ project: Project }>(`/projects/${id}`, payload);
  return data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function fetchArtifacts(id: string): Promise<Artifact[]> {
  const { data } = await api.get<{ artifacts: Artifact[] }>(`/projects/${id}/artifacts`);
  return data.artifacts;
}

/** Fetch a single artifact by type (used for the live in-progress preview). */
export async function fetchArtifact(id: string, type: string): Promise<Artifact> {
  const { data } = await api.get<{ artifact: Artifact }>(`/projects/${id}/artifacts/${type}`);
  return data.artifact;
}

// ── AI UI Refinement ──────────────────────────────────────────────────────────
// (The refine stream itself is opened via EventSource in the component, like
// generation; these helpers cover the JSON apply/discard/history/suggestions.)

export async function applyRefinement(id: string): Promise<void> {
  await api.post(`/projects/${id}/ui-code/apply`);
}

export async function discardRefinement(id: string): Promise<void> {
  await api.post(`/projects/${id}/ui-code/discard`);
}

export async function fetchRevisions(id: string): Promise<UIRevision[]> {
  const { data } = await api.get<{ revisions: UIRevision[] }>(`/projects/${id}/ui-code/revisions`);
  return data.revisions;
}

export async function restoreRevision(id: string, version: number): Promise<void> {
  await api.post(`/projects/${id}/ui-code/revisions/${version}/restore`);
}

export async function fetchSuggestions(id: string): Promise<string[]> {
  const { data } = await api.get<{ suggestions: string[] }>(`/projects/${id}/ui-code/suggestions`);
  return data.suggestions;
}
