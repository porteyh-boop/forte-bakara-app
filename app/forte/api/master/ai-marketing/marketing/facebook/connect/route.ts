import { NextRequest, NextResponse } from "next/server";
import {
  FORTE_MASTER_SESSION_COOKIE,
  requireMasterApiSession,
} from "@/lib/forte-master-api-auth";
import { META_FACEBOOK_OAUTH_COOKIE } from "@/lib/social-marketing/meta-facebook-config";
import { beginFacebookOAuthServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  if (!masterToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await beginFacebookOAuthServer(masterToken);
  if (result.error || !result.redirectUrl) {
    const status = result.error === "meta_app_not_configured" ? 503 : 502;
    return NextResponse.json({ error: result.error ?? "oauth_failed" }, { status });
  }

  const response = NextResponse.redirect(result.redirectUrl);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${META_FACEBOOK_OAUTH_COOKIE}=${result.state}; Path=/forte/api; HttpOnly; SameSite=Lax; Max-Age=900${secure}`
  );
  return response;
}
