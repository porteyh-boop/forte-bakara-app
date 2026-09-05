import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  getPublicFormClientIp,
  submitPublicSalesLeadForm,
} from "@/lib/sales-lead-public-form-server";

export const dynamic = "force-dynamic";

function json(
  body: { ok: boolean; error?: string },
  status: number
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return json({ ok: false, error: "origin_not_allowed" }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const result = await submitPublicSalesLeadForm({
    body,
    idempotencyKey:
      request.headers.get("idempotency-key") ?? raw.idempotencyKey,
    startedAt: raw.startedAt,
    clientIp: getPublicFormClientIp(request.headers),
  });

  if (result.ok) {
    return json({ ok: true }, result.status);
  }
  return json({ ok: false, error: result.error ?? "invalid_request" }, result.status);
}
