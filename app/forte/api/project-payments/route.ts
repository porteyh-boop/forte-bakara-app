import { NextRequest, NextResponse } from "next/server";
import {
  createProjectPaymentForBuilding,
  listProjectPaymentsForBuilding,
  normalizeRequestedBuildingId,
  parseProjectPaymentInput,
} from "@/lib/project-payments-server";
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
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const buildingId = normalizeRequestedBuildingId(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await listProjectPaymentsForBuilding(buildingId);
  if (result.error) {
    return NextResponse.json(
      { payments: [], error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { payments: result.payments, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  try {
    const body = await request.json();
    const buildingId = normalizeRequestedBuildingId(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const input = parseProjectPaymentInput(body?.input);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await createProjectPaymentForBuilding(buildingId, input);
    if (!result.payment) {
      return NextResponse.json(
        { payment: null, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ payment: result.payment, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
