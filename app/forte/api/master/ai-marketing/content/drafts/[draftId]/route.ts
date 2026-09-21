import { NextRequest, NextResponse } from "next/server";
import { deleteContentOutreachDraftServer } from "@/lib/content/content-server";
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ draftId: string }> }
) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { draftId } = await context.params;
  const result = await deleteContentOutreachDraftServer(draftId);
  if (result.error === "not_found") {
    return NextResponse.json({ deleted: false, error: result.error }, { status: 404 });
  }
  if (result.error) {
    const status =
      result.error === "invalid_input"
        ? 400
        : result.error === "content_agent_missing"
          ? 503
          : 502;
    return NextResponse.json({ deleted: false, error: result.error }, { status });
  }
  return NextResponse.json({ deleted: true, error: null });
}
