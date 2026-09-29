import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import { requireMasterApiSession } from "@/lib/forte-master-api-auth";
import { getFacebookConnectionStatusServer } from "@/lib/social-marketing/meta-facebook-server";
import {
  setPrimaryInstagramConnectionServer,
  updateFacebookConnectionDisplayLabelServer,
} from "@/lib/social-marketing/social-facebook-pages-server";
import { FORTE_MASTER_SESSION_COOKIE } from "@/lib/forte-master-api-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ connectionId: string }> }
) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  const { connectionId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const bodyRec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const setPrimary =
    bodyRec?.setPrimaryForInstagram === true || bodyRec?.set_primary_for_instagram === true;

  if (setPrimary) {
    const primary = await setPrimaryInstagramConnectionServer(connectionId);
    if (!primary.ok) {
      const status =
        primary.error === "invalid_input" || primary.error === "no_instagram_on_page"
          ? 400
          : primary.error === "not_found"
            ? 404
            : 502;
      return NextResponse.json({ error: primary.error }, { status });
    }
  }

  const displayLabel =
    bodyRec && "displayLabel" in bodyRec
      ? String(bodyRec.displayLabel ?? "")
      : bodyRec && "display_label" in bodyRec
        ? String(bodyRec.display_label ?? "")
        : "";

  if (displayLabel.trim()) {
    const result = await updateFacebookConnectionDisplayLabelServer(connectionId, displayLabel);
    if (!result.ok) {
      const status =
        result.error === "invalid_input" ? 400 : result.error === "not_found" ? 404 : 502;
      return NextResponse.json({ error: result.error }, { status });
    }
  } else if (!setPrimary) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const masterToken = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  const statusResult = await getFacebookConnectionStatusServer(masterToken);
  return NextResponse.json({ ok: true, status: statusResult.status, error: null });
}
