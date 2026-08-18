import { NextRequest } from "next/server";
import {
  assertRequestedBuildingMatchesToken,
  requireClientPortalAuth,
} from "@/lib/client-portal-api-auth";
import type { ClientPortalFaultSubmitInput } from "@/lib/client-portal-dto";
import {
  buildClientPortalBootstrap,
  submitClientPortalFaultServer,
} from "@/lib/client-portal-server";
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
    requiredPermission: "can_report_faults",
  });
  if ("error" in authResult) return authResult.error;

  let body: ClientPortalFaultSubmitInput;
  try {
    body = (await request.json()) as ClientPortalFaultSubmitInput;
  } catch {
    return clientPortalJson({ error: "invalid_request" }, 400);
  }

  const buildingMismatch = assertRequestedBuildingMatchesToken(
    body.buildingId,
    authResult.auth.buildingId
  );
  if (buildingMismatch) return buildingMismatch;

  const bootstrap = await buildClientPortalBootstrap(authResult.auth);
  if (!bootstrap) {
    return clientPortalJson({ error: "building_not_found" }, 403);
  }

  const allowImageUpload = authResult.auth.permissions.can_upload_images;
  const result = await submitClientPortalFaultServer(
    authResult.auth,
    {
      ...body,
      imageData: allowImageUpload ? body.imageData ?? null : null,
    },
    bootstrap.elevators
  );

  if (!result.ok) {
    const status =
      result.error === "forbidden_elevator" ? 403 : 400;
    return clientPortalJson({ error: result.error }, status);
  }

  return clientPortalJson({ fault: result.fault });
}
