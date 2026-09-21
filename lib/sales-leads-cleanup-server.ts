import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import type { SalesLeadStatus } from "@/lib/sales-leads";
import { SALES_LEADS_TABLE, parseSalesLeadId } from "@/lib/sales-leads-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export type SalesLeadCleanupError =
  | "supabase_service_unconfigured"
  | "invalid_lead_id"
  | "not_found"
  | "lead_protected"
  | "save_failed"
  | "invalid_input";

export type SalesLeadCleanupOptions = {
  closedNotWon: boolean;
  newUnconverted: boolean;
  staleInactive: boolean;
};

const STALE_INACTIVE_DAYS = 90;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export type SalesLeadProtection = {
  deletable: boolean;
  reason: SalesLeadCleanupError | null;
};

export function assessSalesLeadProtection(row: Record<string, unknown>): SalesLeadProtection {
  const status = asString(row.status) as SalesLeadStatus;
  const converted = asString(row.converted_building_id).trim();
  const trialBuilding = asString(row.trial_building_id).trim();
  const trialUser = asString(row.trial_client_user_id).trim();

  if (converted || status === "זכייה") {
    return { deletable: false, reason: "lead_protected" };
  }
  if (trialBuilding || trialUser) {
    return { deletable: false, reason: "lead_protected" };
  }
  return { deletable: true, reason: null };
}

function isStaleInactive(row: Record<string, unknown>): boolean {
  const updated = asString(row.updated_at);
  if (!updated) return false;
  const ms = Date.now() - new Date(updated).getTime();
  return ms >= STALE_INACTIVE_DAYS * 24 * 60 * 60 * 1000;
}

function matchesCleanupOption(
  row: Record<string, unknown>,
  options: SalesLeadCleanupOptions
): boolean {
  const status = asString(row.status);
  const protection = assessSalesLeadProtection(row);
  if (!protection.deletable) return false;

  if (options.closedNotWon && status === "לא נסגר") return true;

  if (options.newUnconverted && status === "חדש") return true;

  if (options.staleInactive && isStaleInactive(row)) return true;

  return false;
}

async function loadLeadRow(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  leadId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await sb
    .from(SALES_LEADS_TABLE)
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  return data ? (data as Record<string, unknown>) : null;
}

export async function deleteSalesLeadServer(leadIdRaw: string): Promise<{
  deleted: boolean;
  error: SalesLeadCleanupError | null;
}> {
  const leadId = parseSalesLeadId(leadIdRaw);
  if (!leadId) return { deleted: false, error: "invalid_lead_id" };

  if (!isSupabaseServiceConfigured()) {
    return { deleted: false, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: false, error: "supabase_service_unconfigured" };

  const row = await loadLeadRow(sb, leadId);
  if (!row) return { deleted: false, error: "not_found" };

  const protection = assessSalesLeadProtection(row);
  if (!protection.deletable) {
    return { deleted: false, error: "lead_protected" };
  }

  const snapshot = {
    lead_id: leadId,
    client_name: asString(row.client_name),
    status: asString(row.status),
  };

  const { error } = await sb.from(SALES_LEADS_TABLE).delete().eq("id", leadId);
  if (error) return { deleted: false, error: "save_failed" };

  await recordAiActionServer({
    agentKey: "sales",
    actionType: "sales_lead_deleted",
    summary: `ליד נמחק — ${snapshot.client_name}`,
    leadId: null,
    details: snapshot,
  });

  return { deleted: true, error: null };
}

export async function previewSalesLeadCleanupServer(
  options: SalesLeadCleanupOptions
): Promise<{
  count: number;
  sampleNames: string[];
  error: SalesLeadCleanupError | null;
}> {
  if (!options.closedNotWon && !options.newUnconverted && !options.staleInactive) {
    return { count: 0, sampleNames: [], error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { count: 0, sampleNames: [], error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { count: 0, sampleNames: [], error: "supabase_service_unconfigured" };

  const { data: rows } = await sb.from(SALES_LEADS_TABLE).select("*");
  const matched = (rows ?? []).filter((r) =>
    matchesCleanupOption(r as Record<string, unknown>, options)
  );
  const sampleNames = matched.slice(0, 10).map((r) => {
    const rec = r as Record<string, unknown>;
    const name = asString(rec.client_name) || asString(rec.building_name);
    return name || "ליד";
  });

  return { count: matched.length, sampleNames, error: null };
}

export async function executeSalesLeadCleanupServer(
  options: SalesLeadCleanupOptions
): Promise<{ deleted: number; error: SalesLeadCleanupError | null }> {
  if (!options.closedNotWon && !options.newUnconverted && !options.staleInactive) {
    return { deleted: 0, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { deleted: 0, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: 0, error: "supabase_service_unconfigured" };

  const { data: rows } = await sb.from(SALES_LEADS_TABLE).select("id, client_name, status, converted_building_id, trial_building_id, trial_client_user_id, updated_at");
  const ids = (rows ?? [])
    .filter((r) => matchesCleanupOption(r as Record<string, unknown>, options))
    .map((r) => asString((r as Record<string, unknown>).id));

  let deleted = 0;
  for (const id of ids) {
    const result = await deleteSalesLeadServer(id);
    if (result.deleted) deleted += 1;
  }

  if (deleted > 0) {
    await recordAiActionServer({
      agentKey: "sales",
      actionType: "sales_cleanup_completed",
      summary: `ניקוי לידים — ${deleted} לידים הוסרו`,
      details: { deleted, options },
    });
  }

  return { deleted, error: null };
}

/** For tests / QA — map row without history. */
export function mapLeadProtectionFromSalesLead(lead: {
  status: SalesLeadStatus;
  convertedBuildingId: string | null;
  trialBuildingId: string | null;
  trialClientUserId: string | null;
}): SalesLeadProtection {
  return assessSalesLeadProtection({
    status: lead.status,
    converted_building_id: lead.convertedBuildingId,
    trial_building_id: lead.trialBuildingId,
    trial_client_user_id: lead.trialClientUserId,
  });
}
