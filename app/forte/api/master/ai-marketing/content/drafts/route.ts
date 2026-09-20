import { NextRequest, NextResponse } from "next/server";
import { createContentOutreachDraftServer } from "@/lib/content/content-server";
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
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await createContentOutreachDraftServer(body);
  if (result.error) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "not_approved"
          ? 403
          : result.error === "invalid_input"
            ? 400
            : result.error === "content_agent_missing"
              ? 503
              : 502;
    return NextResponse.json({ draft: null, error: result.error }, { status });
  }

  return NextResponse.json({ draft: result.draft, error: null });
}
