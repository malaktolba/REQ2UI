export type ProjectStatus = "pending" | "generating" | "completed" | "failed";

/** Optional client/document context captured before generation (all optional). */
export interface ProjectMetadata {
  organization?: string;
  industry?: string;
  audience?: string;
  author?: string;
  contact_email?: string;
  version?: string;
}

/** Optional UI design preferences that constrain Stage 10 UI generation. */
export interface UIPreferences {
  theme?: string;
  color_mode?: string;
  primary_color?: string;
  layout_density?: string;
  navigation?: string;
  content_style?: string;
  button_style?: string;
  card_style?: string;
  animations?: string;
  custom_instructions?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  metadata?: ProjectMetadata;
  ui_preferences?: UIPreferences;
  status: ProjectStatus;
  artifact_count: number;
  created_at: string;
  updated_at: string;
}

export interface PipelineStage {
  stage: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  // Optional sub-progress streamed for long stages (e.g. Stage 10 per-screen).
  detail?: string;
  progress?: { current: number; total: number };
}

export interface Artifact {
  type: string;
  content: any;
  version: number;
  updated_at: string;
}

/** Target of an AI UI-refinement request. */
export type RefinementScope = "page" | "pages" | "design_system";

/** A snapshot in the UI-code version history. */
export interface UIRevision {
  version: number;
  label: string;
  scope: string | null;
  created_at: string;
}
