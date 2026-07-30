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

async function deliverTelegramMessage(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error("Telegram delivery failed");
    }
  } catch {
    console.error("[telegram] notification delivery failed");
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
): Promise<void> {
  await deliverTelegramMessage(buildFaultMessage(input));
}

export async function sendTelegramPilotFaultNotification(
  input: TelegramPilotFaultNotificationInput
): Promise<void> {
  await deliverTelegramMessage(buildPilotFaultMessage(input));
}

/**
 * Client-side fire-and-forget wrapper — posts to /api/telegram-notify.
 * Never throws and must not affect fault saving.
 */
export function sendTelegramNotification(payload: TelegramNotificationPayload): void {
  void fetch("/api/telegram-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    console.error("[telegram] notification request failed");
  });
}
