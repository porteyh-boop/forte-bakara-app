import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  mapPilotFaultRow,
  PILOT_FAULTS_TABLE,
} from "@/lib/pilot-cloud";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const BUILDING_FORBIDDEN_ERROR = "building_forbidden";

const FAULT_LIST_COLUMNS =
  "id, building_id, building_name, elevator_id, elevator_name, fault_type, description, is_disabled, status, ticket_number, image_url, image_data, created_at, closed_at, fault_source, treatment_note, closure_note, treatment_started_at";

export interface MasterFaultDto {
  id: string;
  building_id: string;
  building_name: string;
  elevator_id: string;
  elevator_name: string;
  fault_type: string;
  description: string;
  is_disabled: boolean;
  status: string;
  ticket_number: string | null;
  image_url: string | null;
  image_data: string | null;
  created_at: string;
  closed_at: string | null;
  fault_source: string | null;
  treatment_note: string | null;
  closure_note: string | null;
  treatment_started_at: string | null;
}

type FaultBuildingVerifyResult =
  | { ok: true; buildingId: string }
  | {
      ok: false;
      error: "not_found" | typeof BUILDING_FORBIDDEN_ERROR | "invalid_input";
    };

export function parseFaultId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function mapMasterFaultDto(row: Record<string, unknown>): MasterFaultDto {
  const mapped = mapPilotFaultRow(row);
  const imageUrl = mapped.image_url?.trim() || null;
  const imageData = mapped.image_data?.trim() || null;

  return {
    id: mapped.id,
    building_id: mapped.building_id,
    building_name: mapped.building_name,
    elevator_id: mapped.elevator_id,
    elevator_name: mapped.elevator_name,
    fault_type: mapped.fault_type,
    description: mapped.description,
    is_disabled: mapped.is_disabled,
    status: mapped.status,
    ticket_number: mapped.ticket_number,
    image_url: imageUrl,
    image_data: imageUrl ? null : imageData,
    created_at: mapped.created_at,
    closed_at: mapped.closed_at,
    fault_source: mapped.fault_source,
    treatment_note: mapped.treatment_note,
    closure_note: mapped.closure_note,
    treatment_started_at: mapped.treatment_started_at,
  };
}

async function verifyFaultBuildingServer(
  faultId: string,
  expectedBuildingId: string
): Promise<FaultBuildingVerifyResult> {
  const trimmedId = faultId.trim();
  const expected = expectedBuildingId.trim().toLowerCase();
  if (!trimmedId || !expected) {
    return { ok: false, error: "invalid_input" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "invalid_input" };
  }

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("building_id")
    .eq("id", trimmedId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "not_found" };
  }

  const actual = String((data as Record<string, unknown>).building_id ?? "")
    .trim()
    .toLowerCase();
  if (actual !== expected) {
    return { ok: false, error: BUILDING_FORBIDDEN_ERROR };
  }

  return { ok: true, buildingId: actual };
}

export async function listMasterFaultsByBuildingServer(
  buildingId: string
): Promise<{ faults: MasterFaultDto[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { faults: [], error: "supabase_service_unconfigured" };
  }

  const normalized = parseBuildingIdFilter(buildingId);
  if (!normalized) {
    return { faults: [], error: "invalid_building_id" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { faults: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select(FAULT_LIST_COLUMNS)
    .eq("building_id", normalized)
    .order("created_at", { ascending: false });

  if (error) {
    return { faults: [], error: error.message };
  }

  return {
    faults: (data ?? []).map((row) =>
      mapMasterFaultDto(row as Record<string, unknown>)
    ),
    error: null,
  };
}

export async function startMasterFaultTreatmentServer(
  faultId: string,
  buildingId: string,
  treatmentNote?: string | null
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyFaultBuildingServer(faultId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const payload: Record<string, unknown> = {
    status: "בטיפול",
    treatment_started_at: new Date().toISOString(),
  };
  if (treatmentNote !== undefined) {
    payload.treatment_note = treatmentNote?.trim() || null;
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update(payload)
    .eq("id", faultId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function updateMasterFaultTreatmentNoteServer(
  faultId: string,
  buildingId: string,
  treatmentNote: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyFaultBuildingServer(faultId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update({ treatment_note: treatmentNote.trim() || null })
    .eq("id", faultId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function closeMasterFaultServer(
  faultId: string,
  buildingId: string,
  closureNote?: string | null
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyFaultBuildingServer(faultId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const payload: Record<string, unknown> = {
    status: "סגורה",
    closed_at: new Date().toISOString(),
  };
  if (closureNote !== undefined) {
    payload.closure_note = closureNote?.trim() || null;
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update(payload)
    .eq("id", faultId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function reopenMasterFaultServer(
  faultId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyFaultBuildingServer(faultId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update({
      status: "פתוחה",
      closed_at: null,
    })
    .eq("id", faultId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function deleteMasterFaultServer(
  faultId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyFaultBuildingServer(faultId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .delete()
    .eq("id", faultId.trim());

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
