import { NextRequest, NextResponse } from "next/server";
import {
  parseBuildingClientUpdateId,
  parsePatchMasterBuildingClientUpdateInput,
  patchMasterBuildingClientUpdateServer,
} from "@/lib/building-client-updates-server";
import { BUILDING_FORBIDDEN_ERROR, parseBuildingIdFilter } from "@/lib/master-client-access-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ updateId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { updateId: routeUpdateId } = await context.params;
  const updateId = parseBuildingClientUpdateId(routeUpdateId);
  if (!updateId) {
    return NextResponse.json({ error: "invalid_update_id" }, { status: 400 });
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const patch = parsePatchMasterBuildingClientUpdateInput(body?.patch ?? body);
    if (!patch) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await patchMasterBuildingClientUpdateServer(
      updateId,
      buildingId,
      patch
    );

    if (!result.update) {
      const status =
        result.error === BUILDING_FORBIDDEN_ERROR
          ? 403
          : result.error === "not_found"
            ? 404
            : 502;
      return NextResponse.json(
        { update: null, error: result.error ?? "update_failed" },
        { status }
      );
    }

    return NextResponse.json({ update: result.update, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
