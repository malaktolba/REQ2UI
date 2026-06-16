import type { ProjectStatus } from "../types/project";

const styles: Record<ProjectStatus, string> = {
  pending: "bg-slate-700 text-slate-300",
  generating: "bg-yellow-500/20 text-yellow-300 animate-pulse",
  completed: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
};

const labels: Record<ProjectStatus, string> = {
  pending: "Pending",
  generating: "Generating…",
  completed: "Completed",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
