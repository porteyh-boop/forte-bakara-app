import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { deleteSalesLeadServer } from "@/lib/sales-leads-cleanup-server";
import {
  parseSalesLeadDraft,
  parseSalesLeadId,
  updateSalesLeadServer,
} from "@/lib/sales-leads-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ leadId: string }>;
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

  const { leadId: routeLeadId } = await context.params;
  const leadId = parseSalesLeadId(routeLeadId);
  if (!leadId) {
    return NextResponse.json({ error: "invalid_lead_id" }, { status: 400 });
  }

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

  const result = await updateSalesLeadServer(leadId, draft);
  if (result.error || !result.lead) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_lead_id"
          ? 400
          : result.error === "supabase_service_unconfigured"
            ? 503
            : result.error === "save_failed"
              ? 502
              : 400;
    return NextResponse.json(
      {
        error: result.error ?? "save_failed",
        lead: result.lead,
        openedProject: result.openedProject,
        projectConversion: result.projectConversion,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      lead: result.lead,
      error: null,
      openedProject: result.openedProject,
      projectConversion: result.projectConversion,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const { leadId: routeLeadId } = await context.params;
  const leadId = parseSalesLeadId(routeLeadId);
  if (!leadId) {
    return NextResponse.json({ error: "invalid_lead_id" }, { status: 400 });
  }

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const result = await deleteSalesLeadServer(leadId);
  if (!result.deleted) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "lead_protected"
          ? 409
          : result.error === "invalid_lead_id"
            ? 400
            : result.error === "supabase_service_unconfigured"
              ? 503
              : 502;
    return NextResponse.json({ deleted: false, error: result.error }, { status });
  }

  return NextResponse.json(
    { deleted: true, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
