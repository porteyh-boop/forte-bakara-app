import {
  buildTrialPortalStatusFromSession,
  buildTrialProvisionRpcElevatorsJson,
  buildTrialProvisionResult,
  parseTrialProvisionRpcResult,
  SALES_LEAD_TRIAL_PROVISION_RPC,
  type SalesLeadTrialPortalStatus,
  type SalesLeadTrialProvisionInput,
  type SalesLeadTrialProvisionResult,
} from "@/lib/sales-lead-trial-portal";
import {
  isSyntheticSalesTrialQaLead,
} from "@/lib/sales-lead-trial-portal-feature";
import type { SalesLead } from "@/lib/sales-leads";
import { normalizeBuildingId } from "@/lib/buildings-cloud";
import { getClientUserAccessByIdServer } from "@/lib/master-client-access-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const SALES_LEADS_TABLE = "sales_leads";

/** Suppress owner Telegram only for trial buildings tied to synthetic QA sales leads. */
export async function shouldSuppressOwnerTelegramForSalesTrialQaBuilding(
  buildingId: string
): Promise<boolean> {
  if (!isSupabaseServiceConfigured()) return false;

  const client = getSupabaseServiceClient();
  if (!client) return false;

  const normalized = normalizeBuildingId(buildingId);
  const { data, error } = await client
    .from(SALES_LEADS_TABLE)
    .select("client_name, email, phone")
    .eq("trial_building_id", normalized)
    .maybeSingle();

  if (error || !data) return false;

  const row = data as Record<string, unknown>;
  return isSyntheticSalesTrialQaLead({
    clientName: String(row.client_name ?? ""),
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
  });
}

export async function provisionSalesLeadTrialPortalServer(
  lead: SalesLead,
  input: SalesLeadTrialProvisionInput
): Promise<{
  result: SalesLeadTrialProvisionResult | null;
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { result: null, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { result: null, error: "supabase_service_unconfigured" };
  }

  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return { result: null, error: "invalid_expires_at" };
  }
  if (expiresAt.getTime() <= Date.now()) {
    return { result: null, error: "expires_at_must_be_future" };
  }

  if (!lead.buildingName.trim()) {
    return { result: null, error: "missing_building_name" };
  }

  const { data, error } = await client.rpc(SALES_LEAD_TRIAL_PROVISION_RPC, {
    p_lead_id: lead.id,
    p_expires_at: expiresAt.toISOString(),
    p_elevators: buildTrialProvisionRpcElevatorsJson(input.elevators),
  });

  if (error) {
    console.error("[sales-lead-trial-portal] provision RPC failed", error.message);
    if (error.message.includes("missing_building_name")) {
      return { result: null, error: "missing_building_name" };
    }
    if (error.message.includes("missing_elevators")) {
      return { result: null, error: "missing_elevators" };
    }
    if (error.message.includes("missing_expires_at")) {
      return { result: null, error: "missing_expires_at" };
    }
    if (error.message.includes("not_found")) {
      return { result: null, error: "not_found" };
    }
    if (error.message.includes("invalid_elevator_name")) {
      return { result: null, error: "invalid_elevator_name" };
    }
    if (error.message.includes("invalid_floors_count")) {
      return { result: null, error: "invalid_floors_count" };
    }
    if (error.message.includes("buildings_service_type_check")) {
      return { result: null, error: "invalid_building_service_type" };
    }
    return { result: null, error: "provision_failed" };
  }

  const parsed = parseTrialProvisionRpcResult(data);
  if (!parsed) {
    return { result: null, error: "provision_failed" };
  }

  return {
    result: buildTrialProvisionResult(parsed),
    error: null,
  };
}

export async function loadSalesLeadTrialPortalStatusServer(
  lead: Pick<SalesLead, "trialBuildingId" | "trialClientUserId">
): Promise<SalesLeadTrialPortalStatus> {
  const buildingId = lead.trialBuildingId?.trim() ?? "";
  if (!buildingId) {
    return buildTrialPortalStatusFromSession(lead, null);
  }

  const userId = lead.trialClientUserId?.trim() ?? "";
  if (!userId) {
    return buildTrialPortalStatusFromSession(lead, null);
  }

  const session = await getClientUserAccessByIdServer(userId);
  if (!session) {
    return buildTrialPortalStatusFromSession(lead, null);
  }

  if (session.access.building_id.trim().toLowerCase() !== buildingId.toLowerCase()) {
    return buildTrialPortalStatusFromSession(lead, null);
  }

  return buildTrialPortalStatusFromSession(lead, session);
}
