/** Types for the admin analytics dashboard (mirrors backend AdminStats). */

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
  };
  timing: {
    avgSeconds: number | null;
    minSeconds: number | null;
    maxSeconds: number | null;
    timedProjects: number;
    outliersExcluded: number;
    outlierThresholdSeconds: number | null;
    perStage: { stage: number; name: string; avgSeconds: number; runs: number }[];
  };
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
  }[];
}
