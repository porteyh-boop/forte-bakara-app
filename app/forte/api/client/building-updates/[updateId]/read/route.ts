import { NextRequest } from "next/server";
import {
  markClientBuildingUpdateReadServer,
  parseBuildingClientUpdateId,
} from "@/lib/building-client-updates-server";
import { requireClientPortalAuth } from "@/lib/client-portal-api-auth";
import {
  assertClientPortalOrigin,
  assertClientPortalServiceConfigured,
  clientPortalJson,
} from "@/lib/client-portal-route-utils";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ updateId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const originError = assertClientPortalOrigin(request);
  if (originError) return originError;

  const serviceError = assertClientPortalServiceConfigured();
  if (serviceError) return serviceError;

  const authResult = await requireClientPortalAuth(request, {
    requireDashboard: true,
    requiredPermission: "can_view_client_updates",
  });
  if ("error" in authResult) return authResult.error;

  const { updateId: routeUpdateId } = await context.params;
  const updateId = parseBuildingClientUpdateId(routeUpdateId);
  if (!updateId) {
    return clientPortalJson({ error: "invalid_update_id" }, 400);
  }

  const result = await markClientBuildingUpdateReadServer(
    authResult.auth,
    updateId
  );

  if (result.error === "permission_denied") {
    return clientPortalJson({ error: "permission_denied" }, 403);
  }
  if (result.error === "not_found") {
    return clientPortalJson({ error: "not_found" }, 404);
  }
  if (result.error) {
    return clientPortalJson({ error: result.error }, 502);
  }

  return clientPortalJson({ ok: true, alreadyRead: result.alreadyRead });
}
