import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { generateMarketingPostsBatchServer } from "@/lib/social-marketing/social-marketing-agent";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function errorStatus(error: string | null): number {
  if (error === "generation_in_progress") return 409;
  if (error === "openai_not_configured") return 503;
  if (
    error === "invalid_llm_response" ||
    error === "llm_failed" ||
    error === "image_generation_failed" ||
    error === "image_upload_failed"
  ) {
    return 502;
  }
  if (error === "supabase_service_unconfigured") return 503;
  return 502;
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const result = await generateMarketingPostsBatchServer();
  if (result.error) {
    return NextResponse.json(
      { posts: [], error: result.error },
      { status: errorStatus(result.error) }
    );
  }

  return NextResponse.json({ posts: result.posts, error: null });
}
