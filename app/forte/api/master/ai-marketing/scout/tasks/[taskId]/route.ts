import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { deleteScoutTaskServer } from "@/lib/scout/scout-cleanup-server";
import { getScoutTaskDetailServer } from "@/lib/scout/scout-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function GET(
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
  const result = await getScoutTaskDetailServer(taskId);
  if (result.error === "not_found") {
    return NextResponse.json({ task: null, error: result.error }, { status: 404 });
  }
  if (result.error) {
    return NextResponse.json(
      { task: null, error: result.error },
      { status: result.error === "supabase_service_unconfigured" ? 503 : 502 }
    );
  }

  return NextResponse.json({ task: result.task, error: null });
}

export async function DELETE(
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
  const result = await deleteScoutTaskServer(taskId);
  if (result.error === "not_found") {
    return NextResponse.json({ deleted: false, error: result.error }, { status: 404 });
  }
  if (result.error === "task_running") {
    return NextResponse.json({ deleted: false, error: result.error }, { status: 409 });
  }
  if (result.error) {
    return NextResponse.json({ deleted: false, error: result.error }, { status: 502 });
  }
  return NextResponse.json({ deleted: true, error: null });
}
