import { NextRequest, NextResponse } from "next/server";
import {
  sendTelegramFaultNotification,
  sendTelegramPilotFaultNotification,
} from "@/lib/telegram";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

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

function isAllowedOrigin(request: NextRequest): boolean {
  const host = request.headers.get("host");
  if (!host) return false;

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  return false;
}

function isPilotFaultPayload(body: unknown): body is {
  ticketNumber: string;
  buildingName: string;
  elevatorName: string;
  description: string;
  createdAt: string;
} {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    typeof record.createdAt === "string" &&
    record.createdAt.length > 0 &&
    typeof record.ticketNumber === "string" &&
    typeof record.buildingName === "string" &&
    typeof record.elevatorName === "string" &&
    typeof record.description === "string"
  );
}

/**
 * Best-effort fault notification. Always responds 200 — this endpoint
 * must never affect fault saving or the reporting user, regardless of
 * whether Telegram delivery succeeds or the request is rejected.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request) || isRateLimited(getClientIp(request))) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json();

    if (isPilotFaultPayload(body)) {
      await sendTelegramPilotFaultNotification({
        ticketNumber: String(body.ticketNumber),
        buildingName: String(body.buildingName),
        elevatorName: String(body.elevatorName),
        description: String(body.description),
        createdAt: String(body.createdAt),
      });
    } else {
      await sendTelegramFaultNotification({
        buildingName: String(body?.buildingName ?? ""),
        elevatorName: String(body?.elevatorName ?? ""),
        faultType: String(body?.faultType ?? ""),
        description: String(body?.description ?? ""),
        isDisabled: Boolean(body?.isDisabled),
        ticketNumber: body?.ticketNumber ? String(body.ticketNumber) : undefined,
        reportedBy: body?.reportedBy ? String(body.reportedBy) : undefined,
        reportedPhone: body?.reportedPhone ? String(body.reportedPhone) : undefined,
      });
    }
  } catch {
    // Never throw — this route must have zero effect on the caller.
  }

  return NextResponse.json({ ok: true });
}
