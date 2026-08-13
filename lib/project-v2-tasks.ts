export type ProjectV2TaskPriority = "נמוכה" | "רגילה" | "גבוהה" | "דחופה";
export type ProjectV2TaskStatus = "פתוחה" | "בתהליך" | "הושלמה" | "בוטלה";

export interface ProjectV2Task {
  id: string;
  buildingId: string;
  title: string;
  description: string;
  priority: ProjectV2TaskPriority;
  status: ProjectV2TaskStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export const PROJECT_V2_TASK_PRIORITIES: ProjectV2TaskPriority[] = [
  "נמוכה",
  "רגילה",
  "גבוהה",
  "דחופה",
];

export const PROJECT_V2_TASK_STATUSES: ProjectV2TaskStatus[] = [
  "פתוחה",
  "בתהליך",
  "הושלמה",
  "בוטלה",
];

const STORAGE_KEY = "forte-project-v2-tasks";

function readAll(): ProjectV2Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectV2Task[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(tasks: ProjectV2Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function listProjectV2Tasks(buildingId: string): ProjectV2Task[] {
  const id = buildingId.trim().toLowerCase();
  return readAll()
    .filter((task) => task.buildingId === id)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function createProjectV2Task(
  buildingId: string,
  input: Omit<
    ProjectV2Task,
    "id" | "buildingId" | "createdAt" | "updatedAt"
  >
): ProjectV2Task {
  const now = new Date().toISOString();
  const task: ProjectV2Task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    buildingId: buildingId.trim().toLowerCase(),
    title: input.title.trim(),
    description: input.description.trim(),
    priority: input.priority,
    status: input.status,
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now,
  };
  const all = readAll();
  all.push(task);
  writeAll(all);
  return task;
}

export function updateProjectV2Task(
  taskId: string,
  patch: Partial<
    Pick<
      ProjectV2Task,
      "title" | "description" | "priority" | "status" | "dueDate"
    >
  >
): ProjectV2Task | null {
  const all = readAll();
  const index = all.findIndex((task) => task.id === taskId);
  if (index === -1) return null;

  const current = all[index];
  const updated: ProjectV2Task = {
    ...current,
    ...patch,
    title: patch.title !== undefined ? patch.title.trim() : current.title,
    description:
      patch.description !== undefined
        ? patch.description.trim()
        : current.description,
    updatedAt: new Date().toISOString(),
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

export function deleteProjectV2Task(taskId: string): boolean {
  const all = readAll();
  const next = all.filter((task) => task.id !== taskId);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}
