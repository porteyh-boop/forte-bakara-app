import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { MasterFaultAggregateDto } from "@/lib/master-fault-aggregates-server";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

const MASTER_FAULT_AGGREGATES_API = "/forte/api/master-fault-aggregates";

interface ListResponse {
  aggregates?: MasterFaultAggregateDto[];
  error?: string | null;
}

interface ApiErrorPayload {
  error?: string;
}

export type { MasterFaultAggregateDto };

export function isMasterFaultAggregatesApiConfigured(): boolean {
  return isPilotCloudConfigured();
}

async function parseApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  return parseMasterApiError(payload, response.status);
}

export async function listMasterFaultAggregates(): Promise<
  MasterFaultAggregateDto[]
> {
  if (!isMasterFaultAggregatesApiConfigured()) return [];

  try {
    const response = await masterApiFetch(MASTER_FAULT_AGGREGATES_API, {
      method: "GET",
      cache: "no-store",
    });

    const payload = await parseMasterApiJson<ListResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-fault-aggregates-api] list failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return [];
    }

    return payload?.aggregates ?? [];
  } catch (error) {
    console.warn("[master-fault-aggregates-api] list error:", error);
    return [];
  }
}
