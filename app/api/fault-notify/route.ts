import { NextRequest, NextResponse } from "next/server";
import { buildFaultNotificationTelegramMessage } from "@/lib/fault-notification-messages";
import {
  FAULT_NOTIFICATION_EVENT_TYPES,
  shouldDispatchOwnerTelegram,
} from "@/lib/fault-notifications";
import {
  parseFaultNotificationDispatchBody,
  recordFaultNotificationServer,
} from "@/lib/fault-notifications-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import { deliverTelegramMessage } from "@/lib/telegram";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function isRateLimited(clientIp: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(clientIp);

  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets.set(clientIp, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "origin_not_allowed" },
      { status: 403 }
    );
  }

  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const input = parseFaultNotificationDispatchBody(body);

    if (
      !input ||
      !(FAULT_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(
        input.eventType
      )
    ) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    if (!shouldDispatchOwnerTelegram(input.eventType)) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "owner_telegram_fault_created_only",
        logged: false,
      });
    }

    const origin =
      request.headers.get("origin") ??
      (request.headers.get("host")
        ? `https://${request.headers.get("host")}`
        : null);
    const text = buildFaultNotificationTelegramMessage(input, { origin });
    const recipient = process.env.TELEGRAM_CHAT_ID?.trim() ?? null;
    const result = await deliverTelegramMessage(text);

    const logRow = await recordFaultNotificationServer({
      faultId: input.faultId,
      buildingId: input.buildingId,
      eventType: input.eventType,
      recipient,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
      sentAt: result.ok ? new Date().toISOString() : null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          logged: Boolean(logRow),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      logged: Boolean(logRow),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[fault-notify] request failed:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
