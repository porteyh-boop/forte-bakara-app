import { NextRequest, NextResponse } from "next/server";
import { markMasterFaultInboxReadServer } from "@/lib/master-fault-inbox-server";
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
    const inboxId =
      typeof body?.inboxId === "string" ? body.inboxId.trim() : undefined;
    const faultId =
      typeof body?.faultId === "string" ? body.faultId.trim() : undefined;

    const result = await markMasterFaultInboxReadServer({ inboxId, faultId });
    if (result.error) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: result.ok, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
