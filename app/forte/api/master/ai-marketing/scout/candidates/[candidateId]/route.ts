import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { patchScoutCandidateReviewServer } from "@/lib/scout/scout-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ candidateId: string }> }
) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const statusRaw =
    typeof body === "object" && body && "reviewStatus" in body
      ? String((body as { reviewStatus: unknown }).reviewStatus)
      : "";

  if (statusRaw !== "approved" && statusRaw !== "rejected") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const result = await patchScoutCandidateReviewServer({
    candidateId,
    reviewStatus: statusRaw,
  });

  if (result.error) {
    const httpStatus =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_status"
          ? 400
          : 502;
    return NextResponse.json(
      { candidate: null, error: result.error },
      { status: httpStatus }
    );
  }

  return NextResponse.json({ candidate: result.candidate, error: null });
}
