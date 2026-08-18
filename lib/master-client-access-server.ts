import {
  CLIENT_ACCESS_TABLE,
  CLIENT_USERS_TABLE,
  generateAccessToken,
  type ClientAccessLevel,
  type ClientAccessRecord,
  type ClientAccessSession,
  type ClientUserAccessListItem,
  type ClientUserRecord,
  type CreateClientUserAccessInput,
  type UpdateClientAccessScopeInput,
  type UpdateClientUserProfileInput,
} from "@/lib/client-access";
import {
  isStoredClientType,
  getDefaultWelcomeMessageForClientType,
  normalizeWelcomeMessageForSave,
} from "@/lib/client-profile";
import {
  CLIENT_ACTIVITY_LOG_TABLE,
  CLIENT_PERMISSIONS_TABLE,
  DEFAULT_CLIENT_PERMISSIONS,
  extractClientPermissionFlags,
  type ClientPermissionFlags,
  type ClientPermissionRecord,
} from "@/lib/client-permissions";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

function normalizeAccessLevel(
  accessLevel: ClientAccessLevel,
  elevatorId?: string | null
): { accessLevel: ClientAccessLevel; elevatorId: string | null } {
  if (accessLevel === "elevator") {
    return {
      accessLevel: "elevator",
      elevatorId: elevatorId?.trim() || null,
    };
  }
  return { accessLevel: "building", elevatorId: null };
}

function mapClientUserRow(row: Record<string, unknown>): ClientUserRecord {
  const rawClientType = row.client_type ? String(row.client_type) : null;
  const rawWelcomeMessage = row.welcome_message
    ? String(row.welcome_message)
    : null;

  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    client_type: isStoredClientType(rawClientType) ? rawClientType : null,
    welcome_message: rawWelcomeMessage?.trim() ? rawWelcomeMessage : null,
    access_token: String(row.access_token),
    is_active: Boolean(row.is_active),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_at: String(row.created_at),
  };
}

function mapClientAccessRow(row: Record<string, unknown>): ClientAccessRecord {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    building_id: String(row.building_id),
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    access_level:
      row.access_level === "elevator" ? "elevator" : "building",
    created_at: String(row.created_at),
  };
}

function mapPermissionRow(row: Record<string, unknown>): ClientPermissionRecord {
  return {
    id: String(row.id),
    client_user_id: String(row.client_user_id),
    can_view_building_dashboard: Boolean(row.can_view_building_dashboard),
    can_report_faults: Boolean(row.can_report_faults),
    can_view_open_faults: Boolean(row.can_view_open_faults),
    can_view_fault_history: Boolean(row.can_view_fault_history),
    can_view_availability: Boolean(row.can_view_availability),
    can_view_documents: Boolean(row.can_view_documents),
    can_view_statistics: Boolean(row.can_view_statistics),
    can_upload_images: Boolean(row.can_upload_images),
    can_receive_notifications: Boolean(row.can_receive_notifications),
    can_submit_feedback: Boolean(row.can_submit_feedback),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function parseClientUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseBuildingIdFilter(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export const BUILDING_FORBIDDEN_ERROR = "building_forbidden";

type ClientAccessBuildingVerifyResult =
  | { ok: true; session: ClientAccessSession }
  | {
      ok: false;
      error: "not_found" | typeof BUILDING_FORBIDDEN_ERROR | "invalid_input";
    };

export async function verifyClientAccessBuildingServer(
  userId: string,
  expectedBuildingId: string
): Promise<ClientAccessBuildingVerifyResult> {
  const trimmedId = userId.trim();
  const expected = expectedBuildingId.trim().toLowerCase();
  if (!trimmedId || !expected) {
    return { ok: false, error: "invalid_input" };
  }

  const session = await getClientUserAccessByIdServer(trimmedId);
  if (!session) return { ok: false, error: "not_found" };
  if (session.access.building_id !== expected) {
    return { ok: false, error: BUILDING_FORBIDDEN_ERROR };
  }

  return { ok: true, session };
}

export function parseCreateClientUserAccessInput(
  value: unknown
): CreateClientUserAccessInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const buildingId =
    typeof raw.buildingId === "string" ? raw.buildingId.trim().toLowerCase() : "";
  const accessLevel =
    raw.accessLevel === "elevator" ? ("elevator" as const) : ("building" as const);

  if (!name || !buildingId) return null;

  return {
    name,
    phone: typeof raw.phone === "string" ? raw.phone : undefined,
    email: typeof raw.email === "string" ? raw.email : undefined,
    clientType:
      typeof raw.clientType === "string" && isStoredClientType(raw.clientType)
        ? raw.clientType
        : raw.clientType === null
          ? null
          : undefined,
    welcomeMessage:
      typeof raw.welcomeMessage === "string" ? raw.welcomeMessage : undefined,
    buildingId,
    elevatorId:
      typeof raw.elevatorId === "string"
        ? raw.elevatorId
        : raw.elevatorId === null
          ? null
          : undefined,
    accessLevel,
    expiresAt:
      raw.expiresAt === null
        ? null
        : typeof raw.expiresAt === "string"
          ? raw.expiresAt
          : undefined,
  };
}

export function parseUpdateClientAccessScopeInput(
  value: unknown
): UpdateClientAccessScopeInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const userId = parseClientUserId(raw.userId);
  const buildingId =
    typeof raw.buildingId === "string" ? raw.buildingId.trim().toLowerCase() : "";
  const accessLevel =
    raw.accessLevel === "elevator" ? ("elevator" as const) : ("building" as const);

  if (!userId || !buildingId) return null;

  return {
    userId,
    buildingId,
    accessLevel,
    elevatorId:
      typeof raw.elevatorId === "string"
        ? raw.elevatorId
        : raw.elevatorId === null
          ? null
          : undefined,
    expiresAt:
      raw.expiresAt === undefined
        ? undefined
        : raw.expiresAt === null
          ? null
          : typeof raw.expiresAt === "string"
            ? raw.expiresAt
            : undefined,
  };
}

export function parseUpdateClientUserProfileInput(
  value: unknown
): UpdateClientUserProfileInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const userId = parseClientUserId(raw.userId);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!userId || !name) return null;

  return {
    userId,
    name,
    phone:
      typeof raw.phone === "string" ? raw.phone : raw.phone === null ? null : undefined,
    email:
      typeof raw.email === "string" ? raw.email : raw.email === null ? null : undefined,
    clientType:
      typeof raw.clientType === "string" && isStoredClientType(raw.clientType)
        ? raw.clientType
        : raw.clientType === null
          ? null
          : undefined,
    welcomeMessage:
      typeof raw.welcomeMessage === "string" ? raw.welcomeMessage : undefined,
  };
}

export function parseClientPermissionFlags(
  value: unknown
): ClientPermissionFlags | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const flags = { ...DEFAULT_CLIENT_PERMISSIONS };

  for (const key of Object.keys(DEFAULT_CLIENT_PERMISSIONS) as Array<
    keyof ClientPermissionFlags
  >) {
    if (key in raw) {
      flags[key] = Boolean(raw[key]);
    }
  }

  return flags;
}

export async function listClientUserAccessRecordsServer(
  buildingIdFilter?: string | null
): Promise<{ records: ClientUserAccessListItem[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { records: [], error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { records: [], error: "supabase_service_unconfigured" };

  const { data: users, error: usersError } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (usersError || !users) {
    return { records: [], error: usersError?.message ?? "list_users_failed" };
  }

  let accessQuery = client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (buildingIdFilter) {
    accessQuery = accessQuery.eq("building_id", buildingIdFilter);
  }

  const { data: accessRows, error: accessError } = await accessQuery;

  if (accessError || !accessRows) {
    return { records: [], error: accessError?.message ?? "list_access_failed" };
  }

  const accessByUser = new Map<string, ClientAccessRecord>();
  for (const row of accessRows) {
    const access = mapClientAccessRow(row as Record<string, unknown>);
    if (!accessByUser.has(access.client_user_id)) {
      accessByUser.set(access.client_user_id, access);
    }
  }

  const filteredUsers = buildingIdFilter
    ? users.filter((row) => accessByUser.has(String(row.id)))
    : users;

  return {
    records: filteredUsers.map((row) => ({
      user: mapClientUserRow(row as Record<string, unknown>),
      access:
        accessByUser.get(String(row.id)) ?? {
          id: "",
          client_user_id: String(row.id),
          building_id: "—",
          elevator_id: null,
          access_level: "building",
          created_at: String(row.created_at),
        },
    })),
    error: null,
  };
}

export async function createClientUserAccessServer(
  input: CreateClientUserAccessInput
): Promise<{ session: ClientAccessSession | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { session: null, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { session: null, error: "supabase_service_unconfigured" };

  const scope = normalizeAccessLevel(input.accessLevel, input.elevatorId);
  if (scope.accessLevel === "elevator" && !scope.elevatorId) {
    return { session: null, error: "invalid_elevator" };
  }

  const token = generateAccessToken();
  const clientType =
    input.clientType && isStoredClientType(input.clientType)
      ? input.clientType
      : null;
  const welcomeMessage =
    normalizeWelcomeMessageForSave(
      input.welcomeMessage ?? "",
      clientType
    ) ?? getDefaultWelcomeMessageForClientType(clientType);

  const userInsertPayload = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    client_type: clientType,
    welcome_message: welcomeMessage,
    access_token: token,
    is_active: true,
    expires_at: input.expiresAt ?? null,
  };

  const { data: userRow, error: userError } = await client
    .from(CLIENT_USERS_TABLE)
    .insert(userInsertPayload)
    .select("*")
    .single();

  if (userError || !userRow) {
    return { session: null, error: userError?.message ?? "insert_user_failed" };
  }

  const user = mapClientUserRow(userRow as Record<string, unknown>);
  const accessInsertPayload = {
    client_user_id: user.id,
    building_id: input.buildingId.trim().toLowerCase(),
    elevator_id: scope.elevatorId,
    access_level: scope.accessLevel,
  };

  const { data: accessRow, error: accessError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .insert(accessInsertPayload)
    .select("*")
    .single();

  if (accessError || !accessRow) {
    await client.from(CLIENT_USERS_TABLE).delete().eq("id", user.id);
    return {
      session: null,
      error: accessError?.message ?? "insert_access_failed",
    };
  }

  return {
    session: {
      user,
      access: mapClientAccessRow(accessRow as Record<string, unknown>),
    },
    error: null,
  };
}

export async function getClientUserAccessByIdServer(
  userId: string
): Promise<ClientAccessSession | null> {
  if (!isSupabaseServiceConfigured()) return null;

  const client = getSupabaseServiceClient();
  if (!client) return null;

  const trimmedId = userId.trim();
  if (!trimmedId) return null;

  const { data: userRow, error: userError } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .eq("id", trimmedId)
    .maybeSingle();

  if (userError || !userRow) return null;

  const user = mapClientUserRow(userRow as Record<string, unknown>);
  const { data: accessRows, error: accessError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .eq("client_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accessError || !accessRows?.[0]) return null;

  return {
    user,
    access: mapClientAccessRow(accessRows[0] as Record<string, unknown>),
  };
}

export async function deactivateClientAccessServer(
  userId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client || !userId.trim()) {
    return { ok: false, error: "invalid_user_id" };
  }

  const verified = await verifyClientAccessBuildingServer(userId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const { error } = await client
    .from(CLIENT_USERS_TABLE)
    .update({ is_active: false })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function reactivateClientAccessServer(
  userId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client || !userId.trim()) {
    return { ok: false, error: "invalid_user_id" };
  }

  const verified = await verifyClientAccessBuildingServer(userId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const { error } = await client
    .from(CLIENT_USERS_TABLE)
    .update({ is_active: true })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

export async function updateClientUserProfileServer(
  input: UpdateClientUserProfileInput,
  buildingId: string
): Promise<{ user: ClientUserRecord | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { user: null, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  const userId = input.userId.trim();
  const name = input.name.trim();

  if (!client || !userId || !name) {
    return { user: null, error: "invalid_input" };
  }

  const verified = await verifyClientAccessBuildingServer(userId, buildingId);
  if (!verified.ok) {
    return { user: null, error: verified.error };
  }

  const clientType =
    input.clientType && isStoredClientType(input.clientType)
      ? input.clientType
      : null;

  const { data, error } = await client
    .from(CLIENT_USERS_TABLE)
    .update({
      name,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      client_type: clientType,
      welcome_message: normalizeWelcomeMessageForSave(
        input.welcomeMessage ?? "",
        clientType
      ),
    })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { user: null, error: error?.message ?? "update_failed" };
  }

  return { user: mapClientUserRow(data as Record<string, unknown>), error: null };
}

export async function updateClientAccessScopeServer(
  input: UpdateClientAccessScopeInput
): Promise<{ session: ClientAccessSession | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { session: null, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client || !input.userId.trim()) {
    return { session: null, error: "invalid_user_id" };
  }

  const verified = await verifyClientAccessBuildingServer(
    input.userId,
    input.buildingId
  );
  if (!verified.ok) {
    return { session: null, error: verified.error };
  }

  const scope = normalizeAccessLevel(input.accessLevel, input.elevatorId);
  if (scope.accessLevel === "elevator" && !scope.elevatorId) {
    return { session: null, error: "invalid_elevator" };
  }

  const userUpdate: Record<string, unknown> = {};
  if (input.expiresAt !== undefined) {
    userUpdate.expires_at = input.expiresAt;
  }

  if (Object.keys(userUpdate).length > 0) {
    const { error: userError } = await client
      .from(CLIENT_USERS_TABLE)
      .update(userUpdate)
      .eq("id", input.userId);

    if (userError) {
      return { session: null, error: userError.message };
    }
  }

  const accessPayload = {
    building_id: input.buildingId.trim().toLowerCase(),
    elevator_id: scope.elevatorId,
    access_level: scope.accessLevel,
  };

  const { data: accessRows, error: accessLookupError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .eq("client_user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accessLookupError) {
    return { session: null, error: accessLookupError.message };
  }

  if (accessRows?.[0]) {
    const { error: accessError } = await client
      .from(CLIENT_ACCESS_TABLE)
      .update(accessPayload)
      .eq("id", accessRows[0].id);

    if (accessError) {
      return { session: null, error: accessError.message };
    }
  } else {
    const { error: accessError } = await client
      .from(CLIENT_ACCESS_TABLE)
      .insert({
        client_user_id: input.userId,
        ...accessPayload,
      });

    if (accessError) {
      return { session: null, error: accessError.message };
    }
  }

  const session = await getClientUserAccessByIdServer(input.userId);
  return { session, error: session ? null : "load_session_failed" };
}

export async function getClientPermissionsServer(
  clientUserId: string
): Promise<{ flags: ClientPermissionFlags; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { flags: { ...DEFAULT_CLIENT_PERMISSIONS }, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client || !clientUserId.trim()) {
    return { flags: { ...DEFAULT_CLIENT_PERMISSIONS }, error: "invalid_user_id" };
  }

  const { data, error } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .select("*")
    .eq("client_user_id", clientUserId)
    .maybeSingle();

  if (error) {
    return { flags: { ...DEFAULT_CLIENT_PERMISSIONS }, error: error.message };
  }

  if (!data) {
    return { flags: { ...DEFAULT_CLIENT_PERMISSIONS }, error: null };
  }

  return {
    flags: extractClientPermissionFlags(
      mapPermissionRow(data as Record<string, unknown>)
    ),
    error: null,
  };
}

async function logClientActivityServer(
  clientUserId: string,
  actionType: string,
  actionDetails?: string | null
): Promise<void> {
  const client = getSupabaseServiceClient();
  if (!client || !clientUserId.trim() || !actionType.trim()) return;

  await client.from(CLIENT_ACTIVITY_LOG_TABLE).insert({
    client_user_id: clientUserId,
    action_type: actionType.trim(),
    action_details: actionDetails ?? null,
  });
}

export async function saveClientPermissionsServer(
  clientUserId: string,
  flags: ClientPermissionFlags,
  buildingId: string
): Promise<{ record: ClientPermissionRecord | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { record: null, error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client || !clientUserId.trim()) {
    return { record: null, error: "invalid_user_id" };
  }

  const verified = await verifyClientAccessBuildingServer(
    clientUserId,
    buildingId
  );
  if (!verified.ok) {
    return { record: null, error: verified.error };
  }

  const { data: existingRow } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .select("id")
    .eq("client_user_id", clientUserId)
    .maybeSingle();

  const now = new Date().toISOString();
  const payload = {
    client_user_id: clientUserId,
    ...flags,
    updated_at: now,
  };

  const { data, error } = await client
    .from(CLIENT_PERMISSIONS_TABLE)
    .upsert(payload, { onConflict: "client_user_id" })
    .select("*")
    .single();

  if (error || !data) {
    return { record: null, error: error?.message ?? "save_failed" };
  }

  await logClientActivityServer(
    clientUserId,
    existingRow ? "permissions_updated" : "permissions_created",
    JSON.stringify(flags)
  );

  return {
    record: mapPermissionRow(data as Record<string, unknown>),
    error: null,
  };
}
