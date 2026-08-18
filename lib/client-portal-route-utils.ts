import { NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export function clientPortalOriginForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export function clientPortalServiceUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "supabase_service_unconfigured" },
    { status: 503 }
  );
}

export function assertClientPortalOrigin(request: Request): NextResponse | null {
  if (!isAllowedForteApiOrigin(request as import("next/server").NextRequest)) {
    return clientPortalOriginForbiddenResponse();
  }
  return null;
}

export function assertClientPortalServiceConfigured(): NextResponse | null {
  if (!isSupabaseServiceConfigured()) {
    return clientPortalServiceUnavailableResponse();
  }
  return null;
}

export function clientPortalJson<T>(
  body: T,
  status = 200
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
