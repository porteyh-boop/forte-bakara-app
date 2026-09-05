import {
  LEAD_ID_RE,
  mapSalesLeadNotificationRow,
  SALES_LEAD_NOTIFICATIONS_TABLE,
  type SalesLeadNotificationRecord,
  type SalesLeadNotificationTelegramStatus,
} from "@/lib/sales-lead-notifications";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export async function listSalesLeadNotificationsServer(options?: {
  unreadOnly?: boolean;
}): Promise<{ items: SalesLeadNotificationRecord[]; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { items: [], error: "supabase_service_unconfigured" };
  }

  let query = client
    .from(SALES_LEAD_NOTIFICATIONS_TABLE)
    .select(
      "id, lead_id, submission_key, event_kind, client_name, contact_name, phone, email, building_name, address, city, service_type, need_description, preferred_contact, created_at, read_at, telegram_status, telegram_attempted_at, telegram_error"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (options?.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[sales-lead-notifications] list failed:", error.message);
    return { items: [], error: error.message };
  }

  const items: SalesLeadNotificationRecord[] = [];
  for (const row of data ?? []) {
    const mapped = mapSalesLeadNotificationRow(row as Record<string, unknown>);
    if (mapped) items.push(mapped);
  }
  return { items, error: null };
}

export async function markSalesLeadNotificationReadServer(input: {
  notificationId?: string;
  leadId?: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const notificationId = input.notificationId?.trim();
  const leadId = input.leadId?.trim();
  if (
    (!notificationId || !LEAD_ID_RE.test(notificationId)) &&
    (!leadId || !LEAD_ID_RE.test(leadId))
  ) {
    return { ok: false, error: "invalid_input" };
  }

  const readAt = new Date().toISOString();
  let query = client
    .from(SALES_LEAD_NOTIFICATIONS_TABLE)
    .update({ read_at: readAt })
    .is("read_at", null);

  if (notificationId && LEAD_ID_RE.test(notificationId)) {
    query = query.eq("id", notificationId);
  } else if (leadId && LEAD_ID_RE.test(leadId)) {
    query = query.eq("lead_id", leadId);
  }

  const { data, error } = await query.select("id");
  if (error) {
    console.warn("[sales-lead-notifications] mark read failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: (data?.length ?? 0) > 0, error: null };
}

export async function claimSalesLeadTelegramSendServer(
  notificationId: string
): Promise<{ claimed: boolean; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { claimed: false, error: "supabase_service_unconfigured" };
  }
  if (!LEAD_ID_RE.test(notificationId)) {
    return { claimed: false, error: "invalid_input" };
  }

  const { data, error } = await client
    .from(SALES_LEAD_NOTIFICATIONS_TABLE)
    .update({ telegram_attempted_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("telegram_status", "pending")
    .is("telegram_attempted_at", null)
    .select("id");

  if (error) {
    console.warn("[sales-lead-notifications] telegram claim failed:", error.message);
    return { claimed: false, error: error.message };
  }
  return { claimed: (data?.length ?? 0) > 0, error: null };
}

export async function recordSalesLeadTelegramResultServer(input: {
  notificationId: string;
  status: Exclude<SalesLeadNotificationTelegramStatus, "pending">;
  error?: string | null;
}): Promise<{ claimed: boolean; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { claimed: false, error: "supabase_service_unconfigured" };
  }
  if (!LEAD_ID_RE.test(input.notificationId)) {
    return { claimed: false, error: "invalid_input" };
  }

  const { data, error } = await client
    .from(SALES_LEAD_NOTIFICATIONS_TABLE)
    .update({
      telegram_status: input.status,
      telegram_attempted_at: new Date().toISOString(),
      telegram_error: input.error ?? null,
    })
    .eq("id", input.notificationId)
    .neq("telegram_status", "sent")
    .select("id");

  if (error) {
    console.warn("[sales-lead-notifications] telegram status failed:", error.message);
    return { claimed: false, error: error.message };
  }
  return { claimed: (data?.length ?? 0) > 0, error: null };
}

export async function loadPendingSalesLeadNotificationServer(
  notificationId: string
): Promise<SalesLeadNotificationRecord | null> {
  const client = getSupabaseServiceClient();
  if (!client || !LEAD_ID_RE.test(notificationId)) return null;

  const { data, error } = await client
    .from(SALES_LEAD_NOTIFICATIONS_TABLE)
    .select(
      "id, lead_id, submission_key, event_kind, client_name, contact_name, phone, email, building_name, address, city, service_type, need_description, preferred_contact, created_at, read_at, telegram_status, telegram_attempted_at, telegram_error"
    )
    .eq("id", notificationId)
    .eq("telegram_status", "pending")
    .is("telegram_attempted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return mapSalesLeadNotificationRow(data as Record<string, unknown>);
}
