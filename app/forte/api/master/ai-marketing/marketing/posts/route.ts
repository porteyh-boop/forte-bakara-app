import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  createSocialMarketingPostServer,
  listSocialMarketingPostsServer,
} from "@/lib/social-marketing/social-marketing-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const result = await listSocialMarketingPostsServer();
  if (result.error) {
    return NextResponse.json(
      { posts: [], error: result.error },
      { status: result.error === "supabase_service_unconfigured" ? 503 : 502 }
    );
  }
  return NextResponse.json({ posts: result.posts, error: null });
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

  const result = await createSocialMarketingPostServer(body);
  if (result.error || !result.post) {
    const status =
      result.error === "invalid_input"
        ? 400
        : result.error === "supabase_service_unconfigured"
          ? 503
          : 502;
    return NextResponse.json({ post: null, error: result.error }, { status });
  }
  return NextResponse.json({ post: result.post, error: null });
}
