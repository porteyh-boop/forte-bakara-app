import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { markSalesLeadNotificationReadServer } from "@/lib/sales-lead-notifications-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
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
    const notificationId =
      typeof body?.notificationId === "string" ? body.notificationId.trim() : undefined;
    const leadId = typeof body?.leadId === "string" ? body.leadId.trim() : undefined;

    const result = await markSalesLeadNotificationReadServer({
      notificationId,
      leadId,
    });
    if (result.error) {
      const status = result.error === "invalid_input" ? 400 : 502;
      return NextResponse.json(
        { ok: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json({ ok: result.ok, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
