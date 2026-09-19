import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { runScoutTaskByIdServer } from "@/lib/scout/scout-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { taskId } = await context.params;
  const result = await runScoutTaskByIdServer(taskId);
  if (!result.ok) {
    const status =
      result.error === "search_unconfigured"
        ? 503
        : result.error === "task_not_found"
          ? 404
          : 502;
    return NextResponse.json(
      { candidatesAdded: 0, error: result.error },
      { status }
    );
  }

  return NextResponse.json({
    candidatesAdded: result.candidatesAdded,
    error: null,
  });
}
