import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  deleteSocialMarketingPostServer,
  runSocialMarketingPostActionServer,
  updateSocialMarketingPostServer,
} from "@/lib/social-marketing/social-marketing-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ postId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function errorStatus(error: string | null): number {
  if (error === "not_found") return 404;
  if (error === "invalid_input" || error === "invalid_status") return 400;
  if (error === "approval_required" || error === "approval_stale") return 409;
  if (error === "publish_in_progress" || error === "already_published") return 409;
  if (error === "not_connected" || error === "token_invalid") return 503;
  if (error === "publish_timeout") return 504;
  if (error === "meta_api_error") return 502;
  if (error === "supabase_service_unconfigured") return 503;
  return 502;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { postId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action =
    body && typeof body === "object" && "action" in body
      ? (body as { action?: unknown }).action
      : null;

  const result = action
    ? await runSocialMarketingPostActionServer(postId, action)
    : await updateSocialMarketingPostServer(postId, body);

  if (result.error || !("post" in result) || !result.post) {
    const err = result.error ?? "save_failed";
    return NextResponse.json(
      { post: null, error: err },
      { status: errorStatus(err) }
    );
  }
  return NextResponse.json({ post: result.post, error: null });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { postId } = await context.params;
  const result = await deleteSocialMarketingPostServer(postId);
  if (!result.deleted) {
    return NextResponse.json(
      { deleted: false, error: result.error },
      { status: errorStatus(result.error) }
    );
  }
  return NextResponse.json({ deleted: true, error: null });
}
