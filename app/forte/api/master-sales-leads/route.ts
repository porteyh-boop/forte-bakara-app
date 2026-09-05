import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  createSalesLeadServer,
  listSalesLeadsServer,
  parseSalesLeadDraft,
} from "@/lib/sales-leads-server";
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

  const result = await listSalesLeadsServer();
  if (result.error) {
    return NextResponse.json(
      { leads: [], error: result.error },
      { status: result.error === "supabase_service_unconfigured" ? 503 : 502 }
    );
  }

  return NextResponse.json(
    { leads: result.leads, error: null },
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const draft = parseSalesLeadDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await createSalesLeadServer(draft);
  if (result.error || !result.lead) {
    const status =
      result.error === "supabase_service_unconfigured"
        ? 503
        : result.error === "save_failed"
          ? 502
          : 400;
    return NextResponse.json({ error: result.error ?? "save_failed" }, { status });
  }

  return NextResponse.json(
    { lead: result.lead, error: null },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
