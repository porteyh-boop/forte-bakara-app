import { getPilotSupabaseClient } from "./pilot-cloud";

export const DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE =
  "document_inspector_notifications";

export const INSPECTOR_NOTIFICATION_TYPES = [
  "day_35",
  "day_40",
  "day_45_plus",
] as const;

export type InspectorNotificationType =
  (typeof INSPECTOR_NOTIFICATION_TYPES)[number];

export interface DocumentInspectorNotificationRecord {
  id: string;
  document_id: string;
  notification_type: InspectorNotificationType;
  sent_at: string;
}

function isInspectorNotificationType(
  value: string
): value is InspectorNotificationType {
  return (INSPECTOR_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

function mapDocumentInspectorNotificationRow(
  row: Record<string, unknown>
): DocumentInspectorNotificationRecord {
  const notificationType = String(row.notification_type);
  return {
    id: String(row.id),
    document_id: String(row.document_id),
    notification_type: isInspectorNotificationType(notificationType)
      ? notificationType
      : "day_35",
    sent_at: String(row.sent_at),
  };
}

export async function listAllDocumentInspectorNotifications(): Promise<
  DocumentInspectorNotificationRecord[]
> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE)
    .select("*")
    .order("sent_at", { ascending: false });

  if (error || !data) {
    console.warn(
      "[document-inspector-notifications] list failed:",
      error?.message
    );
    return [];
  }

  return data.map((row) => mapDocumentInspectorNotificationRow(row));
}

export async function listNotificationsByDocumentId(
  documentId: string
): Promise<DocumentInspectorNotificationRecord[]> {
  const client = getPilotSupabaseClient();
  if (!client || !documentId.trim()) return [];

  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE)
    .select("*")
    .eq("document_id", documentId)
    .order("sent_at", { ascending: false });

  if (error || !data) {
    if (error) {
      console.warn(
        "[document-inspector-notifications] list by document failed:",
        error.message
      );
    }
    return [];
  }

  return data.map((row) => mapDocumentInspectorNotificationRow(row));
}

export function groupNotificationsByDocumentId(
  rows: DocumentInspectorNotificationRecord[]
): Record<string, DocumentInspectorNotificationRecord[]> {
  const grouped: Record<string, DocumentInspectorNotificationRecord[]> = {};
  for (const row of rows) {
    if (!grouped[row.document_id]) {
      grouped[row.document_id] = [];
    }
    grouped[row.document_id].push(row);
  }
  return grouped;
}

export function getSentNotificationTypes(
  rows: DocumentInspectorNotificationRecord[]
): Set<InspectorNotificationType> {
  return new Set(rows.map((row) => row.notification_type));
}

export async function recordNotificationSent(input: {
  documentId: string;
  notificationType: InspectorNotificationType;
  sentAt?: string;
}): Promise<DocumentInspectorNotificationRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.documentId.trim()) return null;

  const sentAt = input.sentAt ?? new Date().toISOString();
  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE)
    .insert({
      document_id: input.documentId,
      notification_type: input.notificationType,
      sent_at: sentAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return null;
    }
    console.error(
      "[document-inspector-notifications] record failed:",
      error?.message
    );
    return null;
  }

  return mapDocumentInspectorNotificationRow(data);
}

export function getInspectorNotificationSentLabel(
  type: InspectorNotificationType
): string {
  switch (type) {
    case "day_35":
      return "נשלחה התראת 35";
    case "day_40":
      return "נשלחה התראת 40";
    case "day_45_plus":
      return "נשלחה התראת חריגה";
  }
}

export function formatNotificationSentAt(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
