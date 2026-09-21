import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { duplicateSocialMarketingPostServer } from "@/lib/social-marketing/social-marketing-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ postId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { postId } = await context.params;
  const result = await duplicateSocialMarketingPostServer(postId);
  if (result.error || !result.post) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "invalid_input"
          ? 400
          : result.error === "supabase_service_unconfigured"
            ? 503
            : 502;
    return NextResponse.json({ post: null, error: result.error }, { status });
  }
  return NextResponse.json({ post: result.post, error: null });
}
