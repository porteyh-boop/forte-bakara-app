import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { MasterBuildingClientUpdateDto } from "@/lib/building-client-updates";
import type {
  ClientUpdateStatusId,
  ClientUpdateTypeId,
} from "@/lib/building-client-updates";

const BASE = "/forte/api/master/building-client-updates";

interface ListResponse {
  updates?: MasterBuildingClientUpdateDto[];
  error?: string | null;
}

interface MutateResponse {
  update?: MasterBuildingClientUpdateDto | null;
  error?: string | null;
}

export interface CreateMasterBuildingClientUpdatePayload {
  buildingId: string;
  title: string;
  body: string;
  updateType: ClientUpdateTypeId;
  status: ClientUpdateStatusId;
  visibleToClient: boolean;
  documentId?: string | null;
}

export interface PatchMasterBuildingClientUpdatePayload {
  title?: string;
  body?: string;
  updateType?: ClientUpdateTypeId;
  status?: ClientUpdateStatusId;
  visibleToClient?: boolean;
  documentId?: string | null;
  clearDocument?: boolean;
}

async function parseError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<{ error?: string }>(response);
  return parseMasterApiError(payload, response.status);
}

export async function listMasterBuildingClientUpdates(
  buildingId: string
): Promise<{ updates: MasterBuildingClientUpdateDto[]; error: string | null }> {
  if (!buildingId.trim()) {
    return { updates: [], error: "invalid_building_id" };
  }

  const params = new URLSearchParams({ buildingId: buildingId.trim() });
  const response = await masterApiFetch(`${BASE}?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
  });

  const payload = await parseMasterApiJson<ListResponse>(response);
  if (!response.ok) {
    return {
      updates: [],
      error: payload?.error ?? (await parseError(response)),
    };
  }

  return { updates: payload?.updates ?? [], error: payload?.error ?? null };
}

export async function createMasterBuildingClientUpdate(
  input: CreateMasterBuildingClientUpdatePayload
): Promise<{ update: MasterBuildingClientUpdateDto | null; error: string | null }> {
  const response = await masterApiFetch(BASE, {
    method: "POST",
    body: JSON.stringify({ input }),
  });

  const payload = await parseMasterApiJson<MutateResponse>(response);
  if (!response.ok || !payload?.update) {
    return {
      update: null,
      error: payload?.error ?? (await parseError(response)),
    };
  }

  return { update: payload.update, error: null };
}

export async function patchMasterBuildingClientUpdate(
  buildingId: string,
  updateId: string,
  patch: PatchMasterBuildingClientUpdatePayload
): Promise<{ update: MasterBuildingClientUpdateDto | null; error: string | null }> {
  const params = new URLSearchParams({ buildingId: buildingId.trim() });
  const response = await masterApiFetch(
    `${BASE}/${encodeURIComponent(updateId)}?${params.toString()}`,
    {
      method: "PATCH",
      body: JSON.stringify({ patch }),
    }
  );

  const payload = await parseMasterApiJson<MutateResponse>(response);
  if (!response.ok || !payload?.update) {
    return {
      update: null,
      error: payload?.error ?? (await parseError(response)),
    };
  }

  return { update: payload.update, error: null };
}
