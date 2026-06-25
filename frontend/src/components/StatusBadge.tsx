import type { ProjectStatus } from "../types/project";

const styles: Record<ProjectStatus, string> = {
  pending:    "border-line text-faint",
  generating: "border-amber-500/40 text-amber-400 light:text-amber-600",
  completed:  "border-indigo-500/40 text-indigo-400",
  failed:     "border-red-500/40 text-red-400 light:text-red-500",
};

const labels: Record<ProjectStatus, string> = {
  pending: "pending",
  generating: "generating",
  completed: "completed",
  failed: "failed",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`mono-label inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] ${styles[status]}`}>
      {status === "generating" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
      )}
      {labels[status]}
    </span>
  );
}
