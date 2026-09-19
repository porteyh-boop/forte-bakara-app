import { NextRequest } from "next/server";
import {
  parseBuildingClientUpdateId,
  resolveClientBuildingUpdateAttachmentServer,
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

export async function GET(request: NextRequest, context: RouteContext) {
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

  const result = await resolveClientBuildingUpdateAttachmentServer(
    authResult.auth,
    updateId
  );

  if (!result.ok) {
    if (result.error === "permission_denied") {
      return clientPortalJson({ error: "permission_denied" }, 403);
    }
    if (result.error === "no_attachment") {
      return clientPortalJson({ error: "no_attachment" }, 404);
    }
    if (
      result.error === "not_found" ||
      result.error === "invalid_storage_path"
    ) {
      return clientPortalJson({ error: "not_found" }, 404);
    }
    return clientPortalJson({ error: result.error }, 502);
  }

  if (result.kind === "signed_url") {
    return clientPortalJson({
      url: result.url,
      title: result.title,
      fileName: result.fileName,
    });
  }

  const safeFileName = result.fileName.replace(/[^\w\u0590-\u05FF.\-()+\s]/g, "_");
  return new Response(Buffer.from(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
