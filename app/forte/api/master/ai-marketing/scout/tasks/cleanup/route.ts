import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  executeScoutTaskCleanupServer,
  previewScoutTaskCleanupServer,
  type ScoutTaskCleanupOptions,
} from "@/lib/scout/scout-cleanup-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function parseOptions(body: unknown): ScoutTaskCleanupOptions | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  return {
    failed: Boolean(raw.failed),
    completed: Boolean(raw.completed),
    emptyStale: Boolean(raw.emptyStale),
  };
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

  const options = parseOptions(body);
  if (!options) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const previewOnly =
    typeof body === "object" &&
    body &&
    "preview" in body &&
    Boolean((body as { preview?: boolean }).preview);

  if (previewOnly) {
    const result = await previewScoutTaskCleanupServer(options);
    if (result.error === "invalid_input") {
      return NextResponse.json({ count: 0, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ count: result.count, error: null });
  }

  const result = await executeScoutTaskCleanupServer(options);
  if (result.error === "invalid_input") {
    return NextResponse.json({ deleted: 0, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ deleted: result.deleted, error: null });
}
