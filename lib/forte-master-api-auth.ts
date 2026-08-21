import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const FORTE_MASTER_SESSION_COOKIE = "forte_master_api_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 8;

export function getForteSessionSecret(): string | undefined {
  return process.env.FORTE_SESSION_SECRET?.trim();
}

export function isForteSessionSecretConfigured(): boolean {
  return Boolean(getForteSessionSecret());
}

/** Server-only. Prefer MASTER_CODE; NEXT_PUBLIC_MASTER_CODE is legacy fallback (not bundled to client). */
export function getMasterCodeForServer(): string | undefined {
  const serverCode = process.env.MASTER_CODE?.trim();
  if (serverCode) return serverCode;
  return process.env.NEXT_PUBLIC_MASTER_CODE?.trim();
}

export function isMasterCodeConfiguredOnServer(): boolean {
  return Boolean(getMasterCodeForServer());
}

export function verifyMasterCodeOnServer(code: string): boolean {
  const expected = getMasterCodeForServer();
  if (!expected) return false;

  const provided = code.trim();
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

export function createMasterSessionToken(): string | null {
  const secret = getForteSessionSecret();
  if (!secret) return null;

  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const payload = `forte-master:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}

function verifyMasterSessionToken(token: string | undefined): boolean {
  if (!token) return false;

  const secret = getForteSessionSecret();
  if (!secret) return false;

  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = `forte-master:${expStr}`;
  const expectedSig = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  try {
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function buildMasterSessionSetCookie(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${FORTE_MASTER_SESSION_COOKIE}=${token}; Path=/forte/api; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`;
}

export function isMasterApiSessionValid(request: NextRequest): boolean {
  if (!isForteSessionSecretConfigured()) return false;
  const token = request.cookies.get(FORTE_MASTER_SESSION_COOKIE)?.value;
  return verifyMasterSessionToken(token);
}

export function unauthorizedMasterResponse(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export function serviceUnavailableResponse(message = "service_unconfigured"): NextResponse {
  return NextResponse.json({ error: message }, { status: 503 });
}

export function requireMasterApiSession(
  request: NextRequest
): NextResponse | null {
  if (!isForteSessionSecretConfigured()) {
    return serviceUnavailableResponse("forte_session_secret_unconfigured");
  }
  if (!isMasterCodeConfiguredOnServer()) {
    return serviceUnavailableResponse("master_code_unconfigured");
  }
  if (!isMasterApiSessionValid(request)) {
    return unauthorizedMasterResponse();
  }
  return null;
}
