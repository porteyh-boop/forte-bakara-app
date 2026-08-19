import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { MasterFaultDto } from "@/lib/master-faults-server";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

const MASTER_FAULTS_API = "/forte/api/master-faults";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  faults?: MasterFaultDto[];
  error?: string | null;
}

interface OkResponse {
  ok?: boolean;
  error?: string | null;
}

export type { MasterFaultDto };

export function isMasterFaultsApiConfigured(): boolean {
  return isPilotCloudConfigured();
}

async function parseApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  return parseMasterApiError(payload, response.status);
}

export async function listMasterFaultsByBuilding(
  buildingId: string
): Promise<MasterFaultDto[]> {
  if (!isMasterFaultsApiConfigured() || !buildingId.trim()) return [];

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await masterApiFetch(
      `${MASTER_FAULTS_API}?${params.toString()}`,
      { method: "GET", cache: "no-store" }
    );

    const payload = await parseMasterApiJson<ListResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-faults-api] list failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return [];
    }

    return payload?.faults ?? [];
  } catch (error) {
    console.warn("[master-faults-api] list error:", error);
    return [];
  }
}

async function patchMasterFault(
  faultId: string,
  body: Record<string, unknown>
): Promise<boolean> {
  if (!isMasterFaultsApiConfigured() || !faultId.trim()) return false;

  try {
    const response = await masterApiFetch(
      `${MASTER_FAULTS_API}/${encodeURIComponent(faultId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );

    const payload = await parseMasterApiJson<OkResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-faults-api] patch failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return false;
    }

    return Boolean(payload?.ok);
  } catch (error) {
    console.warn("[master-faults-api] patch error:", error);
    return false;
  }
}

export async function startMasterFaultTreatment(
  faultId: string,
  buildingId: string,
  treatmentNote?: string | null
): Promise<boolean> {
  return patchMasterFault(faultId, {
    action: "start_treatment",
    buildingId,
    treatmentNote,
  });
}

export async function updateMasterFaultTreatmentNote(
  faultId: string,
  buildingId: string,
  treatmentNote: string
): Promise<boolean> {
  return patchMasterFault(faultId, {
    action: "update_treatment_note",
    buildingId,
    treatmentNote,
  });
}

export async function closeMasterFault(
  faultId: string,
  buildingId: string,
  closureNote?: string | null
): Promise<boolean> {
  return patchMasterFault(faultId, {
    action: "close",
    buildingId,
    closureNote,
  });
}

export async function reopenMasterFault(
  faultId: string,
  buildingId: string
): Promise<boolean> {
  return patchMasterFault(faultId, {
    action: "reopen",
    buildingId,
  });
}

export async function deleteMasterFault(
  faultId: string,
  buildingId: string
): Promise<boolean> {
  if (!isMasterFaultsApiConfigured() || !faultId.trim() || !buildingId.trim()) {
    return false;
  }

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await masterApiFetch(
      `${MASTER_FAULTS_API}/${encodeURIComponent(faultId)}?${params.toString()}`,
      { method: "DELETE" }
    );

    const payload = await parseMasterApiJson<OkResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-faults-api] delete failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return false;
    }

    return Boolean(payload?.ok);
  } catch (error) {
    console.warn("[master-faults-api] delete error:", error);
    return false;
  }
}
