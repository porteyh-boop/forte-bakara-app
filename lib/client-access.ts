import {
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  getDefaultWelcomeMessageForClientType,
  isStoredClientType,
  normalizeWelcomeMessageForSave,
  type ClientType,
  type StoredClientType,
} from "./client-profile";
import { getPilotSupabaseClient, isPilotCloudConfigured } from "./pilot-cloud";
import type { Elevator, Fault } from "./types";
import type { PilotCloudFault } from "./pilot-cloud";

export type { ClientType, StoredClientType } from "./client-profile";
export {
  CLIENT_TYPE_OPTIONS,
  CLIENT_TYPE_NOT_SET_LABEL,
  CLIENT_TYPE_WELCOME_MESSAGES,
  formatClientTypeDisplay,
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  getDefaultWelcomeMessageForClientType,
  hydrateWelcomeMessageForEdit,
  normalizeWelcomeMessageForSave,
  resolveClientWelcomeMessage,
} from "./client-profile";

export const CLIENT_USERS_TABLE = "client_users";
export const CLIENT_ACCESS_TABLE = "client_access";

export type ClientAccessLevel = "building" | "elevator";

export type ClientAccessGateResult =
  | "ok"
  | "invalid"
  | "deactivated"
  | "expired";

export interface ClientUserRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  client_type: StoredClientType | null;
  welcome_message: string | null;
  access_token: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface ClientAccessRecord {
  id: string;
  client_user_id: string;
  building_id: string;
  elevator_id: string | null;
  access_level: ClientAccessLevel;
  created_at: string;
}

export interface ClientAccessSession {
  user: ClientUserRecord;
  access: ClientAccessRecord;
}

export interface ClientUserAccessListItem {
  user: ClientUserRecord;
  access: ClientAccessRecord;
}

export interface CreateClientUserAccessInput {
  name: string;
  phone?: string;
  email?: string;
  clientType?: ClientType | StoredClientType | null;
  welcomeMessage?: string | null;
  buildingId: string;
  elevatorId?: string | null;
  accessLevel: ClientAccessLevel;
  expiresAt?: string | null;
}

export interface UpdateClientUserProfileInput {
  userId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  clientType?: ClientType | StoredClientType | null;
  welcomeMessage?: string | null;
}

export interface UpdateClientAccessScopeInput {
  userId: string;
  buildingId: string;
  elevatorId?: string | null;
  accessLevel: ClientAccessLevel;
  expiresAt?: string | null;
}

const TOKEN_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function buildClientAccessPath(token: string): string {
  return `/client/access/${encodeURIComponent(token.trim())}`;
}

export function buildClientAccessUrl(
  token: string,
  siteOrigin = ""
): string {
  const origin =
    siteOrigin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}${buildClientAccessPath(token)}`;
}

export function isClientAccessPath(pathname: string): boolean {
  return pathname.startsWith("/client/access/");
}

export function generateAccessToken(length = 12): string {
  const size = Math.max(8, length);
  const bytes = new Uint8Array(size);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < size; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let token = "";
  for (let i = 0; i < size; i += 1) {
    token += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  }
  return token;
}

export function isAccessTokenIndependentOfScope(
  token: string,
  buildingId: string,
  elevatorId?: string | null
): boolean {
  const normalizedToken = token.trim().toLowerCase();
  const normalizedBuilding = buildingId.trim().toLowerCase();
  const normalizedElevator = elevatorId?.trim().toLowerCase() ?? "";

  if (normalizedToken.length < 8) return false;
  if (normalizedToken === normalizedBuilding) return false;
  if (normalizedElevator && normalizedToken === normalizedElevator) return false;
  if (normalizedBuilding && normalizedToken.includes(normalizedBuilding)) {
    return false;
  }
  if (normalizedElevator && normalizedToken.includes(normalizedElevator)) {
    return false;
  }

  return /^[A-Za-z0-9]+$/.test(token);
}

export function resolveClientAccessGate(
  session: ClientAccessSession | null,
  now: Date = new Date()
): ClientAccessGateResult {
  if (!session) return "invalid";
  if (!session.user.is_active) return "deactivated";
  if (
    session.user.expires_at &&
    new Date(session.user.expires_at).getTime() < now.getTime()
  ) {
    return "expired";
  }
  return "ok";
}

export function getClientAccessGateMessage(gate: ClientAccessGateResult): string {
  switch (gate) {
    case "invalid":
      return "קישור לא תקין";
    case "deactivated":
      return "הגישה לקישור זה בוטלה";
    case "expired":
      return "תוקף הקישור פג";
    default:
      return "";
  }
}

export function scopeElevatorsForClientAccess(
  elevators: Elevator[],
  access: Pick<ClientAccessRecord, "access_level" | "elevator_id">
): Elevator[] {
  if (access.access_level === "elevator" && access.elevator_id) {
    return elevators.filter((elevator) => elevator.id === access.elevator_id);
  }
  return elevators;
}

export function scopeFaultsForClientAccess<T extends Fault | PilotCloudFault>(
  faults: T[],
  access: Pick<ClientAccessRecord, "access_level" | "elevator_id">
): T[] {
  if (access.access_level === "elevator" && access.elevator_id) {
    return faults.filter((fault) => {
      const elevatorId =
        "elevator_id" in fault ? fault.elevator_id : fault.elevatorId;
      return elevatorId === access.elevator_id;
    });
  }
  return faults;
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

export async function createClientUserAccess(
  input: CreateClientUserAccessInput
): Promise<ClientAccessSession | null> {
  const client = getPilotSupabaseClient();
  if (!client) return null;

  const scope = normalizeAccessLevel(input.accessLevel, input.elevatorId);
  if (scope.accessLevel === "elevator" && !scope.elevatorId) {
    return null;
  }

  const token = generateAccessToken();
  const welcomeMessage =
    normalizeWelcomeMessageForSave(
      input.welcomeMessage ?? "",
      input.clientType && isStoredClientType(input.clientType)
        ? input.clientType
        : null
    ) ??
    getDefaultWelcomeMessageForClientType(
      input.clientType && isStoredClientType(input.clientType)
        ? input.clientType
        : null
    );
  const clientType =
    input.clientType && isStoredClientType(input.clientType)
      ? input.clientType
      : null;

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
    console.error("[client-access] createClientUserAccess — insert failed", {
      table: CLIENT_USERS_TABLE,
      fields: userInsertPayload,
      supabaseError: userError,
      errorMessage: userError?.message ?? null,
      errorDetails: userError?.details ?? null,
      errorHint: userError?.hint ?? null,
      errorCode: userError?.code ?? null,
    });
    return null;
  }

  const user = mapClientUserRow(userRow);
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
    console.error("[client-access] createClientUserAccess — insert failed", {
      table: CLIENT_ACCESS_TABLE,
      fields: accessInsertPayload,
      supabaseError: accessError,
      errorMessage: accessError?.message ?? null,
      errorDetails: accessError?.details ?? null,
      errorHint: accessError?.hint ?? null,
      errorCode: accessError?.code ?? null,
    });
    const { error: rollbackError } = await client
      .from(CLIENT_USERS_TABLE)
      .delete()
      .eq("id", user.id);
    if (rollbackError) {
      console.error(
        "[client-access] createClientUserAccess — rollback delete failed",
        {
          table: CLIENT_USERS_TABLE,
          fields: { id: user.id },
          supabaseError: rollbackError,
          errorMessage: rollbackError.message,
          errorDetails: rollbackError.details ?? null,
          errorHint: rollbackError.hint ?? null,
          errorCode: rollbackError.code ?? null,
        }
      );
    }
    return null;
  }

  return {
    user,
    access: mapClientAccessRow(accessRow),
  };
}

export async function getClientAccessByToken(
  token: string
): Promise<ClientAccessSession | null> {
  const client = getPilotSupabaseClient();
  const trimmed = token.trim();
  if (!client || !trimmed) return null;

  const { data: userRow, error: userError } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .eq("access_token", trimmed)
    .maybeSingle();

  if (userError || !userRow) {
    if (userError) {
      console.warn("[client-access] get by token failed:", userError.message);
    }
    return null;
  }

  const user = mapClientUserRow(userRow);
  const { data: accessRows, error: accessError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .eq("client_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accessError || !accessRows?.[0]) {
    if (accessError) {
      console.warn("[client-access] load access failed:", accessError.message);
    }
    return null;
  }

  return {
    user,
    access: mapClientAccessRow(accessRows[0]),
  };
}

export async function getClientUserById(
  userId: string
): Promise<ClientUserRecord | null> {
  const client = getPilotSupabaseClient();
  const trimmedId = userId.trim();
  if (!client || !trimmedId) return null;

  const { data, error } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .eq("id", trimmedId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("[client-access] get user by id failed:", error.message);
    }
    return null;
  }

  return mapClientUserRow(data);
}

export async function getAllClientUserAccessRecords(): Promise<
  ClientUserAccessListItem[]
> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data: users, error: usersError } = await client
    .from(CLIENT_USERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (usersError || !users) {
    console.warn("[client-access] list users failed:", usersError?.message);
    return [];
  }

  const { data: accessRows, error: accessError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (accessError || !accessRows) {
    console.warn("[client-access] list access failed:", accessError?.message);
    return [];
  }

  const accessByUser = new Map<string, ClientAccessRecord>();
  for (const row of accessRows) {
    const access = mapClientAccessRow(row);
    if (!accessByUser.has(access.client_user_id)) {
      accessByUser.set(access.client_user_id, access);
    }
  }

  return users.map((row) => ({
    user: mapClientUserRow(row),
    access: accessByUser.get(String(row.id)) ?? {
      id: "",
      client_user_id: String(row.id),
      building_id: "—",
      elevator_id: null,
      access_level: "building",
      created_at: String(row.created_at),
    },
  }));
}

export async function deactivateClientAccess(userId: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !userId.trim()) return false;

  const { error } = await client
    .from(CLIENT_USERS_TABLE)
    .update({ is_active: false })
    .eq("id", userId);

  if (error) {
    console.warn("[client-access] deactivate failed:", error.message);
    return false;
  }
  return true;
}

export async function updateClientUserProfile(
  input: UpdateClientUserProfileInput
): Promise<ClientUserRecord | null> {
  const client = getPilotSupabaseClient();
  const userId = input.userId.trim();
  const name = input.name.trim();

  if (!client || !userId || !name) return null;

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
    console.warn("[client-access] update profile failed:", error?.message);
    return null;
  }

  return mapClientUserRow(data);
}

export async function reactivateClientAccess(userId: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !userId.trim()) return false;

  const { error } = await client
    .from(CLIENT_USERS_TABLE)
    .update({ is_active: true })
    .eq("id", userId);

  if (error) {
    console.warn("[client-access] reactivate failed:", error.message);
    return false;
  }
  return true;
}

export async function updateClientAccessScope(
  input: UpdateClientAccessScopeInput
): Promise<ClientAccessSession | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.userId.trim()) return null;

  const scope = normalizeAccessLevel(input.accessLevel, input.elevatorId);
  if (scope.accessLevel === "elevator" && !scope.elevatorId) {
    return null;
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
      console.warn("[client-access] update user failed:", userError.message);
      return null;
    }
  }

  const { data: accessRows, error: accessLookupError } = await client
    .from(CLIENT_ACCESS_TABLE)
    .select("*")
    .eq("client_user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (accessLookupError) {
    console.warn(
      "[client-access] lookup access failed:",
      accessLookupError.message
    );
    return null;
  }

  const accessPayload = {
    building_id: input.buildingId.trim().toLowerCase(),
    elevator_id: scope.elevatorId,
    access_level: scope.accessLevel,
  };

  if (accessRows?.[0]) {
    const { error: accessError } = await client
      .from(CLIENT_ACCESS_TABLE)
      .update(accessPayload)
      .eq("id", accessRows[0].id);

    if (accessError) {
      console.warn("[client-access] update access failed:", accessError.message);
      return null;
    }
  } else {
    const { error: accessError } = await client
      .from(CLIENT_ACCESS_TABLE)
      .insert({
        client_user_id: input.userId,
        ...accessPayload,
      });

    if (accessError) {
      console.warn("[client-access] insert access failed:", accessError.message);
      return null;
    }
  }

  const session = await getClientAccessByToken(
    (
      await client
        .from(CLIENT_USERS_TABLE)
        .select("access_token")
        .eq("id", input.userId)
        .maybeSingle()
    ).data?.access_token ?? ""
  );

  return session;
}

export function isClientAccessCloudConfigured(): boolean {
  return isPilotCloudConfigured();
}

export function formatClientAccessExpiry(iso: string | null): string {
  if (!iso) return "ללא הגבלת זמן";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export type ClientAccessDisplayStatus = "active" | "disabled" | "expired";

export function getClientAccessDisplayStatus(
  user: Pick<ClientUserRecord, "is_active" | "expires_at">,
  now: Date = new Date()
): ClientAccessDisplayStatus {
  if (!user.is_active) return "disabled";
  if (
    user.expires_at &&
    new Date(user.expires_at).getTime() < now.getTime()
  ) {
    return "expired";
  }
  return "active";
}

export const CLIENT_ACCESS_STATUS_LABELS: Record<ClientAccessDisplayStatus, string> = {
  active: "פעיל",
  disabled: "מושבת",
  expired: "פג תוקף",
};

function normalizePhoneForLookup(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function findClientAccessForContact(
  records: ClientUserAccessListItem[],
  buildingId: string,
  contact: { email?: string; phone?: string }
): ClientUserAccessListItem | null {
  const normalizedBuilding = buildingId.trim().toLowerCase();
  const normalizedEmail = contact.email?.trim().toLowerCase() ?? "";
  const normalizedPhone = normalizePhoneForLookup(contact.phone ?? "");

  if (!normalizedEmail && !normalizedPhone) return null;

  return (
    records.find((item) => {
      if (item.access.building_id !== normalizedBuilding) return false;
      if (
        normalizedEmail &&
        item.user.email?.trim().toLowerCase() === normalizedEmail
      ) {
        return true;
      }
      if (
        normalizedPhone &&
        normalizePhoneForLookup(item.user.phone ?? "") === normalizedPhone
      ) {
        return true;
      }
      return false;
    }) ?? null
  );
}
