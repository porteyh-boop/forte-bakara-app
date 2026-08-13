import { NextRequest, NextResponse } from "next/server";
import { normalizeRequestedBuildingId } from "@/lib/building-contacts-server";
import { deleteBuildingProjectServer } from "@/lib/buildings-delete-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ buildingId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { buildingId: buildingIdParam } = await context.params;
  const buildingId = normalizeRequestedBuildingId(buildingIdParam);
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const confirmBuildingId = normalizeRequestedBuildingId(body?.confirmBuildingId);
    if (!confirmBuildingId) {
      return NextResponse.json({ error: "invalid_confirm_building_id" }, { status: 400 });
    }

    const result = await deleteBuildingProjectServer({
      buildingId,
      confirmBuildingId,
    });

    if (!result.ok) {
      const status = result.error?.includes("לא נמצא") ? 404 : 400;
      return NextResponse.json(
        { ok: false, error: result.error, deletedBuildingId: null },
        { status }
      );
    }

    return NextResponse.json({
      ok: true,
      error: null,
      deletedBuildingId: result.deletedBuildingId ?? buildingId,
    });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
