import {
  getPilotSupabaseClient,
  resetPilotCloudDataByBuilding,
} from "./pilot-cloud";
import type { PilotCloudFault } from "./pilot-cloud";
import type { Status } from "./types";

export const BUILDINGS_TABLE = "buildings";
export const ELEVATORS_TABLE = "elevators";

export const ELEVATOR_STATUS_OPTIONS = ["פעילה", "בטיפול", "מושבתת"] as const;
export type ElevatorStatusOption = (typeof ELEVATOR_STATUS_OPTIONS)[number];

export interface CloudBuildingRow {
  id: string;
  building_id: string;
  name: string;
  city: string | null;
  address: string | null;
  management_company: string | null;
  elevator_company: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  floors_count: number | null;
  is_active: boolean;
  created_at: string;
  live_started_at?: string | null;
}

export interface CloudElevatorRow {
  id: string;
  building_id: string;
  elevator_id: string;
  elevator_name: string;
  floors_count: number | null;
  elevator_type: string | null;
  is_active: boolean;
  status: string;
  created_at: string;
}

export interface SaveBuildingInput {
  buildingId: string;
  name: string;
  city?: string;
  address?: string;
  managementCompany?: string;
  elevatorCompany?: string;
  contactName?: string;
  contactPhone?: string;
  floorsCount?: number | null;
  isActive?: boolean;
}

export interface SaveElevatorInput {
  buildingId: string;
  elevatorId: string;
  elevatorName: string;
  floorsCount?: number | null;
  elevatorType?: string;
  isActive?: boolean;
  status?: ElevatorStatusOption;
}

export interface DeleteGuardResult {
  allowed: boolean;
  reason?: string;
}

export function normalizeBuildingId(value: string): string {
  return value.trim().toLowerCase();
}

export function canDeleteBuilding(
  buildingId: string,
  faults: Pick<PilotCloudFault, "building_id">[]
): DeleteGuardResult {
  const hasFaults = faults.some((f) => f.building_id === buildingId);
  if (hasFaults) {
    return {
      allowed: false,
      reason: "לא ניתן למחוק בניין שיש עליו דיווחי תקלות.",
    };
  }
  return { allowed: true };
}

export function canDeleteElevator(
  buildingId: string,
  elevatorId: string,
  faults: Pick<PilotCloudFault, "building_id" | "elevator_id">[]
): DeleteGuardResult {
  const hasFaults = faults.some(
    (f) => f.building_id === buildingId && f.elevator_id === elevatorId
  );
  if (hasFaults) {
    return {
      allowed: false,
      reason: "לא ניתן למחוק מעלית שיש עליה דיווחי תקלות.",
    };
  }
  return { allowed: true };
}

export function mapElevatorStatus(status: string): Status {
  if (status === "בטיפול" || status === "מושבתת") return status;
  return "פעילה";
}

export async function getAllCloudBuildings(): Promise<CloudBuildingRow[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.warn("[buildings-cloud] getAllCloudBuildings failed:", error.message);
    return [];
  }

  return (data ?? []) as CloudBuildingRow[];
}

export async function getAllCloudElevators(): Promise<CloudElevatorRow[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(ELEVATORS_TABLE)
    .select("*")
    .order("elevator_name", { ascending: true });

  if (error) {
    console.warn("[buildings-cloud] getAllCloudElevators failed:", error.message);
    return [];
  }

  return (data ?? []) as CloudElevatorRow[];
}

export async function getCloudElevatorsByBuilding(
  buildingId: string
): Promise<CloudElevatorRow[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(ELEVATORS_TABLE)
    .select("*")
    .eq("building_id", buildingId)
    .order("elevator_name", { ascending: true });

  if (error) {
    console.warn("[buildings-cloud] getCloudElevatorsByBuilding failed:", error.message);
    return [];
  }

  return (data ?? []) as CloudElevatorRow[];
}

export async function createCloudBuilding(
  input: SaveBuildingInput
): Promise<CloudBuildingRow | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const buildingId = normalizeBuildingId(input.buildingId);
  if (!buildingId || !input.name.trim()) return null;

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .insert({
      building_id: buildingId,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      management_company: input.managementCompany?.trim() || null,
      elevator_company: input.elevatorCompany?.trim() || null,
      contact_name: input.contactName?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      floors_count: input.floorsCount ?? null,
      is_active: input.isActive ?? true,
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[buildings-cloud] createCloudBuilding failed:", error.message);
    return null;
  }

  return data as CloudBuildingRow;
}

export async function updateCloudBuilding(
  rowId: string,
  input: Partial<SaveBuildingInput>
): Promise<CloudBuildingRow | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.city !== undefined) patch.city = input.city.trim() || null;
  if (input.address !== undefined) patch.address = input.address.trim() || null;
  if (input.managementCompany !== undefined) {
    patch.management_company = input.managementCompany.trim() || null;
  }
  if (input.elevatorCompany !== undefined) {
    patch.elevator_company = input.elevatorCompany.trim() || null;
  }
  if (input.contactName !== undefined) {
    patch.contact_name = input.contactName.trim() || null;
  }
  if (input.contactPhone !== undefined) {
    patch.contact_phone = input.contactPhone.trim() || null;
  }
  if (input.floorsCount !== undefined) patch.floors_count = input.floorsCount;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .update(patch)
    .eq("id", rowId)
    .select("*")
    .single();

  if (error) {
    console.warn("[buildings-cloud] updateCloudBuilding failed:", error.message);
    return null;
  }

  return data as CloudBuildingRow;
}

export async function setCloudBuildingActive(
  rowId: string,
  isActive: boolean
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(BUILDINGS_TABLE)
    .update({ is_active: isActive })
    .eq("id", rowId);

  if (error) {
    console.warn("[buildings-cloud] setCloudBuildingActive failed:", error.message);
    return false;
  }

  return true;
}

export async function deleteCloudBuilding(
  rowId: string,
  buildingId: string,
  faults: Pick<PilotCloudFault, "building_id">[]
): Promise<DeleteGuardResult & { deleted?: boolean }> {
  const guard = canDeleteBuilding(buildingId, faults);
  if (!guard.allowed) return guard;

  const client = getPilotSupabaseClient();
  if (!client) return { allowed: false, reason: "Supabase לא מחובר." };

  const { error: elevError } = await client
    .from(ELEVATORS_TABLE)
    .delete()
    .eq("building_id", buildingId);

  if (elevError) {
    console.warn("[buildings-cloud] delete elevators failed:", elevError.message);
    return { allowed: false, reason: "מחיקת מעליות נכשלה." };
  }

  const { error } = await client.from(BUILDINGS_TABLE).delete().eq("id", rowId);

  if (error) {
    console.warn("[buildings-cloud] deleteCloudBuilding failed:", error.message);
    return { allowed: false, reason: "מחיקת בניין נכשלה." };
  }

  return { allowed: true, deleted: true };
}

export async function createCloudElevator(
  input: SaveElevatorInput
): Promise<CloudElevatorRow | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const elevatorId = input.elevatorId.trim();
  if (!elevatorId || !input.elevatorName.trim() || !input.buildingId) return null;

  const { data, error } = await client
    .from(ELEVATORS_TABLE)
    .insert({
      building_id: input.buildingId,
      elevator_id: elevatorId,
      elevator_name: input.elevatorName.trim(),
      floors_count: input.floorsCount ?? null,
      elevator_type: input.elevatorType?.trim() || null,
      is_active: input.isActive ?? true,
      status: input.status ?? "פעילה",
    })
    .select("*")
    .single();

  if (error) {
    console.warn("[buildings-cloud] createCloudElevator failed:", error.message);
    return null;
  }

  return data as CloudElevatorRow;
}

export async function updateCloudElevator(
  rowId: string,
  input: Partial<SaveElevatorInput>
): Promise<CloudElevatorRow | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const patch: Record<string, unknown> = {};
  if (input.elevatorName !== undefined) {
    patch.elevator_name = input.elevatorName.trim();
  }
  if (input.floorsCount !== undefined) patch.floors_count = input.floorsCount;
  if (input.elevatorType !== undefined) {
    patch.elevator_type = input.elevatorType.trim() || null;
  }
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await client
    .from(ELEVATORS_TABLE)
    .update(patch)
    .eq("id", rowId)
    .select("*")
    .single();

  if (error) {
    console.warn("[buildings-cloud] updateCloudElevator failed:", error.message);
    return null;
  }

  return data as CloudElevatorRow;
}

export async function setCloudElevatorActive(
  rowId: string,
  isActive: boolean
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(ELEVATORS_TABLE)
    .update({ is_active: isActive })
    .eq("id", rowId);

  if (error) {
    console.warn("[buildings-cloud] setCloudElevatorActive failed:", error.message);
    return false;
  }

  return true;
}

export async function deleteCloudElevator(
  rowId: string,
  buildingId: string,
  elevatorId: string,
  faults: Pick<PilotCloudFault, "building_id" | "elevator_id">[]
): Promise<DeleteGuardResult & { deleted?: boolean }> {
  const guard = canDeleteElevator(buildingId, elevatorId, faults);
  if (!guard.allowed) return guard;

  const client = getPilotSupabaseClient();
  if (!client) return { allowed: false, reason: "Supabase לא מחובר." };

  const { error } = await client.from(ELEVATORS_TABLE).delete().eq("id", rowId);

  if (error) {
    console.warn("[buildings-cloud] deleteCloudElevator failed:", error.message);
    return { allowed: false, reason: "מחיקת מעלית נכשלה." };
  }

  return { allowed: true, deleted: true };
}

export async function getBuildingLiveStartedAt(
  buildingId: string
): Promise<string | null> {
  const client = getPilotSupabaseClient();
  if (!client || !buildingId.trim()) return null;

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .select("live_started_at")
    .eq("building_id", buildingId)
    .maybeSingle();

  if (error) {
    console.warn(
      "[buildings-cloud] getBuildingLiveStartedAt failed:",
      error.message
    );
    return null;
  }

  return data?.live_started_at ? String(data.live_started_at) : null;
}

export const INITIALIZE_BUILDING_FOR_LIVE_CONFIRM =
  "פעולה זו תאפס את נתוני הבניין ותתחיל שימוש אמיתי מאפס.";

export async function initializeBuildingForLiveUse(params: {
  buildingId: string;
  buildingName: string;
}): Promise<{ ok: boolean; liveStartedAt?: string; reason?: string }> {
  const client = getPilotSupabaseClient();
  if (!client) {
    return { ok: false, reason: "Supabase לא מחובר." };
  }

  const buildingId = normalizeBuildingId(params.buildingId);
  const buildingName = params.buildingName.trim();
  if (!buildingId || !buildingName) {
    return { ok: false, reason: "מזהה או שם בניין חסר." };
  }

  const resetOk = await resetPilotCloudDataByBuilding(buildingId);
  if (!resetOk) {
    return { ok: false, reason: "מחיקת דיווחים ומשובים מהענן נכשלה." };
  }

  const liveStartedAt = new Date().toISOString();

  const { data: existing, error: existingError } = await client
    .from(BUILDINGS_TABLE)
    .select("id")
    .eq("building_id", buildingId)
    .maybeSingle();

  if (existingError) {
    console.warn(
      "[buildings-cloud] initialize lookup failed:",
      existingError.message
    );
    return { ok: false, reason: existingError.message };
  }

  if (existing) {
    const { error } = await client
      .from(BUILDINGS_TABLE)
      .update({ live_started_at: liveStartedAt })
      .eq("building_id", buildingId);

    if (error) {
      console.warn(
        "[buildings-cloud] initialize update failed:",
        error.message
      );
      return { ok: false, reason: error.message };
    }
  } else {
    const { error } = await client.from(BUILDINGS_TABLE).insert({
      building_id: buildingId,
      name: buildingName,
      live_started_at: liveStartedAt,
      is_active: true,
    });

    if (error) {
      console.warn(
        "[buildings-cloud] initialize insert failed:",
        error.message
      );
      return { ok: false, reason: error.message };
    }
  }

  return { ok: true, liveStartedAt };
}
