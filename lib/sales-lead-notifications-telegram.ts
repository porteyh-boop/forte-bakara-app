import {
  buildMasterSalesLeadPublicUrl,
  buildSalesLeadTelegramMessage,
  SALES_LEAD_NOTIFICATION_TELEGRAM_OPEN_LABEL,
  type SalesLeadNotificationEventKind,
  type SalesLeadNotificationRecord,
} from "@/lib/sales-lead-notifications";
import {
  claimSalesLeadTelegramSendServer,
  loadPendingSalesLeadNotificationServer,
  recordSalesLeadTelegramResultServer,
} from "@/lib/sales-lead-notifications-server";
import {
  deliverTelegramMessage,
  type TelegramDeliveryResult,
} from "@/lib/telegram";

export type SalesLeadTelegramDeliverer = (
  text: string,
  options?: {
    replyMarkup?: { inline_keyboard: { text: string; url: string }[][] };
  }
) => Promise<TelegramDeliveryResult>;

export function buildSalesLeadTelegramPayload(input: {
  eventKind: SalesLeadNotificationEventKind;
  leadId: string;
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  buildingName: string;
  address: string;
  city: string;
  serviceType: string;
  needDescription: string;
  preferredContact: string;
}): {
  text: string;
  replyMarkup: { inline_keyboard: { text: string; url: string }[][] };
} {
  return {
    text: buildSalesLeadTelegramMessage(input),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: SALES_LEAD_NOTIFICATION_TELEGRAM_OPEN_LABEL,
            url: buildMasterSalesLeadPublicUrl(input.leadId),
          },
        ],
      ],
    },
  };
}

export async function sendSalesLeadNotificationTelegramOnce(
  notification: SalesLeadNotificationRecord,
  deliver: SalesLeadTelegramDeliverer = deliverTelegramMessage
): Promise<{ sent: boolean; skipped: boolean; error: string | null }> {
  if (notification.telegramStatus !== "pending") {
    return { sent: false, skipped: true, error: null };
  }
  if (notification.telegramAttemptedAt) {
    return { sent: false, skipped: true, error: null };
  }

  const claim = await claimSalesLeadTelegramSendServer(notification.id);
  if (!claim.claimed) {
    return { sent: false, skipped: true, error: claim.error };
  }

  const payload = buildSalesLeadTelegramPayload({
    eventKind: notification.eventKind,
    leadId: notification.leadId,
    clientName: notification.clientName,
    contactName: notification.contactName,
    phone: notification.phone,
    email: notification.email,
    buildingName: notification.buildingName,
    address: notification.address,
    city: notification.city,
    serviceType: notification.serviceType,
    needDescription: notification.needDescription,
    preferredContact: notification.preferredContact,
  });

  const result = await deliver(payload.text, {
    replyMarkup: payload.replyMarkup,
  });

  const recorded = await recordSalesLeadTelegramResultServer({
    notificationId: notification.id,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
  });

  if (!recorded.claimed) {
    return { sent: false, skipped: true, error: recorded.error };
  }

  return {
    sent: result.ok,
    skipped: false,
    error: result.ok ? null : result.error,
  };
}

export async function notifyPublicSalesLeadFormTelegram(input: {
  alreadyProcessed: boolean;
  notificationId: string | null;
}): Promise<void> {
  if (input.alreadyProcessed || !input.notificationId) return;

  try {
    const notification = await loadPendingSalesLeadNotificationServer(
      input.notificationId
    );
    if (!notification) return;
    await sendSalesLeadNotificationTelegramOnce(notification);
  } catch (error) {
    console.error(
      "[sales-lead-notifications] telegram send failed",
      error instanceof Error ? error.message : error
    );
  }
}
