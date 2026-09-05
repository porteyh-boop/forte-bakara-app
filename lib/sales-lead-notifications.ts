import { MASTER_SALES_PATH } from "@/lib/master-project-v2-routes";
import { masterApiFetch, parseMasterApiJson } from "@/lib/master-api-fetch";

export const SALES_LEAD_NOTIFICATIONS_TABLE = "sales_lead_notifications";
export const SALES_LEAD_NOTIFICATIONS_API =
  "/forte/api/master-sales-lead-notifications";
export const SALES_LEAD_NOTIFICATIONS_POLL_MS = 20_000;

export const SALES_LEAD_MASTER_PUBLIC_ORIGIN =
  "https://forte-bakara-app.vercel.app";

export const SALES_LEAD_NOTIFICATION_EVENT_KINDS = [
  "new_lead",
  "updated_lead",
] as const;

export type SalesLeadNotificationEventKind =
  (typeof SALES_LEAD_NOTIFICATION_EVENT_KINDS)[number];

export const SALES_LEAD_NOTIFICATION_TITLE_NEW = "פנייה חדשה התקבלה";
export const SALES_LEAD_NOTIFICATION_TITLE_UPDATED =
  "התקבלו פרטים נוספים מלקוח";
export const SALES_LEAD_NOTIFICATION_OPEN_LABEL = "פתח פנייה";
export const SALES_LEAD_NOTIFICATION_TELEGRAM_OPEN_LABEL = "פתח את הפנייה";

export const LEAD_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SalesLeadNotificationTelegramStatus = "pending" | "sent" | "failed";

export type SalesLeadNotificationRecord = {
  id: string;
  leadId: string;
  submissionKey: string;
  eventKind: SalesLeadNotificationEventKind;
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
  createdAt: string;
  readAt: string | null;
  telegramStatus: SalesLeadNotificationTelegramStatus;
  telegramAttemptedAt: string | null;
  telegramError: string | null;
};

export function isSalesLeadNotificationEventKind(
  value: unknown
): value is SalesLeadNotificationEventKind {
  return (
    value === "new_lead" ||
    value === "updated_lead"
  );
}

export function salesLeadNotificationTitle(
  kind: SalesLeadNotificationEventKind
): string {
  return kind === "updated_lead"
    ? SALES_LEAD_NOTIFICATION_TITLE_UPDATED
    : SALES_LEAD_NOTIFICATION_TITLE_NEW;
}

export function parseSalesLeadIdParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return LEAD_ID_RE.test(trimmed) ? trimmed : null;
}

export function buildMasterSalesLeadPath(leadId: string): string {
  return `${MASTER_SALES_PATH}?leadId=${encodeURIComponent(leadId)}`;
}

export function buildMasterSalesLeadPublicUrl(leadId: string): string {
  return `${SALES_LEAD_MASTER_PUBLIC_ORIGIN}${buildMasterSalesLeadPath(leadId)}`;
}

export function escapeTelegramPlainText(value: string, maxLength = 400): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function preferredContactDisplay(nextAction: string): string {
  const trimmed = nextAction.trim();
  return trimmed.replace(/^מועד מועדף:\s*/, "");
}

export function formatSalesLeadTelegramAddress(address: string, city: string): string {
  return [address.trim(), city.trim()].filter(Boolean).join(", ");
}

export function buildSalesLeadTelegramMessage(input: {
  eventKind: SalesLeadNotificationEventKind;
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
}): string {
  const title = salesLeadNotificationTitle(input.eventKind);
  return [
    `🔔 ${title}`,
    "",
    `שם הלקוח/החברה: ${escapeTelegramPlainText(input.clientName)}`,
    `איש קשר: ${escapeTelegramPlainText(input.contactName)}`,
    `טלפון: ${escapeTelegramPlainText(input.phone)}`,
    `מייל: ${escapeTelegramPlainText(input.email)}`,
    `בניין: ${escapeTelegramPlainText(input.buildingName)}`,
    `כתובת ועיר: ${escapeTelegramPlainText(
      formatSalesLeadTelegramAddress(input.address, input.city)
    )}`,
    `סוג השירות: ${escapeTelegramPlainText(input.serviceType)}`,
    `תיאור הפנייה: ${escapeTelegramPlainText(input.needDescription, 800)}`,
    `מועד מועדף לחזרה: ${escapeTelegramPlainText(
      preferredContactDisplay(input.preferredContact)
    )}`,
  ].join("\n");
}

export function isSalesLeadNotificationUnread(
  item: Pick<SalesLeadNotificationRecord, "readAt">
): boolean {
  return item.readAt == null;
}

export function findNewSalesLeadNotifications(
  previous: SalesLeadNotificationRecord[],
  next: SalesLeadNotificationRecord[]
): SalesLeadNotificationRecord[] {
  const known = new Set(previous.map((item) => item.id));
  return next.filter((item) => !known.has(item.id));
}

export function pickSalesLeadNotificationPopup(
  items: SalesLeadNotificationRecord[],
  shownIds: Set<string>
): SalesLeadNotificationRecord | null {
  const eligible = items
    .filter(isSalesLeadNotificationUnread)
    .filter((item) => !shownIds.has(item.id))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  return eligible[0] ?? null;
}

export function mapSalesLeadNotificationRow(
  row: Record<string, unknown>
): SalesLeadNotificationRecord | null {
  const id = typeof row.id === "string" ? row.id : "";
  const leadId = typeof row.lead_id === "string" ? row.lead_id : "";
  if (!LEAD_ID_RE.test(id) || !LEAD_ID_RE.test(leadId)) return null;
  if (!isSalesLeadNotificationEventKind(row.event_kind)) return null;

  const telegramStatus =
    row.telegram_status === "sent" || row.telegram_status === "failed"
      ? row.telegram_status
      : "pending";

  return {
    id,
    leadId,
    submissionKey: String(row.submission_key ?? ""),
    eventKind: row.event_kind,
    clientName: String(row.client_name ?? ""),
    contactName: String(row.contact_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    buildingName: String(row.building_name ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    serviceType: String(row.service_type ?? ""),
    needDescription: String(row.need_description ?? ""),
    preferredContact: String(row.preferred_contact ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    readAt: row.read_at ? String(row.read_at) : null,
    telegramStatus,
    telegramAttemptedAt: row.telegram_attempted_at
      ? String(row.telegram_attempted_at)
      : null,
    telegramError: row.telegram_error ? String(row.telegram_error) : null,
  };
}

export async function listSalesLeadNotifications(options?: {
  unreadOnly?: boolean;
}): Promise<{ items: SalesLeadNotificationRecord[]; error: string | null }> {
  try {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.set("unreadOnly", "1");
    const url = params.toString()
      ? `${SALES_LEAD_NOTIFICATIONS_API}?${params.toString()}`
      : SALES_LEAD_NOTIFICATIONS_API;
    const response = await masterApiFetch(url, { method: "GET" });
    const payload = await parseMasterApiJson<{
      items?: SalesLeadNotificationRecord[];
      error?: string | null;
    }>(response);
    if (!response.ok) {
      return {
        items: [],
        error: payload?.error ?? `request_failed_${response.status}`,
      };
    }
    return { items: payload?.items ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}

export async function markSalesLeadNotificationRead(input: {
  notificationId?: string;
  leadId?: string;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const response = await masterApiFetch(`${SALES_LEAD_NOTIFICATIONS_API}/read`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await parseMasterApiJson<{
      ok?: boolean;
      error?: string | null;
    }>(response);
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error ?? `request_failed_${response.status}`,
      };
    }
    return { ok: Boolean(payload?.ok), error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}
