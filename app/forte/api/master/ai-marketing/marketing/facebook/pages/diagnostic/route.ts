import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  FORTE_MASTER_SESSION_COOKIE,
  requireMasterApiSession,
} from "@/lib/forte-master-api-auth";
import { isMetaFacebookMeAccountsDebugEnabled } from "@/lib/social-marketing/meta-facebook-config";
import { getFacebookPagesMeAccountsDiagnosticServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isMetaFacebookMeAccountsDebugEnabled()) {
    return NextResponse.json({ error: "debug_disabled" }, { status: 404 });
  }
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  if (!masterToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getFacebookPagesMeAccountsDiagnosticServer(masterToken);
  if (result.error === "oauth_failed") {
    return NextResponse.json(
      {
        error: "no_pending_oauth",
        hint: "התחבר מחדש לפייסבוק ואל תלחץ «בחר» — קרא ל-endpoint לפני בחירת דף.",
      },
      { status: 401 }
    );
  }
  if (result.error || !result.diagnostic) {
    return NextResponse.json({ error: result.error ?? "meta_api_error" }, { status: 502 });
  }

  const d = result.diagnostic;
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    rawCount: d.rawCount,
    hasNextPage: d.hasNextPage,
    pages: d.pages,
    error: null,
  });
}
