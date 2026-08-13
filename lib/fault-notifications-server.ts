import {
  FAULT_NOTIFICATIONS_TABLE,
  type FaultNotificationDispatchInput,
  type FaultNotificationEventType,
  type FaultNotificationRecord,
  mapFaultNotificationRow,
} from "./fault-notifications";
import { getSupabaseServiceClient } from "./supabase-server";

export async function recordFaultNotificationServer(input: {
  faultId: string;
  buildingId: string;
  eventType: FaultNotificationEventType;
  channel?: "telegram";
  recipient?: string | null;
  status: "sent" | "failed";
  error?: string | null;
  sentAt?: string | null;
}): Promise<FaultNotificationRecord | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from(FAULT_NOTIFICATIONS_TABLE)
    .insert({
      fault_id: input.faultId,
      building_id: input.buildingId.trim().toLowerCase(),
      event_type: input.eventType,
      channel: input.channel ?? "telegram",
      recipient: input.recipient ?? null,
      status: input.status,
      error: input.error?.trim() || null,
      sent_at: input.sentAt ?? (input.status === "sent" ? new Date().toISOString() : null),
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[fault-notifications-server] record failed:", error?.message);
    return null;
  }

  return mapFaultNotificationRow(data as Record<string, unknown>);
}

export async function listFaultNotificationsForBuilding(
  buildingId: string
): Promise<{ notifications: FaultNotificationRecord[]; error: string | null }> {
  const normalized = buildingId.trim().toLowerCase();
  if (!normalized) {
    return { notifications: [], error: "invalid_building_id" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { notifications: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(FAULT_NOTIFICATIONS_TABLE)
    .select("*")
    .eq("building_id", normalized)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[fault-notifications-server] list failed:", error.message);
    return { notifications: [], error: error.message };
  }

  const notifications = (data ?? [])
    .map((row) => mapFaultNotificationRow(row as Record<string, unknown>))
    .filter((row): row is FaultNotificationRecord => row !== null);

  return { notifications, error: null };
}

export function parseFaultNotificationDispatchBody(
  body: unknown
): FaultNotificationDispatchInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  const eventType = record.eventType;
  if (typeof eventType !== "string") return null;

  const faultId = typeof record.faultId === "string" ? record.faultId.trim() : "";
  const buildingId =
    typeof record.buildingId === "string" ? record.buildingId.trim() : "";
  const ticketNumber =
    typeof record.ticketNumber === "string" ? record.ticketNumber.trim() : "";
  const buildingName =
    typeof record.buildingName === "string" ? record.buildingName.trim() : "";
  const elevatorName =
    typeof record.elevatorName === "string" ? record.elevatorName.trim() : "";
  const description =
    typeof record.description === "string" ? record.description.trim() : "";

  if (!faultId || !buildingId || !ticketNumber || !buildingName || !elevatorName) {
    return null;
  }

  return {
    faultId,
    buildingId,
    eventType: eventType as FaultNotificationDispatchInput["eventType"],
    ticketNumber,
    buildingName,
    elevatorName,
    faultType:
      typeof record.faultType === "string" ? record.faultType : undefined,
    description,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    faultSource:
      typeof record.faultSource === "string" ? record.faultSource : null,
    isDisabled: Boolean(record.isDisabled),
    hasImage: Boolean(record.hasImage),
    treatmentNote:
      typeof record.treatmentNote === "string" ? record.treatmentNote : null,
    closureNote:
      typeof record.closureNote === "string" ? record.closureNote : null,
    status: typeof record.status === "string" ? record.status : undefined,
  };
}
