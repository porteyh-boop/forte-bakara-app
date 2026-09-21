import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  FORTE_MASTER_SESSION_COOKIE,
  requireMasterApiSession,
} from "@/lib/forte-master-api-auth";
import { getFacebookConnectionStatusServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value ?? "";
  const { status } = await getFacebookConnectionStatusServer(masterToken);
  return NextResponse.json({ status, error: null });
}
