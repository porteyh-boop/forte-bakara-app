import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { bulkPatchScoutCandidateReviewServer } from "@/lib/scout/scout-server";
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

  const raw = body as { candidateIds?: unknown; reviewStatus?: unknown };
  const candidateIds = Array.isArray(raw.candidateIds)
    ? raw.candidateIds.map((id) => String(id)).filter(Boolean)
    : [];
  const reviewStatus = String(raw.reviewStatus ?? "");
  if (
    candidateIds.length === 0 ||
    (reviewStatus !== "approved" && reviewStatus !== "rejected")
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await bulkPatchScoutCandidateReviewServer({
    candidateIds,
    reviewStatus,
  });

  return NextResponse.json({ updated: result.updated, error: result.error });
}
