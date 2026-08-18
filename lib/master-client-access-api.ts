import type {
  ClientAccessSession,
  ClientUserAccessListItem,
  CreateClientUserAccessInput,
  UpdateClientAccessScopeInput,
} from "@/lib/client-access";
import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import {
  DEFAULT_CLIENT_PERMISSIONS,
  type ClientPermissionFlags,
} from "@/lib/client-permissions";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

const MASTER_CLIENT_ACCESS_API = "/forte/api/master-client-access";
const MASTER_CLIENT_PERMISSIONS_API = "/forte/api/master-client-permissions";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  records?: ClientUserAccessListItem[];
  error?: string | null;
}

interface SessionResponse {
  session?: ClientAccessSession | null;
  error?: string | null;
}

interface OkResponse {
  ok?: boolean;
  error?: string | null;
}

interface PermissionsResponse {
  flags?: ClientPermissionFlags;
  error?: string | null;
}

async function parseApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  return parseMasterApiError(payload, response.status);
}

export function isMasterClientAccessConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function listMasterClientAccessRecords(
  buildingId?: string
): Promise<ClientUserAccessListItem[]> {
  if (!isMasterClientAccessConfigured()) return [];

  try {
    const params = new URLSearchParams();
    if (buildingId) params.set("buildingId", buildingId);

    const query = params.toString();
    const response = await masterApiFetch(
      query ? `${MASTER_CLIENT_ACCESS_API}?${query}` : MASTER_CLIENT_ACCESS_API,
      { method: "GET", cache: "no-store" }
    );

    const payload = await parseMasterApiJson<ListResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-client-access-api] list failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return [];
    }

    return payload?.records ?? [];
  } catch (error) {
    console.warn("[master-client-access-api] list error:", error);
    return [];
  }
}

export async function createMasterClientUserAccess(
  input: CreateClientUserAccessInput
): Promise<ClientAccessSession | null> {
  if (!isMasterClientAccessConfigured()) return null;

  try {
    const response = await masterApiFetch(MASTER_CLIENT_ACCESS_API, {
      method: "POST",
      body: JSON.stringify({ input }),
    });

    const payload = await parseMasterApiJson<SessionResponse>(response);
    if (!response.ok || !payload?.session) {
      console.warn(
        "[master-client-access-api] create failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return null;
    }

    return payload.session;
  } catch (error) {
    console.warn("[master-client-access-api] create error:", error);
    return null;
  }
}

export async function deactivateMasterClientAccess(
  userId: string,
  buildingId: string
): Promise<boolean> {
  if (!isMasterClientAccessConfigured() || !userId.trim() || !buildingId.trim()) {
    return false;
  }

  try {
    const response = await masterApiFetch(
      `${MASTER_CLIENT_ACCESS_API}/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "deactivate", buildingId }),
      }
    );

    const payload = await parseMasterApiJson<OkResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-client-access-api] deactivate failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return false;
    }

    return Boolean(payload?.ok);
  } catch (error) {
    console.warn("[master-client-access-api] deactivate error:", error);
    return false;
  }
}

export async function reactivateMasterClientAccess(
  userId: string,
  buildingId: string
): Promise<boolean> {
  if (!isMasterClientAccessConfigured() || !userId.trim() || !buildingId.trim()) {
    return false;
  }

  try {
    const response = await masterApiFetch(
      `${MASTER_CLIENT_ACCESS_API}/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "reactivate", buildingId }),
      }
    );

    const payload = await parseMasterApiJson<OkResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-client-access-api] reactivate failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return false;
    }

    return Boolean(payload?.ok);
  } catch (error) {
    console.warn("[master-client-access-api] reactivate error:", error);
    return false;
  }
}

export async function updateMasterClientAccessScope(
  input: UpdateClientAccessScopeInput
): Promise<ClientAccessSession | null> {
  if (!isMasterClientAccessConfigured() || !input.userId.trim()) return null;

  try {
    const response = await masterApiFetch(
      `${MASTER_CLIENT_ACCESS_API}/${encodeURIComponent(input.userId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "update_scope",
          buildingId: input.buildingId,
          accessLevel: input.accessLevel,
          elevatorId: input.elevatorId,
          expiresAt: input.expiresAt,
        }),
      }
    );

    const payload = await parseMasterApiJson<SessionResponse>(response);
    if (!response.ok || !payload?.session) {
      console.warn(
        "[master-client-access-api] update scope failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return null;
    }

    return payload.session;
  } catch (error) {
    console.warn("[master-client-access-api] update scope error:", error);
    return null;
  }
}

export async function getMasterClientPermissionsOrDefaults(
  clientUserId: string
): Promise<ClientPermissionFlags> {
  if (!isMasterClientAccessConfigured() || !clientUserId.trim()) {
    return { ...DEFAULT_CLIENT_PERMISSIONS };
  }

  try {
    const params = new URLSearchParams({ clientUserId });
    const response = await masterApiFetch(
      `${MASTER_CLIENT_PERMISSIONS_API}?${params.toString()}`,
      { method: "GET", cache: "no-store" }
    );

    const payload = await parseMasterApiJson<PermissionsResponse>(response);
    if (!response.ok || !payload?.flags) {
      console.warn(
        "[master-client-access-api] get permissions failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return { ...DEFAULT_CLIENT_PERMISSIONS };
    }

    return payload.flags;
  } catch (error) {
    console.warn("[master-client-access-api] get permissions error:", error);
    return { ...DEFAULT_CLIENT_PERMISSIONS };
  }
}

export async function saveMasterClientPermissions(
  clientUserId: string,
  flags: ClientPermissionFlags,
  buildingId: string
): Promise<boolean> {
  if (
    !isMasterClientAccessConfigured() ||
    !clientUserId.trim() ||
    !buildingId.trim()
  ) {
    return false;
  }

  try {
    const response = await masterApiFetch(MASTER_CLIENT_PERMISSIONS_API, {
      method: "PATCH",
      body: JSON.stringify({ clientUserId, buildingId, flags }),
    });

    const payload = await parseMasterApiJson<{ record?: unknown; error?: string }>(
      response
    );
    if (!response.ok) {
      console.warn(
        "[master-client-access-api] save permissions failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return false;
    }

    return Boolean(payload?.record);
  } catch (error) {
    console.warn("[master-client-access-api] save permissions error:", error);
    return false;
  }
}
