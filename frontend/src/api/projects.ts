import api from "./axios";
import type { Project, Artifact, PipelineStage } from "../types/project";

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

export async function createProject(payload: { name: string; description: string }): Promise<Project> {
  const { data } = await api.post<{ project: Project }>("/projects", payload);
  return data.project;
}

export async function updateProject(
  id: string,
  payload: { name?: string; description?: string }
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
