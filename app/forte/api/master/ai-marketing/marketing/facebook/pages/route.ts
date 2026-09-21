import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  FORTE_MASTER_SESSION_COOKIE,
  requireMasterApiSession,
} from "@/lib/forte-master-api-auth";
import { listSelectableFacebookPagesServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  if (!masterToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await listSelectableFacebookPagesServer(masterToken);
  if (result.error) {
    const status = result.error === "oauth_failed" ? 401 : 502;
    return NextResponse.json({ pages: [], error: result.error }, { status });
  }
  return NextResponse.json({ pages: result.pages, error: null });
}
