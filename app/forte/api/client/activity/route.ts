import { NextRequest } from "next/server";
import { requireClientPortalAuth } from "@/lib/client-portal-api-auth";
import type { ClientPortalActivityInput } from "@/lib/client-portal-dto";
import { logClientPortalActivityServer } from "@/lib/client-portal-server";
import {
  assertClientPortalOrigin,
  assertClientPortalServiceConfigured,
  clientPortalJson,
} from "@/lib/client-portal-route-utils";

export async function POST(request: NextRequest) {
  const originError = assertClientPortalOrigin(request);
  if (originError) return originError;

  const serviceError = assertClientPortalServiceConfigured();
  if (serviceError) return serviceError;

  const authResult = await requireClientPortalAuth(request, {
    requireDashboard: true,
  });
  if ("error" in authResult) return authResult.error;

  let body: ClientPortalActivityInput;
  try {
    body = (await request.json()) as ClientPortalActivityInput;
  } catch {
    return clientPortalJson({ error: "invalid_request" }, 400);
  }

  const ok = await logClientPortalActivityServer(authResult.auth, body);
  return clientPortalJson({ ok });
}
