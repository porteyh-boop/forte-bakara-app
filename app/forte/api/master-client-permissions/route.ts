import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  getClientPermissionsServer,
  parseClientPermissionFlags,
  parseClientUserId,
  saveClientPermissionsServer,
} from "@/lib/master-client-access-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  const clientUserId = parseClientUserId(
    request.nextUrl.searchParams.get("clientUserId")
  );
  if (!clientUserId) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  const result = await getClientPermissionsServer(clientUserId);
  if (result.error && result.error !== "supabase_service_unconfigured") {
    return NextResponse.json(
      { flags: result.flags, error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ flags: result.flags, error: null });
}

export async function PATCH(request: NextRequest) {
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
    const clientUserId = parseClientUserId(body?.clientUserId);
    const flags = parseClientPermissionFlags(body?.flags);

    if (!clientUserId || !flags) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await saveClientPermissionsServer(clientUserId, flags);
    if (result.error === "not_found") return notFoundResponse();
    if (!result.record) {
      return NextResponse.json(
        { record: null, error: result.error ?? "save_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ record: result.record, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
