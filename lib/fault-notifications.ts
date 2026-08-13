import { isPilotCloudConfigured } from "./pilot-cloud";

export const FAULT_NOTIFICATIONS_TABLE = "fault_notifications";

const FAULT_NOTIFICATIONS_API = "/forte/api/fault-notifications";

export const FAULT_NOTIFICATION_EVENT_TYPES = [
  "FAULT_CREATED",
  "FAULT_TREATMENT_STARTED",
  "FAULT_TREATMENT_UPDATED",
  "FAULT_CLOSED",
  "FAULT_REOPENED",
] as const;

/** Owner Telegram is sent only for new client-reported faults (Phase 2.1). */
export const FAULT_OWNER_TELEGRAM_EVENT_TYPES = ["FAULT_CREATED"] as const;

export type FaultNotificationEventType =
  (typeof FAULT_NOTIFICATION_EVENT_TYPES)[number];

export type FaultOwnerTelegramEventType =
  (typeof FAULT_OWNER_TELEGRAM_EVENT_TYPES)[number];

export function shouldDispatchOwnerTelegram(
  eventType: FaultNotificationEventType
): eventType is FaultOwnerTelegramEventType {
  return (FAULT_OWNER_TELEGRAM_EVENT_TYPES as readonly string[]).includes(
    eventType
  );
}

export type FaultNotificationChannel = "telegram";
export type FaultNotificationStatus = "sent" | "failed";

export interface FaultNotificationRecord {
  id: string;
  fault_id: string;
  building_id: string;
  event_type: FaultNotificationEventType;
  channel: FaultNotificationChannel;
  recipient: string | null;
  status: FaultNotificationStatus;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface FaultNotificationDispatchInput {
  faultId: string;
  buildingId: string;
  eventType: FaultNotificationEventType;
  ticketNumber: string;
  buildingName: string;
  elevatorName: string;
  faultType?: string;
  description: string;
  createdAt?: string;
  faultSource?: string | null;
  isDisabled?: boolean;
  hasImage?: boolean;
  treatmentNote?: string | null;
  closureNote?: string | null;
  status?: string;
}

function isFaultNotificationEventType(
  value: string
): value is FaultNotificationEventType {
  return (FAULT_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

export function mapFaultNotificationRow(
  row: Record<string, unknown>
): FaultNotificationRecord | null {
  if (!row.id || !row.fault_id || !row.building_id) return null;

  const eventType = String(row.event_type ?? "");
  if (!isFaultNotificationEventType(eventType)) return null;

  const status = String(row.status ?? "");
  if (status !== "sent" && status !== "failed") return null;

  return {
    id: String(row.id),
    fault_id: String(row.fault_id),
    building_id: String(row.building_id),
    event_type: eventType,
    channel: "telegram",
    recipient: row.recipient ? String(row.recipient) : null,
    status,
    error: row.error ? String(row.error) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export const FAULT_NOTIFICATION_EVENT_LABELS: Record<
  FaultNotificationEventType,
  string
> = {
  FAULT_CREATED: "תקלה חדשה",
  FAULT_TREATMENT_STARTED: "הועבר לטיפול",
  FAULT_TREATMENT_UPDATED: "עדכון הערת טיפול",
  FAULT_CLOSED: "תקלה נסגרה",
  FAULT_REOPENED: "תקלה נפתחה מחדש",
};

export async function listFaultNotificationsByBuilding(
  buildingId: string
): Promise<FaultNotificationRecord[]> {
  if (!isPilotCloudConfigured() || !buildingId.trim()) return [];

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await fetch(
      `${FAULT_NOTIFICATIONS_API}?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }
    );

    const payload = (await response.json()) as {
      notifications?: FaultNotificationRecord[];
      error?: string | null;
    };

    if (!response.ok) {
      console.warn(
        "[fault-notifications] list by building failed:",
        payload.error ?? response.status
      );
      return [];
    }

    return payload.notifications ?? [];
  } catch (error) {
    console.warn(
      "[fault-notifications] list by building failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export function groupFaultNotificationsByFaultId(
  rows: FaultNotificationRecord[]
): Record<string, FaultNotificationRecord[]> {
  const grouped: Record<string, FaultNotificationRecord[]> = {};
  for (const row of rows) {
    if (!grouped[row.fault_id]) grouped[row.fault_id] = [];
    grouped[row.fault_id].push(row);
  }
  return grouped;
}

export function formatFaultNotificationTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function getLatestSuccessfulFaultNotification(
  rows: FaultNotificationRecord[],
  eventType?: FaultNotificationEventType
): FaultNotificationRecord | null {
  for (const row of rows) {
    if (row.status !== "sent") continue;
    if (eventType && row.event_type !== eventType) continue;
    return row;
  }
  return null;
}
