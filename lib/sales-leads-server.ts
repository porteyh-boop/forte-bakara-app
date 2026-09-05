import {
  applySalesLeadDraft,
  type SalesLead,
  type SalesLeadDraft,
  type SalesLeadHistoryEntry,
  type SalesLeadHistoryKind,
  type SalesLeadStatus,
  SALES_LEAD_STATUSES,
} from "@/lib/sales-leads";
import {
  applySalesLeadSideEffects,
  type OpenedSalesProject,
} from "@/lib/sales-lead-ops-server";
import type { SalesWinMissingField } from "@/lib/sales-lead-ops";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const SALES_LEADS_TABLE = "sales_leads";
export const SALES_LEAD_HISTORY_TABLE = "sales_lead_history";

const LEAD_COLUMNS =
  "id, client_name, building_name, address, city, contact_name, phone, email, need_description, service_type, source, source_detail, contact_channel, status, estimated_value, next_action, follow_up_date, contact_id, converted_building_id, created_at, updated_at";

const HISTORY_COLUMNS = "id, lead_id, occurred_at, kind, entry_text, status";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SalesLeadsServerError =
  | "supabase_service_unconfigured"
  | "invalid_request"
  | "invalid_lead_id"
  | "not_found"
  | "save_failed";

export type SalesLeadMutationResult = {
  lead: SalesLead | null;
  error: SalesLeadsServerError | string | null;
  openedProject: OpenedSalesProject | null;
  projectConversion: { required: true; missing: SalesWinMissingField[] } | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asIso(value: unknown): string {
  const raw = asString(value).trim();
  if (!raw) return new Date().toISOString();
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function asFollowUpDate(value: unknown): string | null {
  const raw = asString(value).trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

function asEstimatedValue(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asStatus(value: unknown): SalesLeadStatus {
  const raw = asString(value);
  return (SALES_LEAD_STATUSES as readonly string[]).includes(raw)
    ? (raw as SalesLeadStatus)
    : "חדש";
}

function asHistoryKind(value: unknown): SalesLeadHistoryKind {
  const raw = asString(value);
  if (raw === "note" || raw === "status" || raw === "created") return raw;
  return "note";
}

export function parseSalesLeadId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export function parseSalesLeadDraft(body: unknown): SalesLeadDraft | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const status = asString(raw.status);
  if (status && !(SALES_LEAD_STATUSES as readonly string[]).includes(status)) {
    return null;
  }
  return {
    clientName: asString(raw.clientName),
    buildingName: asString(raw.buildingName),
    address: asString(raw.address),
    city: asString(raw.city),
    contactName: asString(raw.contactName),
    phone: asString(raw.phone),
    email: asString(raw.email),
    needDescription: asString(raw.needDescription),
    serviceType: asString(raw.serviceType),
    source: asString(raw.source),
    sourceDetail: asString(raw.sourceDetail),
    contactChannel: asString(raw.contactChannel),
    status: (status || "חדש") as SalesLeadDraft["status"],
    estimatedValue: asString(raw.estimatedValue),
    nextAction: asString(raw.nextAction),
    followUpDate: asString(raw.followUpDate),
    note: asString(raw.note),
  };
}

export function mapSalesLeadHistoryRow(
  row: Record<string, unknown>
): SalesLeadHistoryEntry {
  return {
    id: asString(row.id),
    at: asIso(row.occurred_at),
    kind: asHistoryKind(row.kind),
    text: asString(row.entry_text),
    status: row.status ? asStatus(row.status) : undefined,
  };
}

export function mapSalesLeadRow(
  row: Record<string, unknown>,
  history: SalesLeadHistoryEntry[] = []
): SalesLead {
  return {
    id: asString(row.id),
    clientName: asString(row.client_name),
    buildingName: asString(row.building_name),
    address: asString(row.address),
    city: asString(row.city),
    contactName: asString(row.contact_name),
    phone: asString(row.phone),
    email: asString(row.email),
    needDescription: asString(row.need_description),
    serviceType: asString(row.service_type),
    source: asString(row.source),
    sourceDetail: asString(row.source_detail),
    contactChannel: asString(row.contact_channel),
    status: asStatus(row.status),
    estimatedValue: asEstimatedValue(row.estimated_value),
    nextAction: asString(row.next_action),
    followUpDate: asFollowUpDate(row.follow_up_date),
    history,
    contactId: asString(row.contact_id) || null,
    convertedBuildingId: asString(row.converted_building_id) || null,
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function leadWritePayload(lead: SalesLead): Record<string, unknown> {
  return {
    client_name: lead.clientName,
    building_name: lead.buildingName,
    address: lead.address,
    city: lead.city,
    contact_name: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    need_description: lead.needDescription,
    service_type: lead.serviceType,
    source: lead.source,
    source_detail: lead.sourceDetail,
    contact_channel: lead.contactChannel,
    status: lead.status,
    estimated_value: lead.estimatedValue,
    next_action: lead.nextAction,
    follow_up_date: lead.followUpDate,
    contact_id: lead.contactId,
    converted_building_id: lead.convertedBuildingId,
    updated_at: lead.updatedAt,
  };
}

function historyWritePayload(leadId: string, entry: SalesLeadHistoryEntry) {
  return {
    lead_id: leadId,
    occurred_at: entry.at,
    kind: entry.kind,
    entry_text: entry.text,
    status: entry.status ?? null,
  };
}

export async function listSalesLeadsServer(): Promise<
  { leads: SalesLead[]; error: null } | { leads: []; error: SalesLeadsServerError }
> {
  if (!isSupabaseServiceConfigured()) {
    return { leads: [], error: "supabase_service_unconfigured" };
  }
  const client = getSupabaseServiceClient();
  if (!client) return { leads: [], error: "supabase_service_unconfigured" };

  const { data: leadRows, error: leadError } = await client
    .from(SALES_LEADS_TABLE)
    .select(LEAD_COLUMNS)
    .order("updated_at", { ascending: false });

  if (leadError) {
    console.error("[sales-leads-server] list leads failed", leadError.message);
    return { leads: [], error: "save_failed" };
  }

  const rows = (leadRows ?? []) as Record<string, unknown>[];
  const ids = rows.map((row) => asString(row.id)).filter(Boolean);
  const historyByLead = new Map<string, SalesLeadHistoryEntry[]>();

  if (ids.length > 0) {
    const { data: historyRows, error: historyError } = await client
      .from(SALES_LEAD_HISTORY_TABLE)
      .select(HISTORY_COLUMNS)
      .in("lead_id", ids)
      .order("occurred_at", { ascending: true });

    if (historyError) {
      console.error(
        "[sales-leads-server] list history failed",
        historyError.message
      );
      return { leads: [], error: "save_failed" };
    }

    for (const row of (historyRows ?? []) as Record<string, unknown>[]) {
      const leadId = asString(row.lead_id);
      const current = historyByLead.get(leadId) ?? [];
      current.push(mapSalesLeadHistoryRow(row));
      historyByLead.set(leadId, current);
    }
  }

  return {
    leads: rows.map((row) =>
      mapSalesLeadRow(row, historyByLead.get(asString(row.id)) ?? [])
    ),
    error: null,
  };
}

async function getSalesLeadServer(
  leadId: string
): Promise<
  { lead: SalesLead; error: null } | { lead: null; error: SalesLeadsServerError }
> {
  const client = getSupabaseServiceClient();
  if (!client) return { lead: null, error: "supabase_service_unconfigured" };

  const { data: row, error } = await client
    .from(SALES_LEADS_TABLE)
    .select(LEAD_COLUMNS)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    console.error("[sales-leads-server] get lead failed", error.message);
    return { lead: null, error: "save_failed" };
  }
  if (!row) return { lead: null, error: "not_found" };

  const { data: historyRows, error: historyError } = await client
    .from(SALES_LEAD_HISTORY_TABLE)
    .select(HISTORY_COLUMNS)
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: true });

  if (historyError) {
    console.error("[sales-leads-server] get history failed", historyError.message);
    return { lead: null, error: "save_failed" };
  }

  return {
    lead: mapSalesLeadRow(
      row as Record<string, unknown>,
      ((historyRows ?? []) as Record<string, unknown>[]).map(mapSalesLeadHistoryRow)
    ),
    error: null,
  };
}

async function persistSalesLeadLinks(
  leadId: string,
  patch: { contactId?: string | null; convertedBuildingId?: string | null }
): Promise<string | null> {
  const client = getSupabaseServiceClient();
  if (!client) return "supabase_service_unconfigured";

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.contactId !== undefined) update.contact_id = patch.contactId;
  if (patch.convertedBuildingId !== undefined) {
    update.converted_building_id = patch.convertedBuildingId;
  }

  const { error } = await client
    .from(SALES_LEADS_TABLE)
    .update(update)
    .eq("id", leadId);
  if (error) {
    console.error("[sales-leads-server] persist links failed", error.message);
    return "save_failed";
  }
  return null;
}

async function finalizeSalesLeadMutation(
  leadId: string
): Promise<SalesLeadMutationResult> {
  const loaded = await getSalesLeadServer(leadId);
  if (loaded.error || !loaded.lead) {
    return {
      lead: null,
      error: loaded.error ?? "not_found",
      openedProject: null,
      projectConversion: null,
    };
  }

  const effects = await applySalesLeadSideEffects(loaded.lead, (patch) =>
    persistSalesLeadLinks(leadId, patch)
  );
  if (effects.error && !effects.convertedBuildingId) {
    return {
      lead: loaded.lead,
      error: effects.error,
      openedProject: null,
      projectConversion: null,
    };
  }

  if (effects.convertedBuildingId || effects.contactId) {
    await persistSalesLeadLinks(leadId, {
      ...(effects.contactId ? { contactId: effects.contactId } : {}),
      ...(effects.convertedBuildingId
        ? { convertedBuildingId: effects.convertedBuildingId }
        : {}),
    });
  }

  if (effects.openedProject) {
    const client = getSupabaseServiceClient();
    if (client) {
      await client.from(SALES_LEAD_HISTORY_TABLE).insert(
        historyWritePayload(leadId, {
          id: `hist-${Date.now()}`,
          at: new Date().toISOString(),
          kind: "note",
          text: `נפתח פרויקט ${effects.openedProject.buildingId}.`,
        })
      );
    }
  }

  const refreshed = await getSalesLeadServer(leadId);
  return {
    lead: refreshed.lead
      ? {
          ...refreshed.lead,
          contactId: effects.contactId ?? refreshed.lead.contactId,
          convertedBuildingId:
            effects.convertedBuildingId ?? refreshed.lead.convertedBuildingId,
        }
      : refreshed.lead,
    error: effects.error && !effects.openedProject ? effects.error : refreshed.error,
    openedProject: effects.openedProject,
    projectConversion: effects.projectConversion,
  };
}

export async function createSalesLeadServer(
  draft: SalesLeadDraft,
  now: Date = new Date()
): Promise<SalesLeadMutationResult> {
  if (!isSupabaseServiceConfigured()) {
    return {
      lead: null,
      error: "supabase_service_unconfigured",
      openedProject: null,
      projectConversion: null,
    };
  }
  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      lead: null,
      error: "supabase_service_unconfigured",
      openedProject: null,
      projectConversion: null,
    };
  }

  const applied = applySalesLeadDraft(draft, null, now);
  if (applied.error) {
    return {
      lead: null,
      error: applied.error,
      openedProject: null,
      projectConversion: null,
    };
  }

  const { data: inserted, error: insertError } = await client
    .from(SALES_LEADS_TABLE)
    .insert({
      ...leadWritePayload(applied.lead),
      created_at: applied.lead.createdAt,
    })
    .select(LEAD_COLUMNS)
    .single();

  if (insertError || !inserted) {
    console.error("[sales-leads-server] create failed", insertError?.message);
    return {
      lead: null,
      error: "save_failed",
      openedProject: null,
      projectConversion: null,
    };
  }

  const leadId = asString((inserted as Record<string, unknown>).id);
  if (applied.newHistory.length > 0) {
    const { error: historyError } = await client
      .from(SALES_LEAD_HISTORY_TABLE)
      .insert(
        applied.newHistory.map((entry) => historyWritePayload(leadId, entry))
      );
    if (historyError) {
      await client.from(SALES_LEADS_TABLE).delete().eq("id", leadId);
      console.error("[sales-leads-server] create history failed", historyError.message);
      return {
        lead: null,
        error: "save_failed",
        openedProject: null,
        projectConversion: null,
      };
    }
  }

  return finalizeSalesLeadMutation(leadId);
}

export async function updateSalesLeadServer(
  leadId: string,
  draft: SalesLeadDraft,
  now: Date = new Date()
): Promise<SalesLeadMutationResult> {
  if (!isSupabaseServiceConfigured()) {
    return {
      lead: null,
      error: "supabase_service_unconfigured",
      openedProject: null,
      projectConversion: null,
    };
  }
  const parsedId = parseSalesLeadId(leadId);
  if (!parsedId) {
    return {
      lead: null,
      error: "invalid_lead_id",
      openedProject: null,
      projectConversion: null,
    };
  }

  const existing = await getSalesLeadServer(parsedId);
  if (existing.error || !existing.lead) {
    return {
      lead: null,
      error: existing.error ?? "not_found",
      openedProject: null,
      projectConversion: null,
    };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      lead: null,
      error: "supabase_service_unconfigured",
      openedProject: null,
      projectConversion: null,
    };
  }

  const applied = applySalesLeadDraft(draft, existing.lead, now);
  if (applied.error) {
    return {
      lead: null,
      error: applied.error,
      openedProject: null,
      projectConversion: null,
    };
  }

  const { error: updateError } = await client
    .from(SALES_LEADS_TABLE)
    .update(leadWritePayload(applied.lead))
    .eq("id", parsedId);

  if (updateError) {
    console.error("[sales-leads-server] update failed", updateError.message);
    return {
      lead: null,
      error: "save_failed",
      openedProject: null,
      projectConversion: null,
    };
  }

  if (applied.newHistory.length > 0) {
    const { error: historyError } = await client
      .from(SALES_LEAD_HISTORY_TABLE)
      .insert(
        applied.newHistory.map((entry) => historyWritePayload(parsedId, entry))
      );
    if (historyError) {
      console.error("[sales-leads-server] update history failed", historyError.message);
      return {
        lead: null,
        error: "save_failed",
        openedProject: null,
        projectConversion: null,
      };
    }
  }

  return finalizeSalesLeadMutation(parsedId);
}
