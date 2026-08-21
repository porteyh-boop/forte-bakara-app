import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOrCreatePilotDeviceId } from "./pilot-device";
import {
  dispatchFaultNotification,
  pilotFaultToNotificationInput,
} from "./fault-notification-client";
import type { Fault } from "./types";
import type { FeedbackSubmissionInput } from "./types";

export const PILOT_FAULTS_TABLE = "pilot_faults";
export const PILOT_FEEDBACK_TABLE = "pilot_feedback";
export const MASTER_AUTH_SESSION_KEY = "forte-master-authenticated";

export interface PilotCloudFault {
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
  image_data: string | null;
  image_url: string | null;
  created_at: string;
  closed_at: string | null;
  source_device_id: string | null;
  fault_source: string | null;
  treatment_note: string | null;
  closure_note: string | null;
  treatment_started_at: string | null;
}

export function mapPilotFaultRow(row: Record<string, unknown>): PilotCloudFault {
  return {
    id: String(row.id),
    building_id: String(row.building_id ?? ""),
    building_name: String(row.building_name ?? ""),
    elevator_id: String(row.elevator_id ?? ""),
    elevator_name: String(row.elevator_name ?? ""),
    fault_type: String(row.fault_type ?? ""),
    description: String(row.description ?? ""),
    is_disabled: Boolean(row.is_disabled),
    status: String(row.status ?? "פתוחה"),
    ticket_number: row.ticket_number ? String(row.ticket_number) : null,
    image_data: row.image_data ? String(row.image_data) : null,
    image_url: row.image_url ? String(row.image_url) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    closed_at: row.closed_at ? String(row.closed_at) : null,
    source_device_id: row.source_device_id ? String(row.source_device_id) : null,
    fault_source: row.fault_source ? String(row.fault_source) : null,
    treatment_note: row.treatment_note ? String(row.treatment_note) : null,
    closure_note: row.closure_note ? String(row.closure_note) : null,
    treatment_started_at: row.treatment_started_at
      ? String(row.treatment_started_at)
      : null,
  };
}

export interface PilotCloudFeedback {
  id: string;
  building_id: string;
  building_name: string;
  sender_name: string;
  sender_role: string;
  rating: number;
  would_use_regularly: string;
  unclear_or_missing: string;
  expected_feature: string;
  would_recommend: string;
  created_at: string;
  source_device_id: string | null;
}

export interface SavePilotFaultInput {
  buildingId: string;
  buildingName: string;
  elevatorId: string;
  elevatorName: string;
  faultType: string;
  description: string;
  isDisabled: boolean;
  status: string;
  ticketNumber?: string;
  imageData?: string | null;
  imageUrl?: string | null;
  faultSource?: string | null;
}

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function isPilotCloudConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

/** לוג זמני לדיבוג — לא מדפיס ערכי מפתחות */
export function logPilotCloudConfigDebug(): void {
  const hasUrl = Boolean(getSupabaseUrl());
  const hasKey = Boolean(getSupabaseAnonKey());
  const configured = isPilotCloudConfigured();
  console.log("[forte-pilot-cloud-debug]", {
    NEXT_PUBLIC_SUPABASE_URL: hasUrl ? "קיים" : "חסר",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hasKey ? "קיים" : "חסר",
    isPilotCloudConfigured: configured,
  });
}

/** לוג זמני — מספר משובים מ-Supabase */
export function logPilotFeedbackLoadDebug(
  count: number,
  errorMessage?: string
): void {
  console.log("[forte-pilot-feedback-debug]", {
    pilotFeedbackCount: count,
    loadError: errorMessage ?? null,
  });
}

export function mapPilotFeedbackRow(
  row: Record<string, unknown>
): PilotCloudFeedback | null {
  if (!row.id || !row.building_id) return null;

  return {
    id: String(row.id),
    building_id: String(row.building_id),
    building_name: String(row.building_name ?? ""),
    sender_name: String(row.sender_name ?? ""),
    sender_role: String(row.sender_role ?? ""),
    rating: Number(row.rating) || 0,
    would_use_regularly: String(row.would_use_regularly ?? ""),
    unclear_or_missing: String(row.unclear_or_missing ?? ""),
    expected_feature: String(row.expected_feature ?? ""),
    would_recommend: String(row.would_recommend ?? ""),
    created_at: String(row.created_at ?? new Date().toISOString()),
    source_device_id: row.source_device_id
      ? String(row.source_device_id)
      : null,
  };
}

export function getPilotSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) return supabaseClient;
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    supabaseClient = null;
    return null;
  }
  supabaseClient = createClient(url, key);
  return supabaseClient;
}

export function isMasterAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(MASTER_AUTH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMasterAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      sessionStorage.setItem(MASTER_AUTH_SESSION_KEY, "1");
    } else {
      sessionStorage.removeItem(MASTER_AUTH_SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
}

export async function savePilotFault(
  input: SavePilotFaultInput
): Promise<PilotCloudFault | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const row = {
    building_id: input.buildingId,
    building_name: input.buildingName,
    elevator_id: input.elevatorId,
    elevator_name: input.elevatorName,
    fault_type: input.faultType,
    description: input.description.trim(),
    is_disabled: input.isDisabled,
    status: input.status,
    ticket_number: input.ticketNumber ?? null,
    image_data: input.imageData ?? null,
    image_url: input.imageUrl ?? null,
    source_device_id: getOrCreatePilotDeviceId(),
    fault_source: input.faultSource ?? null,
  };

  console.log("[TRACE] before insert");

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .insert(row)
    .select()
    .single();

  console.log("[TRACE] insert result", {
    error: error?.message ?? null,
    "data.id": data?.id ?? null,
    ticket_number: data?.ticket_number ?? null,
  });

  if (error) {
    console.warn("[pilot-cloud] savePilotFault failed:", error.message);
    return null;
  }

  console.log("[TRACE] before dispatchFaultNotification");

  const mapped = mapPilotFaultRow(data as Record<string, unknown>);
  dispatchFaultNotification(
    pilotFaultToNotificationInput(mapped, "FAULT_CREATED")
  );

  return mapped;
}

export function savePilotFaultFromLocalFault(
  fault: Fault,
  buildingId: string,
  buildingName: string
): void {
  void savePilotFault({
    buildingId,
    buildingName,
    elevatorId: fault.elevatorId,
    elevatorName: fault.elevatorName,
    faultType: fault.type,
    description: fault.description,
    isDisabled: Boolean(fault.isDisabled),
    status: fault.status,
    ticketNumber: fault.ticketNumber,
    imageData: fault.image?.dataUrl ?? null,
  });
}

export async function savePilotFeedback(
  input: FeedbackSubmissionInput,
  buildingId: string,
  buildingName: string
): Promise<PilotCloudFeedback | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const row = {
    building_id: buildingId,
    building_name: buildingName,
    sender_name: input.senderName.trim(),
    sender_role: input.senderRole,
    rating: input.rating,
    would_use_regularly: input.wouldUseRegularly,
    unclear_or_missing: input.unclearOrMissing.trim(),
    expected_feature: input.expectedFeature.trim(),
    would_recommend: input.wouldRecommend,
    source_device_id: getOrCreatePilotDeviceId(),
  };

  const { data, error } = await client
    .from(PILOT_FEEDBACK_TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    console.warn("[pilot-cloud] savePilotFeedback failed:", error.message);
    return null;
  }

  return data as PilotCloudFeedback;
}

export async function getAllPilotFaults(): Promise<PilotCloudFault[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[pilot-cloud] getAllPilotFaults failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) =>
    mapPilotFaultRow(row as Record<string, unknown>)
  );
}

/** null = שגיאת רשת/ענן — יש לשמור על localStorage */
export async function getPilotFaultsForBuilding(
  buildingId: string
): Promise<PilotCloudFault[] | null> {
  const client = getPilotSupabaseClient();
  if (!client || !buildingId.trim()) return [];

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("*")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn(
      "[pilot-cloud] getPilotFaultsForBuilding failed:",
      error.message
    );
    return null;
  }

  return (data ?? []).map((row) =>
    mapPilotFaultRow(row as Record<string, unknown>)
  );
}

export async function getAllPilotFeedback(): Promise<PilotCloudFeedback[]> {
  const client = getPilotSupabaseClient();
  if (!client) {
    logPilotFeedbackLoadDebug(0, "Supabase client unavailable");
    return [];
  }

  const { data, error } = await client
    .from(PILOT_FEEDBACK_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[pilot-cloud] getAllPilotFeedback failed:", error.message);
    logPilotFeedbackLoadDebug(0, error.message);
    return [];
  }

  const mapped = (data ?? [])
    .map((row) => mapPilotFeedbackRow(row as Record<string, unknown>))
    .filter((row): row is PilotCloudFeedback => row !== null);

  logPilotFeedbackLoadDebug(mapped.length);
  return mapped;
}

export async function startPilotFaultTreatment(
  id: string,
  options?: { treatmentNote?: string | null }
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const payload: Record<string, unknown> = {
    status: "בטיפול",
    treatment_started_at: new Date().toISOString(),
  };

  if (options && "treatmentNote" in options) {
    payload.treatment_note = options.treatmentNote?.trim() || null;
  }

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update(payload)
    .eq("id", id);

  if (error) {
    console.warn("[pilot-cloud] startPilotFaultTreatment failed:", error.message);
    return false;
  }
  return true;
}

export async function updatePilotFaultTreatmentNote(
  id: string,
  treatmentNote: string
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update({ treatment_note: treatmentNote.trim() || null })
    .eq("id", id);

  if (error) {
    console.warn(
      "[pilot-cloud] updatePilotFaultTreatmentNote failed:",
      error.message
    );
    return false;
  }
  return true;
}

export async function closePilotFault(
  id: string,
  options?: { closureNote?: string | null }
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const payload: Record<string, unknown> = {
    status: "סגורה",
    closed_at: new Date().toISOString(),
  };

  if (options?.closureNote !== undefined) {
    payload.closure_note = options.closureNote?.trim() || null;
  }

  const { error } = await client.from(PILOT_FAULTS_TABLE).update(payload).eq("id", id);

  if (error) {
    console.warn("[pilot-cloud] closePilotFault failed:", error.message);
    return false;
  }
  return true;
}

export async function reopenPilotFault(id: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update({
      status: "פתוחה",
      closed_at: null,
    })
    .eq("id", id);

  if (error) {
    console.warn("[pilot-cloud] reopenPilotFault failed:", error.message);
    return false;
  }
  return true;
}

export async function closePilotFaultByTicket(
  ticketNumber: string | undefined,
  buildingId: string
): Promise<void> {
  if (!ticketNumber || !isPilotCloudConfigured()) return;
  const faults = await getAllPilotFaults();
  const match = faults.find(
    (f) => f.ticket_number === ticketNumber && f.building_id === buildingId
  );
  if (match) await closePilotFault(match.id);
}

export async function deletePilotFault(id: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client.from(PILOT_FAULTS_TABLE).delete().eq("id", id);

  if (error) {
    console.warn("[pilot-cloud] deletePilotFault failed:", error.message);
    return false;
  }
  return true;
}

export async function resetPilotCloudData(): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error: faultsError } = await client
    .from(PILOT_FAULTS_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (faultsError) {
    console.warn("[pilot-cloud] reset faults failed:", faultsError.message);
    return false;
  }

  const { error: feedbackError } = await client
    .from(PILOT_FEEDBACK_TABLE)
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (feedbackError) {
    console.warn("[pilot-cloud] reset feedback failed:", feedbackError.message);
    return false;
  }

  return true;
}

export async function resetPilotCloudDataByBuilding(
  buildingId: string
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !buildingId.trim()) return false;

  const { error: faultsError } = await client
    .from(PILOT_FAULTS_TABLE)
    .delete()
    .eq("building_id", buildingId);

  if (faultsError) {
    console.warn(
      "[pilot-cloud] reset faults by building failed:",
      faultsError.message
    );
    return false;
  }

  const { error: feedbackError } = await client
    .from(PILOT_FEEDBACK_TABLE)
    .delete()
    .eq("building_id", buildingId);

  if (feedbackError) {
    console.warn(
      "[pilot-cloud] reset feedback by building failed:",
      feedbackError.message
    );
    return false;
  }

  return true;
}
