import { NextRequest, NextResponse } from "next/server";
import { listMasterFaultInboxItemsServer } from "@/lib/master-fault-inbox-server";
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

  const unreadOnly =
    request.nextUrl.searchParams.get("unreadOnly") === "1" ||
    request.nextUrl.searchParams.get("unreadOnly") === "true";

  const result = await listMasterFaultInboxItemsServer({ unreadOnly });
  if (result.error) {
    return NextResponse.json(
      { items: [], error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { items: result.items, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
