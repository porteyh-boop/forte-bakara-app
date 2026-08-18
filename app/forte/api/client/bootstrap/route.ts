import { NextRequest } from "next/server";
import { requireClientPortalAuth } from "@/lib/client-portal-api-auth";
import { buildClientPortalBootstrap } from "@/lib/client-portal-server";
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

  const authResult = await requireClientPortalAuth(request);
  if ("error" in authResult) return authResult.error;

  const bootstrap = await buildClientPortalBootstrap(authResult.auth);
  if (!bootstrap) {
    return clientPortalJson(
      { error: "building_not_found", gate: "building_not_found" },
      403
    );
  }

  return clientPortalJson(bootstrap);
}
