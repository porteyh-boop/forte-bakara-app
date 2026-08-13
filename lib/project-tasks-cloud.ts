import type { ProjectTask, ProjectTaskInput } from "@/lib/project-tasks";

const PROJECT_TASKS_API = "/forte/api/project-tasks";

function parseApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = String((payload as { error: unknown }).error);
    if (error === "unauthorized" || status === 401) {
      return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
    }
    return error;
  }
  if (status === 401) return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
  return "שגיאת שרת.";
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function isProjectTasksConfigured(): boolean {
  return typeof window !== "undefined";
}

export async function listProjectTasks(
  buildingId: string
): Promise<{ tasks: ProjectTask[]; error: string | null }> {
  const params = new URLSearchParams({ buildingId });
  const response = await fetch(`${PROJECT_TASKS_API}?${params}`, {
    credentials: "include",
  });
  const payload = await parseJsonResponse<{
    tasks?: ProjectTask[];
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      tasks: [],
      error: parseApiError(payload, response.status),
    };
  }

  return {
    tasks: payload?.tasks ?? [],
    error: payload?.error ?? null,
  };
}

export async function createProjectTask(
  buildingId: string,
  input: ProjectTaskInput
): Promise<{ task: ProjectTask | null; error: string | null }> {
  const response = await fetch(PROJECT_TASKS_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId, input }),
  });
  const payload = await parseJsonResponse<{
    task?: ProjectTask | null;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      task: null,
      error: parseApiError(payload, response.status),
    };
  }

  return {
    task: payload?.task ?? null,
    error: payload?.error ?? null,
  };
}

export async function updateProjectTask(
  taskId: string,
  buildingId: string,
  input: Partial<ProjectTaskInput>
): Promise<{ task: ProjectTask | null; error: string | null }> {
  const response = await fetch(`${PROJECT_TASKS_API}/${taskId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId, input }),
  });
  const payload = await parseJsonResponse<{
    task?: ProjectTask | null;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      task: null,
      error: parseApiError(payload, response.status),
    };
  }

  return {
    task: payload?.task ?? null,
    error: payload?.error ?? null,
  };
}

export async function deleteProjectTask(
  taskId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  const params = new URLSearchParams({ buildingId });
  const response = await fetch(`${PROJECT_TASKS_API}/${taskId}?${params}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await parseJsonResponse<{ error?: string | null }>(response);

  if (!response.ok) {
    return { ok: false, error: parseApiError(payload, response.status) };
  }

  return { ok: true, error: null };
}
