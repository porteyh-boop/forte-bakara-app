import type {
  CollectionForecast,
  CollectionForecastPaymentRef,
  CollectionForecastProject,
  CollectionForecastStatus,
} from "@/lib/collection-forecasts";

const COLLECTION_FORECASTS_API = "/forte/api/collection-forecasts";

export interface CollectionForecastScreenData {
  month: string;
  projects: CollectionForecastProject[];
  forecasts: CollectionForecast[];
  payments: CollectionForecastPaymentRef[];
}

export interface CollectionForecastMutationPayload {
  forecast: CollectionForecast | null;
  error: string | null;
  code: string | null;
  openBalance: number | null;
  excess: number | null;
}

function parseApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      if (error === "unauthorized" || status === 401) {
        return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
      }
      if (error === "origin_not_allowed") return "הבקשה נחסמה.";
      if (error === "invalid_month") return "חודש התחזית אינו תקין.";
      if (error === "invalid_input" || error === "invalid_request") {
        return "הנתונים שהוזנו אינם תקינים.";
      }
      return error;
    }
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

function mutationFromPayload(
  payload: CollectionForecastMutationPayload | null,
  response: Response
): CollectionForecastMutationPayload {
  if (!response.ok) {
    return {
      forecast: null,
      error: parseApiError(payload, response.status),
      code: payload?.code ?? null,
      openBalance: payload?.openBalance ?? null,
      excess: payload?.excess ?? null,
    };
  }
  return {
    forecast: payload?.forecast ?? null,
    error: payload?.error ?? null,
    code: payload?.code ?? null,
    openBalance: payload?.openBalance ?? null,
    excess: payload?.excess ?? null,
  };
}

export async function fetchCollectionForecastMonth(
  month: string
): Promise<{ screen: CollectionForecastScreenData | null; error: string | null }> {
  const params = new URLSearchParams({ month });
  const response = await fetch(`${COLLECTION_FORECASTS_API}?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parseJsonResponse<{
    screen?: CollectionForecastScreenData;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return { screen: null, error: parseApiError(payload, response.status) };
  }

  return {
    screen: payload?.screen ?? null,
    error: payload?.error ?? null,
  };
}

export async function createCollectionForecast(input: {
  buildingId: string;
  forecastMonth: string;
  plannedAmount: number;
  expectedCollectionDate: string;
  status: CollectionForecastStatus;
  notes: string;
  confirmExceedsBalance: boolean;
}): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(COLLECTION_FORECASTS_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}

export async function updateCollectionForecast(
  forecastId: string,
  input: {
    plannedAmount?: number;
    expectedCollectionDate?: string;
    status?: CollectionForecastStatus;
    notes?: string;
    confirmExceedsBalance: boolean;
  }
): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(`${COLLECTION_FORECASTS_API}/${forecastId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}

export async function deleteCollectionForecast(
  forecastId: string
): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(`${COLLECTION_FORECASTS_API}/${forecastId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}

export async function moveCollectionForecastToNextMonth(
  forecastId: string
): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(`${COLLECTION_FORECASTS_API}/${forecastId}/move`, {
    method: "POST",
    credentials: "include",
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}

export async function linkCollectionForecastPayment(
  forecastId: string,
  paymentId: string
): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(`${COLLECTION_FORECASTS_API}/${forecastId}/link`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId }),
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}

export async function unlinkCollectionForecastPayment(
  forecastId: string
): Promise<CollectionForecastMutationPayload> {
  const response = await fetch(`${COLLECTION_FORECASTS_API}/${forecastId}/link`, {
    method: "DELETE",
    credentials: "include",
  });
  const payload = await parseJsonResponse<CollectionForecastMutationPayload>(response);
  return mutationFromPayload(payload, response);
}
