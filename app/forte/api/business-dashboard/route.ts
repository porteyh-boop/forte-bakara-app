import { NextRequest, NextResponse } from "next/server";
import {
  buildBusinessDashboard,
  parseBusinessPeriodPreset,
  resolveBusinessPeriodRange,
  validateCustomBusinessPeriod,
} from "@/lib/business-dashboard";
import { loadBusinessDashboardData } from "@/lib/business-dashboard-server";
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

  const preset = parseBusinessPeriodPreset(
    request.nextUrl.searchParams.get("period")
  );
  if (!preset) {
    return NextResponse.json({ error: "invalid_period" }, { status: 400 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  if (preset === "custom") {
    const validationError = validateCustomBusinessPeriod(from, to);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
  }

  const period = resolveBusinessPeriodRange(preset, new Date(), from, to);
  const data = await loadBusinessDashboardData();

  if (data.error) {
    return NextResponse.json(
      { dashboard: null, error: data.error },
      { status: 502 }
    );
  }

  const dashboard = buildBusinessDashboard({
    buildings: data.buildings,
    payments: data.payments,
    period,
  });

  return NextResponse.json(
    { dashboard, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
