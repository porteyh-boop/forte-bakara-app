import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  isProjectTaskPriority,
  isProjectTaskStatus,
  type ProjectTask,
  type ProjectTaskInput,
} from "@/lib/project-tasks";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const PROJECT_TASKS_TABLE = "project_tasks";

function mapProjectTaskRow(row: Record<string, unknown>): ProjectTask | null {
  if (!row.id || !row.building_id) return null;
  const priority = String(row.priority ?? "רגילה");
  const status = String(row.status ?? "פתוחה");
  if (!isProjectTaskPriority(priority) || !isProjectTaskStatus(status)) return null;

  return {
    id: String(row.id),
    buildingId: String(row.building_id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    priority,
    status,
    dueDate: row.due_date != null ? String(row.due_date) : "",
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function tableMissingMessage(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  if (
    errorMessage.includes("project_tasks") &&
    (errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find"))
  ) {
    return "טבלת משימות טרם הוגדרה. הריצו את migration 023_project_tasks.sql.";
  }
  return null;
}

export function normalizeRequestedBuildingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeBuildingId(value);
  return normalized || null;
}

export function parseProjectTaskInput(value: unknown): ProjectTaskInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;

  const priority = typeof raw.priority === "string" ? raw.priority : "רגילה";
  const status = typeof raw.status === "string" ? raw.status : "פתוחה";
  if (!isProjectTaskPriority(priority) || !isProjectTaskStatus(status)) return null;

  return {
    title,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    priority,
    status,
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate : "",
  };
}

export function parseProjectTaskPatch(
  value: unknown
): Partial<ProjectTaskInput> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: Partial<ProjectTaskInput> = {};

  if (typeof raw.title === "string") {
    const title = raw.title.trim();
    if (!title) return null;
    patch.title = title;
  }
  if (typeof raw.description === "string") patch.description = raw.description.trim();
  if (typeof raw.priority === "string") {
    if (!isProjectTaskPriority(raw.priority)) return null;
    patch.priority = raw.priority;
  }
  if (typeof raw.status === "string") {
    if (!isProjectTaskStatus(raw.status)) return null;
    patch.status = raw.status;
  }
  if (typeof raw.dueDate === "string") patch.dueDate = raw.dueDate;

  return Object.keys(patch).length > 0 ? patch : null;
}

export async function listProjectTasksForBuilding(
  buildingId: string
): Promise<{ tasks: ProjectTask[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { tasks: [], error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { tasks: [], error: "Supabase service role לא מוגדר." };

  const { data, error } = await client
    .from(PROJECT_TASKS_TABLE)
    .select("*")
    .eq("building_id", normalizeBuildingId(buildingId))
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      tasks: [],
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const tasks = (data ?? [])
    .map((row) => mapProjectTaskRow(row as Record<string, unknown>))
    .filter((task): task is ProjectTask => task != null);

  return { tasks, error: null };
}

export async function createProjectTaskForBuilding(
  buildingId: string,
  input: ProjectTaskInput
): Promise<{ task: ProjectTask | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { task: null, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { task: null, error: "Supabase service role לא מוגדר." };

  const now = new Date().toISOString();
  const { data, error } = await client
    .from(PROJECT_TASKS_TABLE)
    .insert({
      building_id: normalizeBuildingId(buildingId),
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      due_date: input.dueDate || null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return {
      task: null,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const task = mapProjectTaskRow(data as Record<string, unknown>);
  return { task, error: task ? null : "יצירת משימה נכשלה." };
}

export async function updateProjectTaskById(
  taskId: string,
  buildingId: string,
  input: Partial<ProjectTaskInput>
): Promise<{ task: ProjectTask | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { task: null, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { task: null, error: "Supabase service role לא מוגדר." };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;

  const { data, error } = await client
    .from(PROJECT_TASKS_TABLE)
    .update(patch)
    .eq("id", taskId)
    .eq("building_id", normalizeBuildingId(buildingId))
    .select("*")
    .single();

  if (error) {
    return {
      task: null,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const task = mapProjectTaskRow(data as Record<string, unknown>);
  return { task, error: task ? null : "עדכון משימה נכשל." };
}

export async function deleteProjectTaskById(
  taskId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { ok: false, error: "Supabase service role לא מוגדר." };

  const { error } = await client
    .from(PROJECT_TASKS_TABLE)
    .delete()
    .eq("id", taskId)
    .eq("building_id", normalizeBuildingId(buildingId));

  if (error) {
    return {
      ok: false,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  return { ok: true, error: null };
}
