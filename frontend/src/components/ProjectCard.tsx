import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../types/project";
import { StatusBadge } from "./StatusBadge";

interface Props {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: Props) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    await onDelete(project.id);
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5 transition group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-white font-semibold text-base leading-snug line-clamp-2 group-hover:text-indigo-300 transition">
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      <p className="text-slate-400 text-sm line-clamp-3 mb-4">
        {project.description}
      </p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex flex-col gap-0.5">
          <span>{project.artifact_count} artifact{project.artifact_count !== 1 ? "s" : ""}</span>
          <span className="text-slate-700">{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={`px-2.5 py-1 rounded-lg border transition ${
            confirmDelete
              ? "border-red-500 text-red-400 hover:bg-red-500/10"
              : "border-slate-700 text-slate-500 hover:border-red-500/50 hover:text-red-400"
          }`}
        >
          {deleting ? "Deleting…" : confirmDelete ? "Confirm?" : "Delete"}
        </button>
      </div>
    </div>
  );
}
