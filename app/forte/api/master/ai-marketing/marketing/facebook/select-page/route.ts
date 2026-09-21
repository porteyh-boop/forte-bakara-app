import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  FORTE_MASTER_SESSION_COOKIE,
  requireMasterApiSession,
} from "@/lib/forte-master-api-auth";
import { selectFacebookPageServer } from "@/lib/social-marketing/meta-facebook-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  if (!masterToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const pageId =
    body && typeof body === "object" && "pageId" in body
      ? String((body as { pageId?: unknown }).pageId ?? "")
      : "";

  const result = await selectFacebookPageServer({ masterSessionToken: masterToken, pageId });
  if (result.error || !result.status) {
    const status =
      result.error === "page_not_found" || result.error === "invalid_input"
        ? 400
        : result.error === "page_missing_create_content"
          ? 403
          : 502;
    return NextResponse.json({ status: null, error: result.error }, { status });
  }
  return NextResponse.json({ status: result.status, error: null });
}
