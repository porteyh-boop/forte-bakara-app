import { NextRequest, NextResponse } from "next/server";
import {
  createMasterBuildingClientUpdateServer,
  listMasterBuildingClientUpdatesServer,
  parseCreateMasterBuildingClientUpdateInput,
} from "@/lib/building-client-updates-server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
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

  const result = await listMasterBuildingClientUpdatesServer(buildingId);
  if (result.error) {
    return NextResponse.json(
      { updates: [], error: result.error },
      { status: result.error === "invalid_building_id" ? 400 : 502 }
    );
  }

  return NextResponse.json(
    { updates: result.updates, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  try {
    const body = await request.json();
    const input = parseCreateMasterBuildingClientUpdateInput(body?.input ?? body);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await createMasterBuildingClientUpdateServer(input);
    if (!result.update) {
      const status =
        result.error === "building_forbidden"
          ? 403
          : result.error === "invalid_building_id"
            ? 400
            : 502;
      return NextResponse.json(
        { update: null, error: result.error ?? "create_failed" },
        { status }
      );
    }

    return NextResponse.json({ update: result.update, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
