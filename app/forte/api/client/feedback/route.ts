import { NextRequest } from "next/server";
import {
  assertRequestedBuildingMatchesToken,
  requireClientPortalAuth,
} from "@/lib/client-portal-api-auth";
import type { ClientPortalFeedbackSubmitInput } from "@/lib/client-portal-dto";
import { submitClientPortalFeedbackServer } from "@/lib/client-portal-server";
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
    requiredPermission: "can_submit_feedback",
  });
  if ("error" in authResult) return authResult.error;

  let body: ClientPortalFeedbackSubmitInput;
  try {
    body = (await request.json()) as ClientPortalFeedbackSubmitInput;
  } catch {
    return clientPortalJson({ error: "invalid_request" }, 400);
  }

  const buildingMismatch = assertRequestedBuildingMatchesToken(
    body.buildingId,
    authResult.auth.buildingId
  );
  if (buildingMismatch) return buildingMismatch;

  const result = await submitClientPortalFeedbackServer(authResult.auth, body);
  if (!result.ok) {
    return clientPortalJson({ error: result.error }, 400);
  }

  return clientPortalJson({ ok: true });
}
