import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import { listMasterFaultsByBuildingServer } from "@/lib/master-faults-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await listMasterFaultsByBuildingServer(buildingId);
  if (result.error) {
    return NextResponse.json(
      { faults: [], error: result.error },
      { status: result.error === "invalid_building_id" ? 400 : 502 }
    );
  }

  return NextResponse.json(
    { faults: result.faults, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
