"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ForteV2FilterPill,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SearchInput,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
  MasterProjectV2TableShell,
  MasterProjectV2Toolbar,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  createProjectTask,
  deleteProjectTask,
  listProjectTasks,
  updateProjectTask,
} from "@/lib/project-tasks-cloud";
import {
  PROJECT_TASK_PRIORITIES,
  PROJECT_TASK_STATUSES,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskStatus,
} from "@/lib/project-tasks";

interface MasterProjectV2TasksTabProps {
  buildingId: string;
}

type EditorMode = "create" | "edit";

const emptyDraft = {
  title: "",
  description: "",
  priority: "רגילה" as ProjectTaskPriority,
  status: "פתוחה" as ProjectTaskStatus,
  dueDate: "",
};

export default function MasterProjectV2TasksTab({
  buildingId,
}: MasterProjectV2TasksTabProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectTaskStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<ProjectTaskPriority | "">(
    ""
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listProjectTasks(buildingId);
    setTasks(result.tasks);
    setLoadError(result.error);
  }, [buildingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (statusFilter) list = list.filter((task) => task.status === statusFilter);
    if (priorityFilter) {
      list = list.filter((task) => task.priority === priorityFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((task) =>
      [task.title, task.description, task.status, task.priority]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [tasks, search, statusFilter, priorityFilter]);

  function openCreate() {
    setEditorMode("create");
    setEditingTask(null);
    setDraft(emptyDraft);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(task: ProjectTask) {
    setEditorMode("edit");
    setEditingTask(task);
    setDraft({
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTask(null);
    setDraft(emptyDraft);
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!draft.title.trim()) {
      setFormError("כותרת המשימה היא שדה חובה.");
      return;
    }

    setSaving(true);
    setFormError(null);

    if (editorMode === "create") {
      const result = await createProjectTask(buildingId, draft);
      if (result.error || !result.task) {
        setFormError(result.error ?? "יצירת המשימה נכשלה.");
        setSaving(false);
        return;
      }
    } else if (editingTask) {
      const result = await updateProjectTask(editingTask.id, buildingId, draft);
      if (result.error || !result.task) {
        setFormError(result.error ?? "עדכון המשימה נכשל.");
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    closeDialog();
    await refresh();
  }

  async function handleDelete(taskId: string) {
    if (!window.confirm("למחוק את המשימה?")) return;
    const result = await deleteProjectTask(taskId, buildingId);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    await refresh();
  }

  const showEmpty =
    filteredTasks.length === 0 && !search && !statusFilter && !priorityFilter;

  return (
    <ForteV2TabShell
      workspace="project-v2-tasks"
      title="משימות"
      description="מעקב משימות, עדיפויות וסטטוסים"
      actions={
        <MasterProjectV2PrimaryButton onClick={openCreate} size="sm">
          + משימה חדשה
        </MasterProjectV2PrimaryButton>
      }
    >
      <MasterProjectV2Toolbar
        inner
        search={<MasterProjectV2SearchInput value={search} onChange={setSearch} />}
        actions={
          <>
            <ForteV2FilterPill
              label="סטטוס"
              value={statusFilter || "הכל"}
              options={["הכל", ...PROJECT_TASK_STATUSES]}
              onChange={(v) => setStatusFilter(v === "הכל" ? "" : (v as ProjectTaskStatus))}
            />
            <ForteV2FilterPill
              label="עדיפות"
              value={priorityFilter || "הכל"}
              options={["הכל", ...PROJECT_TASK_PRIORITIES]}
              onChange={(v) =>
                setPriorityFilter(v === "הכל" ? "" : (v as ProjectTaskPriority))
              }
            />
          </>
        }
      />

      {showEmpty ? (
        <MasterProjectV2EmptyState
          title="אין משימות בפרויקט."
          description="התחל ביצירת המשימה הראשונה לפרויקט זה."
          actions={
            <MasterProjectV2PrimaryButton onClick={openCreate}>
              משימה חדשה
            </MasterProjectV2PrimaryButton>
          }
        />
      ) : null}

      <MasterProjectV2TableShell
        headers={["פעולות", "כותרת", "עדיפות", "סטטוס", "תאריך יעד", "עודכן"]}
      >
        {filteredTasks.map((task) => (
          <tr key={task.id} className="border-b border-forte-border/60 hover:bg-forte-blue-light/40">
            <td className="py-2.5 px-2">
              <div className="flex flex-wrap gap-1.5">
                <MasterProjectV2SecondaryButton onClick={() => openEdit(task)}>
                  ערוך
                </MasterProjectV2SecondaryButton>
                <button
                  type="button"
                  onClick={() => void handleDelete(task.id)}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  מחק
                </button>
              </div>
            </td>
            <td className="py-2.5 px-2 font-medium text-forte-text">{task.title}</td>
            <td className="py-2.5 px-2 text-forte-text/85">{task.priority}</td>
            <td className="py-2.5 px-2 text-forte-text/85">{task.status}</td>
            <td className="py-2.5 px-2 text-forte-text/85 whitespace-nowrap">
              {task.dueDate || "—"}
            </td>
            <td className="py-2.5 px-2 text-forte-text/85 whitespace-nowrap">
              {new Date(task.updatedAt).toLocaleDateString("he-IL")}
            </td>
          </tr>
        ))}
      </MasterProjectV2TableShell>

      {!showEmpty && filteredTasks.length === 0 && (
        <p className="text-xs text-forte-text-secondary text-center py-4">
          לא נמצאו משימות התואמות לסינון.
        </p>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forte-text/30 p-4 overflow-y-auto">
          <form
            onSubmit={(e) => void handleSave(e)}
            className="w-full max-w-lg bg-white rounded-lg border border-forte-border shadow-xl p-4 space-y-3 max-h-[92dvh] overflow-y-auto mb-[max(0.5rem,env(safe-area-inset-bottom))] sm:mb-0"
          >
            <h4 className="text-sm font-bold text-forte-text">
              {editorMode === "create" ? "משימה חדשה" : "עריכת משימה"}
            </h4>
            {formError && (
              <MasterProjectV2StatusBanner tone="error">{formError}</MasterProjectV2StatusBanner>
            )}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">כותרת</span>
              <input
                value={draft.title}
                onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))}
                className="form-input text-sm py-2"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">תיאור</span>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((c) => ({ ...c, description: e.target.value }))
                }
                rows={3}
                className="form-input text-sm py-2 min-h-[72px]"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-forte-text">עדיפות</span>
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft((c) => ({
                      ...c,
                      priority: e.target.value as ProjectTaskPriority,
                    }))
                  }
                  className="form-input text-sm py-2"
                >
                  {PROJECT_TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-forte-text">סטטוס</span>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((c) => ({
                      ...c,
                      status: e.target.value as ProjectTaskStatus,
                    }))
                  }
                  className="form-input text-sm py-2"
                >
                  {PROJECT_TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-forte-text">תאריך יעד</span>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft((c) => ({ ...c, dueDate: e.target.value }))}
                className="form-input text-sm py-2"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-forte-primary-hover disabled:opacity-40"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
              <MasterProjectV2SecondaryButton onClick={closeDialog}>
                ביטול
              </MasterProjectV2SecondaryButton>
            </div>
          </form>
        </div>
      )}
    </ForteV2TabShell>
  );
}
