import { getPilotSupabaseClient } from "./pilot-cloud";

export const DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE =
  "document_inspector_notifications";

export const INSPECTOR_LEGACY_NOTIFICATION_TYPES = [
  "day_35",
  "day_40",
  "day_45_plus",
] as const;

export const INSPECTOR_LETTER_NOTIFICATION_TYPES = [
  "letter_1",
  "letter_2",
  "letter_3",
] as const;

export const INSPECTOR_NOTIFICATION_TYPES = [
  ...INSPECTOR_LEGACY_NOTIFICATION_TYPES,
  ...INSPECTOR_LETTER_NOTIFICATION_TYPES,
] as const;

export type InspectorLegacyNotificationType =
  (typeof INSPECTOR_LEGACY_NOTIFICATION_TYPES)[number];

export type InspectorLetterStage =
  (typeof INSPECTOR_LETTER_NOTIFICATION_TYPES)[number];

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

export function isInspectorLegacyNotificationType(
  type: InspectorNotificationType
): type is InspectorLegacyNotificationType {
  return (INSPECTOR_LEGACY_NOTIFICATION_TYPES as readonly string[]).includes(
    type
  );
}

export function isInspectorLetterStage(
  type: InspectorNotificationType
): type is InspectorLetterStage {
  return (INSPECTOR_LETTER_NOTIFICATION_TYPES as readonly string[]).includes(
    type
  );
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

export function getPreparedInspectorLetterStages(
  rows: DocumentInspectorNotificationRecord[]
): Set<InspectorLetterStage> {
  const prepared = new Set<InspectorLetterStage>();
  for (const row of rows) {
    if (isInspectorLetterStage(row.notification_type)) {
      prepared.add(row.notification_type);
    }
  }
  return prepared;
}

export function groupPreparedLetterStagesByDocumentId(
  rows: DocumentInspectorNotificationRecord[]
): Record<string, Set<InspectorLetterStage>> {
  const grouped: Record<string, Set<InspectorLetterStage>> = {};
  for (const row of rows) {
    if (!isInspectorLetterStage(row.notification_type)) continue;
    const current = grouped[row.document_id] ?? new Set<InspectorLetterStage>();
    current.add(row.notification_type);
    grouped[row.document_id] = current;
  }
  return grouped;
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

export async function recordInspectorLetterPrepared(input: {
  documentId: string;
  letterStage: InspectorLetterStage;
  preparedAt?: string;
}): Promise<DocumentInspectorNotificationRecord | null> {
  return recordNotificationSent({
    documentId: input.documentId,
    notificationType: input.letterStage,
    sentAt: input.preparedAt,
  });
}

/** Removes prepared letter evidence so follow-up alerts can reappear for the same stage. */
export async function deleteInspectorLetterPreparedEvidence(input: {
  documentId: string;
  letterStage: InspectorLetterStage;
}): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !input.documentId.trim()) return false;

  const { error } = await client
    .from(DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE)
    .delete()
    .eq("document_id", input.documentId.trim())
    .eq("notification_type", input.letterStage);

  if (error) {
    console.warn(
      "[document-inspector-notifications] delete prepared evidence failed:",
      error.message
    );
    return false;
  }

  return true;
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
    case "letter_1":
      return "מכתב ראשון הוכן";
    case "letter_2":
      return "מכתב שני הוכן";
    case "letter_3":
      return "מכתב שלישי הוכן";
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
