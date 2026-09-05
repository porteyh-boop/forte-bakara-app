import { roundMoney } from "@/lib/project-financial";
import { DEFAULT_PROJECT_TYPE } from "@/lib/project-type-config";
import type { SalesLead } from "@/lib/sales-leads";
import { isServiceType } from "@/lib/service-type";

export const SALES_WIN_CONVERT_RPC = "convert_sales_lead_win_to_project";

export type SalesWinConvertRpcArgs = {
  p_lead_id: string;
  p_name: string;
  p_city: string;
  p_address: string;
  p_management_company: string;
  p_contact_name: string;
  p_contact_phone: string;
  p_project_notes: string;
  p_project_type: string;
  p_order_amount: number | null;
  p_service_type: string | null;
  p_contact_id: string | null;
};

export type SalesWinConvertRpcResult = {
  building_id: string;
  already_converted: boolean;
};

export function buildSalesWinProjectNotes(
  lead: Pick<SalesLead, "needDescription" | "email">
): string {
  return [
    lead.needDescription.trim(),
    lead.email.trim() ? `דוא״ל: ${lead.email.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSalesWinConvertRpcArgs(
  lead: SalesLead
): SalesWinConvertRpcArgs {
  const serviceType = isServiceType(lead.serviceType) ? lead.serviceType : null;
  const projectType =
    lead.serviceType === "בדק בית / חוות דעת" ? "home_inspection" : DEFAULT_PROJECT_TYPE;

  return {
    p_lead_id: lead.id,
    p_name: lead.buildingName.trim(),
    p_city: lead.city.trim(),
    p_address: lead.address.trim(),
    p_management_company: lead.clientName.trim(),
    p_contact_name: lead.contactName.trim(),
    p_contact_phone: lead.phone.trim(),
    p_project_notes: buildSalesWinProjectNotes(lead),
    p_project_type: projectType,
    p_order_amount:
      lead.estimatedValue != null ? roundMoney(lead.estimatedValue) : null,
    p_service_type: serviceType,
    p_contact_id: lead.contactId,
  };
}

export function parseSalesWinConvertRpcResult(
  data: unknown
): SalesWinConvertRpcResult | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const buildingId = String(row.building_id ?? "").trim();
  if (!buildingId) return null;
  return {
    building_id: buildingId,
    already_converted: row.already_converted === true,
  };
}

export type SimulatedWinStore = {
  convertedBuildingIdByLead: Record<string, string | null>;
  buildingIds: string[];
};

type LeadLock = {
  tail: Promise<void>;
};

/**
 * In-memory model of convert_sales_lead_win_to_project:
 * lock the lead, reuse converted_building_id if set, else insert+link
 * in one transaction that rolls back on failure.
 */
export async function simulateConvertSalesLeadWinToProject(
  store: SimulatedWinStore,
  locks: Map<string, LeadLock>,
  leadId: string,
  allocateBuildingId: () => string,
  options?: { failAfterInsert?: boolean }
): Promise<SalesWinConvertRpcResult> {
  const lock = locks.get(leadId) ?? { tail: Promise.resolve() };
  locks.set(leadId, lock);

  const run = lock.tail.then(async () => {
    const current = store.convertedBuildingIdByLead[leadId];
    if (current) {
      return { building_id: current, already_converted: true };
    }

    const snapshotIds = [...store.buildingIds];
    const snapshotConverted = store.convertedBuildingIdByLead[leadId] ?? null;

    try {
      const buildingId = allocateBuildingId();
      store.buildingIds.push(buildingId);
      if (options?.failAfterInsert) {
        throw new Error("simulated_failure");
      }
      store.convertedBuildingIdByLead[leadId] = buildingId;
      return { building_id: buildingId, already_converted: false };
    } catch (error) {
      store.buildingIds.length = 0;
      store.buildingIds.push(...snapshotIds);
      store.convertedBuildingIdByLead[leadId] = snapshotConverted;
      throw error;
    }
  });

  lock.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function simulateParallelSalesLeadWinConverts(
  store: SimulatedWinStore,
  leadId: string,
  requestCount: number,
  allocateBuildingId: () => string
): Promise<SalesWinConvertRpcResult[]> {
  const locks = new Map<string, LeadLock>();
  return Promise.all(
    Array.from({ length: requestCount }, () =>
      simulateConvertSalesLeadWinToProject(store, locks, leadId, allocateBuildingId)
    )
  );
}
