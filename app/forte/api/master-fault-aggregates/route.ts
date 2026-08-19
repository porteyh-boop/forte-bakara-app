import { NextRequest, NextResponse } from "next/server";
import { listMasterFaultAggregatesServer } from "@/lib/master-fault-aggregates-server";
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

  const result = await listMasterFaultAggregatesServer();
  if (result.error) {
    return NextResponse.json(
      { aggregates: [], error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { aggregates: result.aggregates, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
