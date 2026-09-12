import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { parseSalesLeadTrialProvisionInput } from "@/lib/sales-lead-trial-portal";
import {
  loadSalesLeadTrialPortalStatusServer,
  provisionSalesLeadTrialPortalServer,
} from "@/lib/sales-lead-trial-portal-server";
import {
  getSalesLeadByIdServer,
  parseSalesLeadId,
} from "@/lib/sales-leads-server";
import {
  isSalesTrialPortalAllowedForLead,
  isSalesTrialPortalFeatureEnabled,
  salesTrialPortalFeatureDisabledError,
  salesTrialPortalLeadNotAllowedError,
} from "@/lib/sales-lead-trial-portal-feature";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ leadId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function trialErrorStatus(error: string): number {
  if (error === "not_found") return 404;
  if (error === "supabase_service_unconfigured") return 503;
  if (
    error === "missing_building_name" ||
    error === "missing_elevators" ||
    error === "invalid_expires_at" ||
    error === "expires_at_must_be_future" ||
    error === "invalid_request"
  ) {
    return 400;
  }
  return 502;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

  const loaded = await getSalesLeadByIdServer(leadId);
  if (!loaded.lead) {
    return NextResponse.json(
      { error: loaded.error ?? "not_found" },
      { status: loaded.error === "not_found" ? 404 : 502 }
    );
  }

  const status = await loadSalesLeadTrialPortalStatusServer(loaded.lead);
  return NextResponse.json(
    { status, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  if (!isSalesTrialPortalFeatureEnabled()) {
    const disabled = salesTrialPortalFeatureDisabledError();
    return NextResponse.json(disabled, { status: 403 });
  }

  if (!isSalesTrialPortalAllowedForLead(leadId)) {
    const blocked = salesTrialPortalLeadNotAllowedError();
    return NextResponse.json(blocked, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const input = parseSalesLeadTrialProvisionInput(body);
  if (!input) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const loaded = await getSalesLeadByIdServer(leadId);
  if (!loaded.lead) {
    return NextResponse.json(
      { error: loaded.error ?? "not_found" },
      { status: loaded.error === "not_found" ? 404 : 502 }
    );
  }

  const provision = await provisionSalesLeadTrialPortalServer(loaded.lead, input);
  if (!provision.result) {
    return NextResponse.json(
      { error: provision.error ?? "provision_failed" },
      { status: trialErrorStatus(provision.error ?? "provision_failed") }
    );
  }

  const refreshed = await getSalesLeadByIdServer(leadId);
  const status = refreshed.lead
    ? await loadSalesLeadTrialPortalStatusServer(refreshed.lead)
    : null;

  return NextResponse.json(
    {
      result: provision.result,
      lead: refreshed.lead,
      status,
      error: null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
