import { BUILDINGS_TABLE } from "./buildings-cloud";
import {
  MASTER_FAULT_INBOX_TABLE,
  mapMasterFaultInboxRow,
  type MasterFaultInboxItem,
} from "./master-fault-inbox";
import { getSupabaseServiceClient } from "./supabase-server";

export async function listMasterFaultInboxItemsServer(options?: {
  unreadOnly?: boolean;
}): Promise<{ items: MasterFaultInboxItem[]; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { items: [], error: "supabase_service_unconfigured" };
  }

  let query = client
    .from(MASTER_FAULT_INBOX_TABLE)
    .select(
      `
      id,
      fault_id,
      building_id,
      created_at,
      read_at,
      pilot_faults (
        building_name,
        elevator_name,
        fault_type,
        description,
        status,
        ticket_number,
        created_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (options?.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.warn("[master-fault-inbox-server] list failed:", error.message);
    return { items: [], error: error.message };
  }

  const items: MasterFaultInboxItem[] = [];
  const buildingIds = new Set<string>();

  for (const row of data ?? []) {
    const inbox = mapMasterFaultInboxRow(row as Record<string, unknown>);
    if (inbox) buildingIds.add(inbox.building_id.trim().toLowerCase());
  }

  const trialBuildingIds = new Set<string>();
  if (buildingIds.size > 0) {
    const { data: buildingRows } = await client
      .from(BUILDINGS_TABLE)
      .select("building_id, is_trial")
      .in("building_id", Array.from(buildingIds));

    for (const buildingRow of buildingRows ?? []) {
      const id = String(
        (buildingRow as Record<string, unknown>).building_id ?? ""
      )
        .trim()
        .toLowerCase();
      if (
        id &&
        (buildingRow as Record<string, unknown>).is_trial === true
      ) {
        trialBuildingIds.add(id);
      }
    }
  }

  for (const row of data ?? []) {
    const inbox = mapMasterFaultInboxRow(row as Record<string, unknown>);
    if (!inbox) continue;

    const faultRaw = (row as Record<string, unknown>).pilot_faults;
    const fault =
      faultRaw && typeof faultRaw === "object" && !Array.isArray(faultRaw)
        ? (faultRaw as Record<string, unknown>)
        : null;

    if (!fault) continue;

    items.push({
      ...inbox,
      building_name: String(fault.building_name ?? inbox.building_id),
      is_trial_building: trialBuildingIds.has(inbox.building_id.trim().toLowerCase()),
      elevator_name: fault.elevator_name ? String(fault.elevator_name) : null,
      fault_type: String(fault.fault_type ?? ""),
      description: String(fault.description ?? ""),
      status: String(fault.status ?? "פתוחה"),
      ticket_number: fault.ticket_number ? String(fault.ticket_number) : null,
      fault_created_at: String(
        fault.created_at ?? inbox.created_at ?? new Date().toISOString()
      ),
    });
  }

  return { items, error: null };
}

export async function markMasterFaultInboxReadServer(input: {
  inboxId?: string;
  faultId?: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const inboxId = input.inboxId?.trim();
  const faultId = input.faultId?.trim();
  if (!inboxId && !faultId) {
    return { ok: false, error: "invalid_input" };
  }

  const readAt = new Date().toISOString();
  let query = client
    .from(MASTER_FAULT_INBOX_TABLE)
    .update({ read_at: readAt })
    .is("read_at", null);

  if (inboxId) {
    query = query.eq("id", inboxId);
  } else if (faultId) {
    query = query.eq("fault_id", faultId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    console.warn("[master-fault-inbox-server] mark read failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: (data?.length ?? 0) > 0, error: null };
}
