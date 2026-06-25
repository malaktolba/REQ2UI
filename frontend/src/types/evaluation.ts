/** Types for the GEval AI quality-evaluation feature (mirrors the backend report). */

export type ArtifactKey = "srs" | "ui" | "uml" | "tests";

export interface CriterionScore {
  key: string;
  label: string;
  weight: number;
  /** 1-5, or null when the dimension could not be evaluated. */
  score: number | null;
  justification: string;
}

export interface ArtifactScore {
  key: ArtifactKey;
  label: string;
  weight: number;
  /** Weighted mean of criteria, 1-5; null when not evaluated. */
  score: number | null;
  /** score mapped to 0-100; null when not evaluated. */
  percentage: number | null;
  rating: string | null;
  evaluated: boolean;
  criteria: CriterionScore[];
  strengths: string[];
  issues: string[];
  recommendations: string[];
}

export interface EvaluationReport {
  version: string;
  method: string;
  overallScore: number;
  grade: string;
  scores: Record<ArtifactKey, ArtifactScore>;
  recommendations: string[];
  generatedAt: string;
}

export interface StoredEvaluation {
  id: string;
  method: string;
  version: string;
  overall_score: number;
  grade: string;
  report: EvaluationReport;
  created_at: string;
}
