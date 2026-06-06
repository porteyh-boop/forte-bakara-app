import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getOrCreatePilotDeviceId } from "./pilot-device";
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
}

let supabaseClient: SupabaseClient | null | undefined;

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getMasterCode(): string | undefined {
  return process.env.NEXT_PUBLIC_MASTER_CODE;
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

export function isMasterCodeConfigured(): boolean {
  return Boolean(getMasterCode());
}

export function verifyMasterCode(code: string): boolean {
  const expected = getMasterCode();
  if (!expected) return false;
  return code.trim() === expected;
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
  };

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .insert(row)
    .select()
    .single();

  if (error) {
    console.warn("[pilot-cloud] savePilotFault failed:", error.message);
    return null;
  }

  return data as PilotCloudFault;
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

  return (data ?? []) as PilotCloudFault[];
}

export async function getAllPilotFeedback(): Promise<PilotCloudFeedback[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(PILOT_FEEDBACK_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[pilot-cloud] getAllPilotFeedback failed:", error.message);
    return [];
  }

  return (data ?? []) as PilotCloudFeedback[];
}

export async function closePilotFault(id: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client) return false;

  const { error } = await client
    .from(PILOT_FAULTS_TABLE)
    .update({
      status: "סגורה",
      closed_at: new Date().toISOString(),
    })
    .eq("id", id);

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
