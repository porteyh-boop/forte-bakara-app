import { isPilotCloudConfigured } from "./pilot-cloud";

const BUILDINGS_DELETE_API = "/forte/api/buildings";

interface ApiErrorPayload {
  error?: string;
}

interface DeleteResponse {
  ok?: boolean;
  deletedBuildingId?: string;
  error?: string | null;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload & {
      error?: string | null;
    };
    if (payload.error === "unauthorized") {
      return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
    }
    if (payload.error === "supabase_service_unconfigured") {
      return "Supabase Service Role לא מוגדר בשרת.";
    }
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    /* ignore */
  }

  if (response.status === 401) {
    return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
  }
  if (response.status === 503) {
    return "שירות מחיקת פרויקט אינו זמין כרגע.";
  }
  return "מחיקת פרויקט נכשלה.";
}

export function isBuildingDeleteConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function deleteBuildingProject(
  buildingId: string,
  confirmBuildingId: string
): Promise<{ ok: boolean; error: string | null; deletedBuildingId?: string }> {
  if (!isBuildingDeleteConfigured()) {
    return { ok: false, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(
      `${BUILDINGS_DELETE_API}/${encodeURIComponent(buildingId)}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmBuildingId }),
      }
    );

    const payload = (await response.json()) as DeleteResponse;
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? (await parseApiError(response)),
      };
    }

    return {
      ok: Boolean(payload.ok),
      error: payload.error ?? null,
      deletedBuildingId: payload.deletedBuildingId,
    };
  } catch {
    return { ok: false, error: "מחיקת פרויקט נכשלה." };
  }
}
