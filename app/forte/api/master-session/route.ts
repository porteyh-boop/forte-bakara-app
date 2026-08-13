import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  buildMasterSessionSetCookie,
  createMasterSessionToken,
  isForteSessionSecretConfigured,
  isMasterApiSessionValid,
  isMasterCodeConfiguredOnServer,
  serviceUnavailableResponse,
  unauthorizedMasterResponse,
  verifyMasterCodeOnServer,
} from "@/lib/forte-master-api-auth";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  if (!isForteSessionSecretConfigured()) {
    return serviceUnavailableResponse("forte_session_secret_unconfigured");
  }

  if (!isMasterCodeConfiguredOnServer()) {
    return serviceUnavailableResponse("master_code_unconfigured");
  }

  if (!isMasterApiSessionValid(request)) {
    return unauthorizedMasterResponse();
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  if (!isForteSessionSecretConfigured()) {
    return serviceUnavailableResponse("forte_session_secret_unconfigured");
  }

  if (!isMasterCodeConfiguredOnServer()) {
    return serviceUnavailableResponse("master_code_unconfigured");
  }

  try {
    const body = await request.json();
    const code = typeof body?.code === "string" ? body.code : "";

    if (!verifyMasterCodeOnServer(code)) {
      return unauthorizedMasterResponse();
    }

    const token = createMasterSessionToken();
    if (!token) {
      return serviceUnavailableResponse("forte_session_secret_unconfigured");
    }

    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Set-Cookie", buildMasterSessionSetCookie(token));
    return response;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
