import { NextRequest } from "next/server";
import { countUnreadClientBuildingUpdatesServer } from "@/lib/building-client-updates-server";
import { requireClientPortalAuth } from "@/lib/client-portal-api-auth";
import {
  assertClientPortalOrigin,
  assertClientPortalServiceConfigured,
  clientPortalJson,
} from "@/lib/client-portal-route-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const originError = assertClientPortalOrigin(request);
  if (originError) return originError;

  const serviceError = assertClientPortalServiceConfigured();
  if (serviceError) return serviceError;

  const authResult = await requireClientPortalAuth(request, {
    requireDashboard: true,
    requiredPermission: "can_view_client_updates",
  });
  if ("error" in authResult) return authResult.error;

  const result = await countUnreadClientBuildingUpdatesServer(authResult.auth);
  if (result.error === "permission_denied") {
    return clientPortalJson({ error: "permission_denied" }, 403);
  }
  if (result.error) {
    return clientPortalJson({ error: result.error }, 502);
  }

  return clientPortalJson({ unreadCount: result.count });
}
