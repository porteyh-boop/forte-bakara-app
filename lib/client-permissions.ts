import { getPilotSupabaseClient } from "./pilot-cloud";

export const CLIENT_PERMISSIONS_TABLE = "client_permissions";
export const CLIENT_ACTIVITY_LOG_TABLE = "client_activity_log";

export type ClientPermissionKey =
  | "can_view_building_dashboard"
  | "can_report_faults"
  | "can_view_open_faults"
  | "can_view_fault_history"
  | "can_view_availability"
  | "can_view_documents"
  | "can_upload_images"
  | "can_receive_notifications"
  | "can_submit_feedback";

export type ClientPermissionFlags = Record<ClientPermissionKey, boolean>;

export interface ClientPermissionRecord extends ClientPermissionFlags {
  id: string;
  client_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClientActivityLogRecord {
  id: string;
  client_user_id: string;
  action_type: string;
  action_details: string | null;
  created_at: string;
}

export interface ClientActivityLogListItem extends ClientActivityLogRecord {
  client_name: string;
}

export const CLIENT_PERMISSION_KEYS: ClientPermissionKey[] = [
  "can_view_building_dashboard",
  "can_report_faults",
  "can_view_open_faults",
  "can_view_fault_history",
  "can_view_availability",
  "can_view_documents",
  "can_upload_images",
  "can_receive_notifications",
  "can_submit_feedback",
];

export const CLIENT_PERMISSION_LABELS: Record<ClientPermissionKey, string> = {
  can_view_building_dashboard: "גישה לפורטל לקוח",
  can_report_faults: "דיווח תקלות",
  can_view_open_faults: "צפייה בתקלות פתוחות",
  can_view_fault_history: "צפייה בהיסטוריית תקלות",
  can_view_availability: "צפייה בזמינות",
  can_view_documents: "צפייה במסמכים",
  can_upload_images: "העלאת תמונות",
  can_receive_notifications: "קבלת התראות",
  can_submit_feedback: "שליחת משוב",
};

export const DEFAULT_CLIENT_PERMISSIONS: ClientPermissionFlags = {
  can_view_building_dashboard: false,
  can_report_faults: false,
  can_view_open_faults: false,
  can_view_fault_history: false,
  can_view_availability: false,
  can_view_documents: false,
  can_upload_images: false,
  can_receive_notifications: false,
  can_submit_feedback: false,
};

export const CLIENT_ACTIVITY_ACTION_LABELS: Record<string, string> = {
  permissions_updated: "עדכון הרשאות",
  permissions_created: "יצירת הרשאות",
  LOGIN: "כניסה לפורטל",
  OPEN_FAULT: "דיווח תקלה",
  VIEW_FAULTS: "צפייה בתקלות",
  VIEW_DOCUMENTS: "צפייה במסמכים",
  VIEW_AVAILABILITY: "צפייה בזמינות",
  SUBMIT_FEEDBACK: "שליחת משוב",
  LOGOUT: "יציאה מהפורטל",
};

function mapPermissionRow(row: Record<string, unknown>): ClientPermissionRecord {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    can_view_building_dashboard: Boolean(row.can_view_building_dashboard),
    can_report_faults: Boolean(row.can_report_faults),
    can_view_open_faults: Boolean(row.can_view_open_faults),
    can_view_fault_history: Boolean(row.can_view_fault_history),
    can_view_availability: Boolean(row.can_view_availability),
    can_view_documents: Boolean(row.can_view_documents),
    can_upload_images: Boolean(row.can_upload_images),
    can_receive_notifications: Boolean(row.can_receive_notifications),
    can_submit_feedback: Boolean(row.can_submit_feedback),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapActivityLogRow(row: Record<string, unknown>): ClientActivityLogRecord {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    action_type: String(row.action_type),
    action_details: row.action_details ? String(row.action_details) : null,
    created_at: String(row.created_at),
  };
}

export function extractClientPermissionFlags(
  record: ClientPermissionRecord | ClientPermissionFlags
): ClientPermissionFlags {
  return {
    can_view_building_dashboard: record.can_view_building_dashboard,
    can_report_faults: record.can_report_faults,
    can_view_open_faults: record.can_view_open_faults,
    can_view_fault_history: record.can_view_fault_history,
    can_view_availability: record.can_view_availability,
    can_view_documents: record.can_view_documents,
    can_upload_images: record.can_upload_images,
    can_receive_notifications: record.can_receive_notifications,
    can_submit_feedback: record.can_submit_feedback,
  };
}

export function formatClientActivityAction(actionType: string): string {
  return CLIENT_ACTIVITY_ACTION_LABELS[actionType] ?? actionType;
}

export function formatClientActivityDetails(details: string | null): string {
  if (!details?.trim()) return "—";
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>;
    const parts = CLIENT_PERMISSION_KEYS.filter((key) => key in parsed).map(
      (key) => `${CLIENT_PERMISSION_LABELS[key]}: ${parsed[key] ? "כן" : "לא"}`
    );
    return parts.length > 0 ? parts.join(" · ") : details;
  } catch {
    return details;
  }
}

export function formatClientActivityDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export async function getClientPermissions(
  clientUserId: string
): Promise<ClientPermissionRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !clientUserId.trim()) return null;

  const { data, error } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .select("*")
    .eq("client_user_id", clientUserId)
    .maybeSingle();

  if (error) {
    console.error("[client-permissions] get failed", {
      table: CLIENT_PERMISSIONS_TABLE,
      clientUserId,
      supabaseError: error,
    });
    return null;
  }

  return data ? mapPermissionRow(data) : null;
}

export async function getClientPermissionsOrDefaults(
  clientUserId: string
): Promise<ClientPermissionFlags> {
  const record = await getClientPermissions(clientUserId);
  return record ? extractClientPermissionFlags(record) : { ...DEFAULT_CLIENT_PERMISSIONS };
}

export async function logClientActivity(
  clientUserId: string,
  actionType: string,
  actionDetails?: string | null
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !clientUserId.trim() || !actionType.trim()) return false;

  const { error } = await client.from(CLIENT_ACTIVITY_LOG_TABLE).insert({
    client_user_id: clientUserId,
    action_type: actionType.trim(),
    action_details: actionDetails ?? null,
  });

  if (error) {
    console.error("[client-permissions] activity log failed", {
      table: CLIENT_ACTIVITY_LOG_TABLE,
      clientUserId,
      actionType,
      supabaseError: error,
    });
    return false;
  }

  return true;
}

export async function saveClientPermissions(
  clientUserId: string,
  flags: ClientPermissionFlags
): Promise<ClientPermissionRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !clientUserId.trim()) return null;

  const existing = await getClientPermissions(clientUserId);
  const now = new Date().toISOString();
  const payload = {
    client_user_id: clientUserId,
    ...flags,
    updated_at: now,
  };

  const { data, error } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .upsert(payload, { onConflict: "client_user_id" })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[client-permissions] save failed", {
      table: CLIENT_PERMISSIONS_TABLE,
      fields: payload,
      supabaseError: error,
    });
    return null;
  }

  await logClientActivity(
    clientUserId,
    existing ? "permissions_updated" : "permissions_created",
    JSON.stringify(flags)
  );

  return mapPermissionRow(data);
}

export async function getAllClientActivityLogs(): Promise<ClientActivityLogListItem[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data: logs, error: logsError } = await client
    .from(CLIENT_ACTIVITY_LOG_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (logsError || !logs) {
    console.error("[client-permissions] list activity failed", {
      table: CLIENT_ACTIVITY_LOG_TABLE,
      supabaseError: logsError,
    });
    return [];
  }

  const { data: users, error: usersError } = await client
    .from("client_users")
    .select("id, name");

  if (usersError) {
    console.error("[client-permissions] list users for activity failed", {
      supabaseError: usersError,
    });
  }

  const nameByUserId = new Map<string, string>();
  for (const user of users ?? []) {
    nameByUserId.set(String(user.id), String(user.name));
  }

  return logs.map((row) => {
    const entry = mapActivityLogRow(row);
    return {
      ...entry,
      client_name: nameByUserId.get(entry.client_user_id) ?? "—",
    };
  });
}
