import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import { requireMasterApiSession } from "@/lib/forte-master-api-auth";
import { disconnectFacebookServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const result = await disconnectFacebookServer();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ disconnected: true, error: null });
}
