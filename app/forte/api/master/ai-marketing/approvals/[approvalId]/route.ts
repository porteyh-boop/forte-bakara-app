import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import { patchAiApprovalStatusServer } from "@/lib/forte-ai-marketing-server";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ approvalId: string }> }
) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { approvalId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const statusRaw =
    typeof body === "object" && body && "status" in body
      ? String((body as { status: unknown }).status)
      : "";
  const decisionNote =
    typeof body === "object" && body && "decisionNote" in body
      ? String((body as { decisionNote: unknown }).decisionNote ?? "")
      : "";

  if (statusRaw !== "approved" && statusRaw !== "rejected") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const result = await patchAiApprovalStatusServer({
    approvalId,
    status: statusRaw,
    decisionNote,
  });

  if (result.error) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_approval_id" ||
            result.error === "invalid_status"
          ? 400
          : result.error === "supabase_service_unconfigured"
            ? 503
            : 502;
    return NextResponse.json({ approval: null, error: result.error }, { status });
  }

  return NextResponse.json({ approval: result.approval, error: null });
}
