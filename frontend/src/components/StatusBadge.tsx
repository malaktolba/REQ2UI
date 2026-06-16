import type { ProjectStatus } from "../types/project";

const styles: Record<ProjectStatus, string> = {
  pending:    "bg-slate-700 light:bg-slate-100 text-slate-300 light:text-slate-500",
  generating: "bg-yellow-500/20 light:bg-amber-50 text-yellow-300 light:text-amber-600 animate-pulse",
  completed:  "bg-green-500/20 light:bg-emerald-50 text-green-300 light:text-emerald-600",
  failed:     "bg-red-500/20 light:bg-red-50 text-red-300 light:text-red-500",
};

const labels: Record<ProjectStatus, string> = {
  pending: "Pending",
  generating: "Generating…",
  completed: "Completed",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status === "generating" && (
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 light:bg-amber-500 animate-ping inline-block" />
      )}
      {labels[status]}
    </span>
  );
}
