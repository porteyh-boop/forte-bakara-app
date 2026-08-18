import { NextRequest } from "next/server";
import { requireClientPortalAuth } from "@/lib/client-portal-api-auth";
import { fetchClientPortalStatisticsServer } from "@/lib/client-portal-server";
import {
  assertClientPortalOrigin,
  assertClientPortalServiceConfigured,
  clientPortalJson,
} from "@/lib/client-portal-route-utils";

export async function GET(request: NextRequest) {
  const originError = assertClientPortalOrigin(request);
  if (originError) return originError;

  const serviceError = assertClientPortalServiceConfigured();
  if (serviceError) return serviceError;

  const authResult = await requireClientPortalAuth(request, {
    requiredPermission: "can_view_statistics",
  });
  if ("error" in authResult) return authResult.error;

  const data = await fetchClientPortalStatisticsServer(authResult.auth);
  return clientPortalJson(data);
}
