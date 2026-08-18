import type {
  ClientPortalActivityInput,
  ClientPortalBootstrapDto,
  ClientPortalFaultSubmitInput,
  ClientPortalFaultSubmitResult,
  ClientPortalFeedbackSubmitInput,
  ClientPortalStatisticsDto,
} from "@/lib/client-portal-dto";
import { CLIENT_PORTAL_TOKEN_HEADER } from "@/lib/client-portal-api-auth";

function portalHeaders(token: string): HeadersInit {
  return {
    [CLIENT_PORTAL_TOKEN_HEADER]: token,
    "Content-Type": "application/json",
  };
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.message ?? body.error ?? `http_${response.status}`;
  } catch {
    return `http_${response.status}`;
  }
}

export type ClientPortalBootstrapResult =
  | { ok: true; data: ClientPortalBootstrapDto }
  | { ok: false; gate?: string | null; message?: string; status: number };

export async function fetchClientPortalBootstrap(
  token: string
): Promise<ClientPortalBootstrapResult> {
  const response = await fetch("/forte/api/client/bootstrap", {
    method: "GET",
    headers: portalHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    try {
      const body = (await response.json()) as {
        gate?: string | null;
        message?: string;
      };
      return {
        ok: false,
        gate: body.gate,
        message: body.message,
        status: response.status,
      };
    } catch {
      return { ok: false, status: response.status };
    }
  }

  const data = (await response.json()) as ClientPortalBootstrapDto;
  return { ok: true, data };
}

export async function submitClientPortalFault(
  token: string,
  input: ClientPortalFaultSubmitInput
): Promise<
  | { ok: true; fault: ClientPortalFaultSubmitResult }
  | { ok: false; error: string }
> {
  const response = await fetch("/forte/api/client/faults", {
    method: "POST",
    headers: portalHeaders(token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return { ok: false, error: await parseError(response) };
  }

  const body = (await response.json()) as { fault: ClientPortalFaultSubmitResult };
  return { ok: true, fault: body.fault };
}

export async function submitClientPortalFeedback(
  token: string,
  input: ClientPortalFeedbackSubmitInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch("/forte/api/client/feedback", {
    method: "POST",
    headers: portalHeaders(token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    return { ok: false, error: await parseError(response) };
  }

  return { ok: true };
}

export async function logClientPortalActivityApi(
  token: string,
  input: ClientPortalActivityInput
): Promise<boolean> {
  const response = await fetch("/forte/api/client/activity", {
    method: "POST",
    headers: portalHeaders(token),
    body: JSON.stringify(input),
  });
  return response.ok;
}

export async function fetchClientPortalStatistics(
  token: string
): Promise<
  | { ok: true; data: ClientPortalStatisticsDto }
  | { ok: false; error: string }
> {
  const response = await fetch("/forte/api/client/statistics", {
    method: "GET",
    headers: portalHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return { ok: false, error: await parseError(response) };
  }

  const data = (await response.json()) as ClientPortalStatisticsDto;
  return { ok: true, data };
}
