import type {
  BusinessDashboardResult,
  BusinessPeriodPreset,
} from "@/lib/business-dashboard";

const BUSINESS_DASHBOARD_API = "/forte/api/business-dashboard";

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

export async function fetchBusinessDashboard(input: {
  period: BusinessPeriodPreset;
  from?: string;
  to?: string;
}): Promise<{ dashboard: BusinessDashboardResult | null; error: string | null }> {
  const params = new URLSearchParams({ period: input.period });
  if (input.period === "custom") {
    if (input.from) params.set("from", input.from);
    if (input.to) params.set("to", input.to);
  }

  const response = await fetch(`${BUSINESS_DASHBOARD_API}?${params}`, {
    credentials: "include",
  });
  const payload = await parseJsonResponse<{
    dashboard?: BusinessDashboardResult;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      dashboard: null,
      error: parseApiError(payload, response.status),
    };
  }

  return {
    dashboard: payload?.dashboard ?? null,
    error: payload?.error ?? null,
  };
}
