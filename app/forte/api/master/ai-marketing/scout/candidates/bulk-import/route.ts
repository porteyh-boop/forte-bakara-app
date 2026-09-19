import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { bulkImportScoutCandidatesServer } from "@/lib/scout/scout-server";
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

  const candidateIds = Array.isArray((body as { candidateIds?: unknown }).candidateIds)
    ? (body as { candidateIds: unknown[] }).candidateIds
        .map((id) => String(id))
        .filter(Boolean)
    : [];

  if (candidateIds.length === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await bulkImportScoutCandidatesServer(candidateIds);
  return NextResponse.json({
    imported: result.imported,
    error: result.errors.length ? result.errors[0] : null,
  });
}
