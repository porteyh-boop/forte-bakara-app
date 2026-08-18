import type { ProjectPayment, ProjectPaymentInput } from "@/lib/project-payments";

const PROJECT_PAYMENTS_API = "/forte/api/project-payments";

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

export async function listProjectPayments(
  buildingId: string
): Promise<{ payments: ProjectPayment[]; error: string | null }> {
  const params = new URLSearchParams({ buildingId });
  const response = await fetch(`${PROJECT_PAYMENTS_API}?${params}`, {
    credentials: "include",
  });
  const payload = await parseJsonResponse<{
    payments?: ProjectPayment[];
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      payments: [],
      error: parseApiError(payload, response.status),
    };
  }

  return {
    payments: payload?.payments ?? [],
    error: payload?.error ?? null,
  };
}

export async function createProjectPayment(
  buildingId: string,
  input: ProjectPaymentInput
): Promise<{ payment: ProjectPayment | null; error: string | null }> {
  const response = await fetch(PROJECT_PAYMENTS_API, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId, input }),
  });
  const payload = await parseJsonResponse<{
    payment?: ProjectPayment | null;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      payment: null,
      error: parseApiError(payload, response.status),
    };
  }

  return {
    payment: payload?.payment ?? null,
    error: payload?.error ?? null,
  };
}

export async function updateProjectPayment(
  paymentId: string,
  buildingId: string,
  input: Partial<ProjectPaymentInput>
): Promise<{ payment: ProjectPayment | null; error: string | null }> {
  const response = await fetch(`${PROJECT_PAYMENTS_API}/${paymentId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buildingId, input }),
  });
  const payload = await parseJsonResponse<{
    payment?: ProjectPayment | null;
    error?: string | null;
  }>(response);

  if (!response.ok) {
    return {
      payment: null,
      error: parseApiError(payload, response.status),
    };
  }

  return {
    payment: payload?.payment ?? null,
    error: payload?.error ?? null,
  };
}

export async function deleteProjectPayment(
  paymentId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  const params = new URLSearchParams({ buildingId });
  const response = await fetch(
    `${PROJECT_PAYMENTS_API}/${paymentId}?${params}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
  const payload = await parseJsonResponse<{ error?: string | null }>(response);

  if (!response.ok) {
    return { ok: false, error: parseApiError(payload, response.status) };
  }

  return { ok: true, error: null };
}
