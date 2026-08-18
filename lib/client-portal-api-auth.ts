import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getClientAccessGateMessage,
  resolveClientAccessGate,
} from "@/lib/client-access";
import type { ClientPermissionFlags } from "@/lib/client-permissions";
import {
  getClientAccessSessionByTokenServer,
  getClientPermissionsServer,
} from "@/lib/client-portal-server";
import type {
  ClientPortalAuthContext,
  ClientPortalGateError,
} from "@/lib/client-portal-dto";

export type { ClientPortalAuthContext };

export const CLIENT_PORTAL_TOKEN_HEADER = "x-client-portal-token";

export function extractClientPortalToken(request: NextRequest): string | null {
  const headerToken = request.headers.get(CLIENT_PORTAL_TOKEN_HEADER)?.trim();
  if (headerToken) return headerToken;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearer = authHeader.slice("Bearer ".length).trim();
    if (bearer) return bearer;
  }

  const queryToken = request.nextUrl.searchParams.get("token")?.trim();
  if (queryToken) return queryToken;

  return null;
}

export function gateErrorToHttpStatus(gate: ClientPortalGateError): number {
  switch (gate) {
    case "invalid":
    case "expired":
      return 401;
    case "deactivated":
    case "access_denied":
    case "building_not_found":
      return 403;
    default:
      return 403;
  }
}

export function clientPortalErrorResponse(
  error: string,
  gate?: ClientPortalGateError,
  message?: string
): NextResponse {
  const status = gate ? gateErrorToHttpStatus(gate) : 403;
  return NextResponse.json(
    {
      error,
      gate: gate ?? null,
      message: message ?? (gate ? getClientAccessGateMessage(gate === "access_denied" ? "invalid" : gate === "building_not_found" ? "invalid" : gate) : undefined),
    },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export function forbiddenBuildingMismatchResponse(): NextResponse {
  return NextResponse.json(
    { error: "forbidden_building", message: "אין הרשאה לבניין זה." },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

export function assertRequestedBuildingMatchesToken(
  requestedBuildingId: string | undefined | null,
  authorizedBuildingId: string
): NextResponse | null {
  if (!requestedBuildingId?.trim()) return null;
  const normalizedRequested = requestedBuildingId.trim().toLowerCase();
  const normalizedAuthorized = authorizedBuildingId.trim().toLowerCase();
  if (normalizedRequested !== normalizedAuthorized) {
    return forbiddenBuildingMismatchResponse();
  }
  return null;
}

export async function requireClientPortalAuth(
  request: NextRequest,
  options: { requireDashboard?: boolean; requiredPermission?: keyof ClientPermissionFlags } = {}
): Promise<
  | { error: NextResponse }
  | { auth: ClientPortalAuthContext }
> {
  const token = extractClientPortalToken(request);
  if (!token) {
    return {
      error: clientPortalErrorResponse("missing_token", "invalid", "קישור לא תקין"),
    };
  }

  const session = await getClientAccessSessionByTokenServer(token);
  const gate = resolveClientAccessGate(session);

  if (gate !== "ok" || !session) {
    return {
      error: clientPortalErrorResponse(
        gate === "expired" ? "expired_token" : gate === "deactivated" ? "deactivated_token" : "invalid_token",
        gate === "ok" ? "invalid" : gate
      ),
    };
  }

  const permissions = await getClientPermissionsServer(session.user.id);

  if (options.requireDashboard !== false && !permissions.can_view_building_dashboard) {
    return {
      error: clientPortalErrorResponse(
        "access_denied",
        "access_denied",
        "אין לך הרשאה לגשת לפורטל."
      ),
    };
  }

  if (
    options.requiredPermission &&
    !permissions[options.requiredPermission]
  ) {
    return {
      error: clientPortalErrorResponse(
        "permission_denied",
        "access_denied",
        "אין הרשאה לפעולה זו."
      ),
    };
  }

  const buildingId = session.access.building_id.trim();
  if (!buildingId) {
    return {
      error: clientPortalErrorResponse("building_not_found", "building_not_found"),
    };
  }

  return {
    auth: {
      session,
      permissions,
      buildingId,
    },
  };
}

/** Pure helper for QA — elevator must belong to authorized building scope. */
export function isElevatorAuthorizedForClientAccess(
  elevatorId: string,
  authorizedElevatorIds: readonly string[],
  accessLevel: "building" | "elevator",
  lockedElevatorId: string | null
): boolean {
  const trimmed = elevatorId.trim();
  if (!trimmed) return false;
  if (!authorizedElevatorIds.includes(trimmed)) return false;
  if (accessLevel === "elevator" && lockedElevatorId) {
    return trimmed === lockedElevatorId;
  }
  return true;
}
