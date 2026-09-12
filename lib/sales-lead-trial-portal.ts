import { buildClientAccessPath } from "@/lib/client-access";
import { resolveClientAccessGate, type ClientAccessSession } from "@/lib/client-access";
import type { SalesLead } from "@/lib/sales-leads";

export const SALES_LEAD_TRIAL_PROVISION_RPC = "provision_sales_lead_trial_portal";

export type SalesLeadTrialProvisionInput = {
  expiresAt: string;
  elevatorNames: string[];
};

export type SalesLeadTrialProvisionResult = {
  buildingId: string;
  clientUserId: string;
  accessToken: string;
  accessPath: string;
  alreadyProvisioned: boolean;
};

export type SalesLeadTrialPortalStatus = {
  buildingId: string;
  clientUserId: string | null;
  accessPath: string | null;
  expiresAt: string | null;
  isActive: boolean;
  gate: "ok" | "invalid" | "deactivated" | "expired" | "none";
};

export function parseSalesLeadTrialProvisionInput(
  body: unknown
): SalesLeadTrialProvisionInput | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const expiresAt =
    typeof raw.expiresAt === "string" ? raw.expiresAt.trim() : "";
  if (!expiresAt) return null;

  const elevatorNamesRaw = raw.elevatorNames;
  if (!Array.isArray(elevatorNamesRaw) || elevatorNamesRaw.length === 0) {
    return null;
  }

  const elevatorNames = elevatorNamesRaw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  if (elevatorNames.length === 0) return null;

  return { expiresAt, elevatorNames };
}

export function parseTrialProvisionRpcResult(
  data: unknown
): Omit<SalesLeadTrialProvisionResult, "accessPath"> | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const buildingId = String(row.building_id ?? "").trim();
  const accessToken = String(row.access_token ?? "").trim();
  const clientUserId = String(row.client_user_id ?? "").trim();
  if (!buildingId || !accessToken || !clientUserId) return null;
  return {
    buildingId,
    clientUserId,
    accessToken,
    alreadyProvisioned: row.already_provisioned === true,
  };
}

export function buildTrialProvisionResult(
  parsed: Omit<SalesLeadTrialProvisionResult, "accessPath">
): SalesLeadTrialProvisionResult {
  return {
    ...parsed,
    accessPath: buildClientAccessPath(parsed.accessToken),
  };
}

export function buildTrialPortalStatusFromSession(
  lead: Pick<SalesLead, "trialBuildingId" | "trialClientUserId">,
  session: ClientAccessSession | null
): SalesLeadTrialPortalStatus {
  const buildingId = lead.trialBuildingId?.trim() ?? "";
  if (!buildingId) {
    return {
      buildingId: "",
      clientUserId: null,
      accessPath: null,
      expiresAt: null,
      isActive: false,
      gate: "none",
    };
  }

  if (!session) {
    return {
      buildingId,
      clientUserId: lead.trialClientUserId,
      accessPath: null,
      expiresAt: null,
      isActive: false,
      gate: "invalid",
    };
  }

  const gate = resolveClientAccessGate(session);
  return {
    buildingId,
    clientUserId: session.user.id,
    accessPath: buildClientAccessPath(session.user.access_token),
    expiresAt: session.user.expires_at,
    isActive: session.user.is_active,
    gate,
  };
}

export type SimulatedTrialStore = {
  trialBuildingIdByLead: Record<string, string | null>;
  trialClientUserIdByLead: Record<string, string | null>;
  buildingIds: string[];
};

type LeadLock = {
  tail: Promise<void>;
};

/** In-memory model of provision_sales_lead_trial_portal idempotency + locking. */
export async function simulateProvisionSalesLeadTrialPortal(
  store: SimulatedTrialStore,
  locks: Map<string, LeadLock>,
  leadId: string,
  allocateBuildingId: () => string
): Promise<{ building_id: string; already_provisioned: boolean }> {
  const lock = locks.get(leadId) ?? { tail: Promise.resolve() };
  locks.set(leadId, lock);

  const run = lock.tail.then(async () => {
    const existing = store.trialBuildingIdByLead[leadId];
    if (existing) {
      return { building_id: existing, already_provisioned: true };
    }
    const buildingId = allocateBuildingId();
    store.buildingIds.push(buildingId);
    store.trialBuildingIdByLead[leadId] = buildingId;
    store.trialClientUserIdByLead[leadId] = `user-${buildingId}`;
    return { building_id: buildingId, already_provisioned: false };
  });

  lock.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export async function simulateParallelTrialProvisions(
  store: SimulatedTrialStore,
  leadId: string,
  requestCount: number,
  allocateBuildingId: () => string
): Promise<Array<{ building_id: string; already_provisioned: boolean }>> {
  const locks = new Map<string, LeadLock>();
  return Promise.all(
    Array.from({ length: requestCount }, () =>
      simulateProvisionSalesLeadTrialPortal(store, locks, leadId, allocateBuildingId)
    )
  );
}

export type SimulatedWinWithTrialStore = {
  convertedBuildingIdByLead: Record<string, string | null>;
  trialBuildingIdByLead: Record<string, string | null>;
  buildingIds: string[];
  isTrialByBuilding: Record<string, boolean>;
};

export async function simulateWinConvertWithTrial(
  store: SimulatedWinWithTrialStore,
  locks: Map<string, LeadLock>,
  leadId: string,
  allocateBuildingId: () => string
): Promise<{ building_id: string; already_converted: boolean; from_trial: boolean }> {
  const lock = locks.get(leadId) ?? { tail: Promise.resolve() };
  locks.set(leadId, lock);

  const run = lock.tail.then(async () => {
    const converted = store.convertedBuildingIdByLead[leadId];
    if (converted) {
      return { building_id: converted, already_converted: true, from_trial: false };
    }

    const trial = store.trialBuildingIdByLead[leadId];
    if (trial) {
      store.convertedBuildingIdByLead[leadId] = trial;
      store.isTrialByBuilding[trial] = false;
      return { building_id: trial, already_converted: false, from_trial: true };
    }

    const buildingId = allocateBuildingId();
    store.buildingIds.push(buildingId);
    store.convertedBuildingIdByLead[leadId] = buildingId;
    store.isTrialByBuilding[buildingId] = false;
    return { building_id: buildingId, already_converted: false, from_trial: false };
  });

  lock.tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
