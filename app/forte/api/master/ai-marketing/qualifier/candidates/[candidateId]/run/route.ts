import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { runQualifierOnCandidateServer } from "@/lib/qualifier/qualifier-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function POST(
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
  const result = await runQualifierOnCandidateServer(candidateId);

  if (result.error) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_input"
          ? 400
          : result.error === "qualifier_agent_missing"
            ? 503
            : 502;
    return NextResponse.json(
      { candidate: null, error: result.error },
      { status }
    );
  }

  return NextResponse.json({ candidate: result.candidate, error: null });
}
