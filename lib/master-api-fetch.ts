export function parseMasterApiError(payload: unknown, status: number): string {
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

export async function parseMasterApiJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function isMasterBrowserContext(): boolean {
  return typeof window !== "undefined";
}

export async function masterApiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
