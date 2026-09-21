import { NextRequest, NextResponse } from "next/server";
import {
  FORTE_MASTER_SESSION_COOKIE,
  isMasterApiSessionValid,
} from "@/lib/forte-master-api-auth";
import { getPublicSiteUrl, META_FACEBOOK_OAUTH_COOKIE } from "@/lib/social-marketing/meta-facebook-config";
import {
  completeFacebookOAuthCallbackServer,
  verifyOAuthState,
} from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

function redirectToAi(query: string): NextResponse {
  const base = getPublicSiteUrl();
  const response = NextResponse.redirect(`${base}/master/ai?${query}`);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.headers.append(
    "Set-Cookie",
    `${META_FACEBOOK_OAUTH_COOKIE}=; Path=/forte/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
  return response;
}

export async function GET(request: NextRequest) {
  if (!isMasterApiSessionValid(request)) {
    return redirectToAi("facebook=error&reason=session");
  }

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  if (!masterToken) {
    return redirectToAi("facebook=error&reason=session");
  }

  const errorParam = request.nextUrl.searchParams.get("error");
  if (errorParam) {
    return redirectToAi("facebook=error&reason=denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const stateQuery = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(META_FACEBOOK_OAUTH_COOKIE)?.value;

  if (!code || !stateQuery || !stateCookie || !verifyOAuthState(stateQuery, stateCookie)) {
    return redirectToAi("facebook=error&reason=state");
  }

  const result = await completeFacebookOAuthCallbackServer({
    code,
    state: stateQuery,
    masterSessionToken: masterToken,
  });

  if (!result.ok) {
    return redirectToAi("facebook=error&reason=oauth");
  }

  return redirectToAi("facebook=select-page");
}
