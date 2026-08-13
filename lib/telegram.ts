const TELEGRAM_API_TIMEOUT_MS = 3000;

export interface TelegramFaultNotificationInput {
  buildingName: string;
  elevatorName: string;
  faultType: string;
  description: string;
  isDisabled: boolean;
  ticketNumber?: string;
  reportedBy?: string;
  reportedPhone?: string;
}

export interface TelegramPilotFaultNotificationInput {
  ticketNumber: string;
  buildingName: string;
  elevatorName: string;
  description: string;
  createdAt: string;
}

export interface TelegramNotificationPayload {
  ticketNumber: string;
  buildingName: string;
  elevatorName: string;
  description: string;
  createdAt: string;
}

function buildFaultMessage(input: TelegramFaultNotificationInput): string {
  const lines = [
    "🔔 דיווח תקלה חדש",
    `בניין: ${input.buildingName}`,
    `מעלית: ${input.elevatorName}`,
    `סוג תקלה: ${input.faultType}`,
    input.isDisabled ? "⚠️ מעלית מושבתת" : null,
    `תיאור: ${input.description}`,
    input.ticketNumber ? `מספר פנייה: ${input.ticketNumber}` : null,
    input.reportedBy ? `דווח ע"י: ${input.reportedBy}` : null,
    input.reportedPhone ? `טלפון: ${input.reportedPhone}` : null,
  ];

  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function buildPilotFaultMessage(input: TelegramPilotFaultNotificationInput): string {
  const date = new Date(input.createdAt).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
  });

  return [
    "🚨 תקלה חדשה",
    `מספר תקלה: ${input.ticketNumber}`,
    `בניין: ${input.buildingName}`,
    `מעלית: ${input.elevatorName}`,
    `תיאור: ${input.description}`,
    `תאריך פתיחה: ${date}`,
  ].join("\n");
}

async function postTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  signal: AbortSignal
): Promise<Response> {
  const body = JSON.stringify({ chat_id: chatId, text });
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  });
}

export type TelegramDeliveryResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deliverTelegramMessage(
  text: string
): Promise<TelegramDeliveryResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    const error = "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured";
    console.error("[telegram] notification delivery failed:", error);
    return { ok: false, error };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const response = await postTelegramMessage(
      botToken,
      chatId,
      text,
      controller.signal
    );

    if (!response.ok) {
      throw new Error(`Telegram HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!payload.ok) {
      throw new Error(payload.description ?? "Telegram API returned ok=false");
    }

    console.log("[telegram-trace] deliverTelegramMessage: Telegram API ok", {
      messageId: payload.result?.message_id ?? null,
    });

    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[telegram] notification delivery failed:", detail);
    return { ok: false, error: detail };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fire-and-forget: never throws, never retries, bounded by a 3s timeout.
 * A missing/invalid token, chat id, or network failure must not surface
 * to the caller.
 */
export async function sendTelegramFaultNotification(
  input: TelegramFaultNotificationInput
): Promise<TelegramDeliveryResult> {
  return deliverTelegramMessage(buildFaultMessage(input));
}

export async function sendTelegramPilotFaultNotification(
  input: TelegramPilotFaultNotificationInput
): Promise<TelegramDeliveryResult> {
  return deliverTelegramMessage(buildPilotFaultMessage(input));
}

/**
 * Client-side fire-and-forget wrapper — posts to /api/telegram-notify.
 * Never throws and must not affect fault saving.
 */
export function sendTelegramNotification(payload: TelegramNotificationPayload): void {
  if (typeof window === "undefined") return;

  console.log("[TRACE] sendTelegramNotification entered");

  console.log("[TRACE] before fetch");

  void fetch("/api/telegram-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then((response) => {
      console.log("[TRACE] after fetch", response.status);
    })
    .catch((error) => {
      console.log("[TRACE] after fetch", error instanceof Error ? error.message : String(error));
    });
}
