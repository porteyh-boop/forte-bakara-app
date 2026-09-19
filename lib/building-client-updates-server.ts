import {
  BUILDING_CLIENT_UPDATE_READS_TABLE,
  BUILDING_CLIENT_UPDATES_TABLE,
  type ClientBuildingClientUpdateDto,
  type ClientUpdateStatusId,
  type ClientUpdateTypeId,
  getClientUpdateStatusLabel,
  getClientUpdateTypeLabel,
  isClientUpdateStatusId,
  isClientUpdateTypeId,
  isDocumentEligibleForClientUpdateLink,
  type MasterBuildingClientUpdateDto,
  type MasterBuildingClientUpdateReadDto,
} from "@/lib/building-client-updates";
import { BUILDINGS_TABLE, normalizeBuildingId } from "@/lib/buildings-cloud";
import type { ClientPortalAuthContext } from "@/lib/client-portal-dto";
import {
  BUILDING_FORBIDDEN_ERROR,
  parseBuildingIdFilter,
} from "@/lib/master-client-access-server";
import { DOCUMENT_CENTER_BUCKET } from "@/lib/document-center";
import { parseDocumentId } from "@/lib/master-documents-server";
import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase-server";

const CLIENT_UPDATE_ATTACHMENT_SIGNED_URL_TTL_SEC = 120;

const CLIENT_USERS_TABLE = "client_users";
const DOCUMENTS_TABLE = "documents";

export function parseBuildingClientUpdateId(value: unknown): string | null {
  return parseDocumentId(value);
}

function mapUpdateRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    building_id: String(row.building_id ?? "").trim().toLowerCase(),
    project_number: row.project_number ? String(row.project_number) : null,
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    update_type: String(row.update_type ?? ""),
    status: String(row.status ?? ""),
    visible_to_client: Boolean(row.visible_to_client),
    document_id: row.document_id ? String(row.document_id) : null,
    published_at: String(row.published_at ?? ""),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function loadDocumentMetaForUpdate(
  documentId: string | null
): Promise<{ title: string | null; building_id: string; visibility: string } | null> {
  if (!documentId) return null;
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select("id, title, building_id, visibility")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    title: String(row.title ?? ""),
    building_id: String(row.building_id ?? "").trim().toLowerCase(),
    visibility: String(row.visibility ?? "internal"),
  };
}

export async function validateUpdateDocumentLinkServer(
  documentId: string,
  buildingId: string
): Promise<
  | { ok: true }
  | { ok: false; error: "not_found" | "building_mismatch" | "visibility_not_client" }
> {
  const parsedId = parseDocumentId(documentId);
  const parsedBuilding = parseBuildingIdFilter(buildingId);
  if (!parsedId || !parsedBuilding) {
    return { ok: false, error: "not_found" };
  }

  const meta = await loadDocumentMetaForUpdate(parsedId);
  if (!meta) return { ok: false, error: "not_found" };

  if (
    !isDocumentEligibleForClientUpdateLink({
      documentBuildingId: meta.building_id,
      updateBuildingId: parsedBuilding,
      visibility: meta.visibility,
    })
  ) {
    if (meta.building_id !== parsedBuilding) {
      return { ok: false, error: "building_mismatch" };
    }
    return { ok: false, error: "visibility_not_client" };
  }

  return { ok: true };
}

async function resolveProjectNumberSnapshot(
  buildingId: string
): Promise<string | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;
  const { data } = await client
    .from(BUILDINGS_TABLE)
    .select("project_number")
    .eq("building_id", buildingId)
    .maybeSingle();
  const pn = (data as Record<string, unknown> | null)?.project_number;
  if (typeof pn !== "string") return null;
  const trimmed = pn.trim();
  return trimmed || null;
}

async function loadReadStatusesForUpdates(
  updateIds: string[],
  buildingId: string
): Promise<Map<string, MasterBuildingClientUpdateReadDto[]>> {
  const result = new Map<string, MasterBuildingClientUpdateReadDto[]>();
  if (updateIds.length === 0) return result;

  const client = getSupabaseServiceClient();
  if (!client) return result;

  const { data: accessRows } = await client
    .from("client_access")
    .select("client_user_id")
    .eq("building_id", buildingId);

  const userIds = [
    ...new Set(
      (accessRows ?? []).map((r) =>
        String((r as Record<string, unknown>).client_user_id)
      )
    ),
  ];
  if (userIds.length === 0) return result;

  const { data: users } = await client
    .from(CLIENT_USERS_TABLE)
    .select("id, name")
    .in("id", userIds);

  const nameById = new Map<string, string>();
  for (const u of users ?? []) {
    const row = u as Record<string, unknown>;
    nameById.set(String(row.id), String(row.name ?? ""));
  }

  const { data: reads } = await client
    .from(BUILDING_CLIENT_UPDATE_READS_TABLE)
    .select("update_id, client_user_id, read_at")
    .in("update_id", updateIds)
    .in("client_user_id", userIds);

  const readMap = new Map<string, Map<string, string>>();
  for (const r of reads ?? []) {
    const row = r as Record<string, unknown>;
    const updateId = String(row.update_id);
    const userId = String(row.client_user_id);
    if (!readMap.has(updateId)) readMap.set(updateId, new Map());
    readMap.get(updateId)!.set(userId, String(row.read_at ?? ""));
  }

  for (const updateId of updateIds) {
    const perUser = readMap.get(updateId);
    const list: MasterBuildingClientUpdateReadDto[] = userIds.map((userId) => ({
      clientUserId: userId,
      clientUserName: nameById.get(userId) ?? userId,
      readAt: perUser?.get(userId) ?? null,
    }));
    result.set(updateId, list);
  }

  return result;
}

async function toMasterDto(
  row: ReturnType<typeof mapUpdateRow>,
  readBy: MasterBuildingClientUpdateReadDto[]
): Promise<MasterBuildingClientUpdateDto> {
  const docMeta = await loadDocumentMetaForUpdate(row.document_id);
  const updateType = isClientUpdateTypeId(row.update_type)
    ? row.update_type
    : ("general" as ClientUpdateTypeId);
  const status = isClientUpdateStatusId(row.status)
    ? row.status
    : ("for_information" as ClientUpdateStatusId);

  return {
    id: row.id,
    buildingId: row.building_id,
    projectNumber: row.project_number,
    title: row.title,
    body: row.body,
    updateType,
    updateTypeLabel: getClientUpdateTypeLabel(updateType),
    status,
    statusLabel: getClientUpdateStatusLabel(status),
    visibleToClient: row.visible_to_client,
    documentId: row.document_id,
    attachmentTitle: docMeta?.title ?? null,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readBy,
  };
}

export interface CreateMasterBuildingClientUpdateInput {
  buildingId: string;
  title: string;
  body: string;
  updateType: string;
  status: string;
  visibleToClient: boolean;
  documentId?: string | null;
  publishedAt?: string | null;
}

export interface PatchMasterBuildingClientUpdateInput {
  title?: string;
  body?: string;
  updateType?: string;
  status?: string;
  visibleToClient?: boolean;
  documentId?: string | null;
  clearDocument?: boolean;
}

export function parseCreateMasterBuildingClientUpdateInput(
  value: unknown
): CreateMasterBuildingClientUpdateInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const buildingId = parseBuildingIdFilter(raw.buildingId ?? raw.building_id);
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  const updateType =
    typeof raw.updateType === "string"
      ? raw.updateType.trim()
      : typeof raw.update_type === "string"
        ? raw.update_type.trim()
        : "";
  const status =
    typeof raw.status === "string" ? raw.status.trim() : "";
  if (!buildingId || !title || !body || !isClientUpdateTypeId(updateType)) {
    return null;
  }
  if (!isClientUpdateStatusId(status)) return null;

  const visibleToClient = Boolean(raw.visibleToClient ?? raw.visible_to_client);
  let documentId: string | null = null;
  if (raw.documentId != null || raw.document_id != null) {
    documentId = parseDocumentId(raw.documentId ?? raw.document_id);
    if (!documentId) return null;
  }

  const publishedAt =
    typeof raw.publishedAt === "string"
      ? raw.publishedAt
      : typeof raw.published_at === "string"
        ? raw.published_at
        : null;

  return {
    buildingId,
    title,
    body,
    updateType,
    status,
    visibleToClient,
    documentId,
    publishedAt,
  };
}

export function parsePatchMasterBuildingClientUpdateInput(
  value: unknown
): PatchMasterBuildingClientUpdateInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: PatchMasterBuildingClientUpdateInput = {};

  if (typeof raw.title === "string") patch.title = raw.title.trim();
  if (typeof raw.body === "string") patch.body = raw.body.trim();
  if (typeof raw.updateType === "string") {
    if (!isClientUpdateTypeId(raw.updateType.trim())) return null;
    patch.updateType = raw.updateType.trim();
  }
  if (typeof raw.status === "string") {
    if (!isClientUpdateStatusId(raw.status.trim())) return null;
    patch.status = raw.status.trim();
  }
  if ("visibleToClient" in raw || "visible_to_client" in raw) {
    patch.visibleToClient = Boolean(raw.visibleToClient ?? raw.visible_to_client);
  }
  if (raw.clearDocument === true) {
    patch.clearDocument = true;
    patch.documentId = null;
  } else if (raw.documentId != null || raw.document_id != null) {
    const docId = parseDocumentId(raw.documentId ?? raw.document_id);
    if (!docId) return null;
    patch.documentId = docId;
  }

  if (
    patch.title === undefined &&
    patch.body === undefined &&
    patch.updateType === undefined &&
    patch.status === undefined &&
    patch.visibleToClient === undefined &&
    patch.documentId === undefined &&
    !patch.clearDocument
  ) {
    return null;
  }

  return patch;
}

export async function listMasterBuildingClientUpdatesServer(
  buildingId: string
): Promise<{ updates: MasterBuildingClientUpdateDto[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { updates: [], error: "supabase_service_unconfigured" };
  }
  const normalized = parseBuildingIdFilter(buildingId);
  if (!normalized) return { updates: [], error: "invalid_building_id" };

  const client = getSupabaseServiceClient();
  if (!client) return { updates: [], error: "supabase_service_unconfigured" };

  const { data, error } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("*")
    .eq("building_id", normalized)
    .order("published_at", { ascending: false });

  if (error) return { updates: [], error: error.message };

  const rows = (data ?? []).map((r) => mapUpdateRow(r as Record<string, unknown>));
  const readMap = await loadReadStatusesForUpdates(
    rows.map((r) => r.id),
    normalized
  );

  const updates: MasterBuildingClientUpdateDto[] = [];
  for (const row of rows) {
    updates.push(await toMasterDto(row, readMap.get(row.id) ?? []));
  }

  return { updates, error: null };
}

export async function createMasterBuildingClientUpdateServer(
  input: CreateMasterBuildingClientUpdateInput
): Promise<{ update: MasterBuildingClientUpdateDto | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { update: null, error: "supabase_service_unconfigured" };
  }

  const buildingId = parseBuildingIdFilter(input.buildingId);
  if (!buildingId) return { update: null, error: "invalid_building_id" };

  if (input.documentId) {
    const docCheck = await validateUpdateDocumentLinkServer(
      input.documentId,
      buildingId
    );
    if (!docCheck.ok) {
      return {
        update: null,
        error:
          docCheck.error === "building_mismatch"
            ? BUILDING_FORBIDDEN_ERROR
            : docCheck.error,
      };
    }
  }

  const client = getSupabaseServiceClient();
  if (!client) return { update: null, error: "supabase_service_unconfigured" };

  const now = new Date().toISOString();
  const projectNumber = await resolveProjectNumberSnapshot(buildingId);

  const { data, error } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .insert({
      building_id: buildingId,
      project_number: projectNumber,
      title: input.title,
      body: input.body,
      update_type: input.updateType,
      status: input.status,
      visible_to_client: input.visibleToClient,
      document_id: input.documentId,
      published_at: input.publishedAt?.trim() || now,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { update: null, error: error?.message ?? "insert_failed" };
  }

  const row = mapUpdateRow(data as Record<string, unknown>);
  const readMap = await loadReadStatusesForUpdates([row.id], buildingId);
  return {
    update: await toMasterDto(row, readMap.get(row.id) ?? []),
    error: null,
  };
}

export async function patchMasterBuildingClientUpdateServer(
  updateId: string,
  buildingId: string,
  patch: PatchMasterBuildingClientUpdateInput
): Promise<{ update: MasterBuildingClientUpdateDto | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { update: null, error: "supabase_service_unconfigured" };
  }

  const parsedId = parseBuildingClientUpdateId(updateId);
  const normalizedBuilding = parseBuildingIdFilter(buildingId);
  if (!parsedId || !normalizedBuilding) {
    return { update: null, error: "invalid_input" };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { update: null, error: "supabase_service_unconfigured" };

  const { data: existing, error: loadError } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("*")
    .eq("id", parsedId)
    .maybeSingle();

  if (loadError || !existing) {
    return { update: null, error: "not_found" };
  }

  const existingRow = mapUpdateRow(existing as Record<string, unknown>);
  if (existingRow.building_id !== normalizedBuilding) {
    return { update: null, error: BUILDING_FORBIDDEN_ERROR };
  }

  const nextDocumentId = patch.clearDocument
    ? null
    : patch.documentId !== undefined
      ? patch.documentId
      : existingRow.document_id;

  if (nextDocumentId) {
    const docCheck = await validateUpdateDocumentLinkServer(
      nextDocumentId,
      normalizedBuilding
    );
    if (!docCheck.ok) {
      return {
        update: null,
        error:
          docCheck.error === "building_mismatch"
            ? BUILDING_FORBIDDEN_ERROR
            : docCheck.error,
      };
    }
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.body !== undefined) payload.body = patch.body;
  if (patch.updateType !== undefined) payload.update_type = patch.updateType;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.visibleToClient !== undefined) {
    payload.visible_to_client = patch.visibleToClient;
  }
  if (patch.documentId !== undefined || patch.clearDocument) {
    payload.document_id = nextDocumentId;
  }

  const { data, error } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .update(payload)
    .eq("id", parsedId)
    .eq("building_id", normalizedBuilding)
    .select("*")
    .single();

  if (error || !data) {
    return { update: null, error: error?.message ?? "update_failed" };
  }

  const row = mapUpdateRow(data as Record<string, unknown>);
  const readMap = await loadReadStatusesForUpdates([row.id], normalizedBuilding);
  return {
    update: await toMasterDto(row, readMap.get(row.id) ?? []),
    error: null,
  };
}

export async function listClientBuildingClientUpdatesServer(
  auth: ClientPortalAuthContext
): Promise<{ updates: ClientBuildingClientUpdateDto[]; error: string | null }> {
  if (!auth.permissions.can_view_client_updates) {
    return { updates: [], error: "permission_denied" };
  }

  const buildingId = normalizeBuildingId(auth.buildingId);
  const clientUserId = auth.session.user.id;

  const client = getSupabaseServiceClient();
  if (!client) return { updates: [], error: "supabase_service_unconfigured" };

  const { data, error } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("*")
    .eq("building_id", buildingId)
    .eq("visible_to_client", true)
    .order("published_at", { ascending: false });

  if (error) return { updates: [], error: error.message };

  const rows = (data ?? []).map((r) => mapUpdateRow(r as Record<string, unknown>));
  const updateIds = rows.map((r) => r.id);

  const readAtByUpdate = new Map<string, string>();
  if (updateIds.length > 0) {
    const { data: reads } = await client
      .from(BUILDING_CLIENT_UPDATE_READS_TABLE)
      .select("update_id, read_at")
      .eq("client_user_id", clientUserId)
      .in("update_id", updateIds);

    for (const r of reads ?? []) {
      const row = r as Record<string, unknown>;
      readAtByUpdate.set(String(row.update_id), String(row.read_at ?? ""));
    }
  }

  const updates: ClientBuildingClientUpdateDto[] = [];
  for (const row of rows) {
    const docMeta = await loadDocumentMetaForUpdate(row.document_id);
    const updateType = isClientUpdateTypeId(row.update_type)
      ? row.update_type
      : ("general" as ClientUpdateTypeId);
    const status = isClientUpdateStatusId(row.status)
      ? row.status
      : ("for_information" as ClientUpdateStatusId);
    const readAt = readAtByUpdate.get(row.id) ?? null;

    updates.push({
      id: row.id,
      title: row.title,
      body: row.body,
      updateType,
      updateTypeLabel: getClientUpdateTypeLabel(updateType),
      status,
      statusLabel: getClientUpdateStatusLabel(status),
      publishedAt: row.published_at,
      isRead: Boolean(readAt),
      readAt,
      hasAttachment: Boolean(row.document_id && docMeta),
      attachmentDocumentId: row.document_id,
      attachmentTitle: docMeta?.title ?? null,
    });
  }

  return { updates, error: null };
}

export async function countUnreadClientBuildingUpdatesServer(
  auth: ClientPortalAuthContext
): Promise<{ count: number; error: string | null }> {
  if (!auth.permissions.can_view_client_updates) {
    return { count: 0, error: "permission_denied" };
  }

  const buildingId = normalizeBuildingId(auth.buildingId);
  const clientUserId = auth.session.user.id;
  const client = getSupabaseServiceClient();
  if (!client) return { count: 0, error: "supabase_service_unconfigured" };

  const { data: updates, error } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("id")
    .eq("building_id", buildingId)
    .eq("visible_to_client", true);

  if (error) return { count: 0, error: error.message };
  const ids = (updates ?? []).map((u) => String((u as Record<string, unknown>).id));
  if (ids.length === 0) return { count: 0, error: null };

  const { data: reads, error: readError } = await client
    .from(BUILDING_CLIENT_UPDATE_READS_TABLE)
    .select("update_id")
    .eq("client_user_id", clientUserId)
    .in("update_id", ids);

  if (readError) return { count: 0, error: readError.message };

  const readSet = new Set(
    (reads ?? []).map((r) => String((r as Record<string, unknown>).update_id))
  );
  const unread = ids.filter((id) => !readSet.has(id)).length;
  return { count: unread, error: null };
}

export async function markClientBuildingUpdateReadServer(
  auth: ClientPortalAuthContext,
  updateId: string
): Promise<{ ok: boolean; error: string | null; alreadyRead: boolean }> {
  if (!auth.permissions.can_view_client_updates) {
    return { ok: false, error: "permission_denied", alreadyRead: false };
  }

  const parsedId = parseBuildingClientUpdateId(updateId);
  if (!parsedId) return { ok: false, error: "invalid_update_id", alreadyRead: false };

  const buildingId = normalizeBuildingId(auth.buildingId);
  const clientUserId = auth.session.user.id;
  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured", alreadyRead: false };
  }

  const { data: updateRow, error: loadError } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("id, building_id, visible_to_client")
    .eq("id", parsedId)
    .maybeSingle();

  if (loadError || !updateRow) {
    return { ok: false, error: "not_found", alreadyRead: false };
  }

  const row = updateRow as Record<string, unknown>;
  if (String(row.building_id).trim().toLowerCase() !== buildingId) {
    return { ok: false, error: "not_found", alreadyRead: false };
  }
  if (!row.visible_to_client) {
    return { ok: false, error: "not_found", alreadyRead: false };
  }

  const { data: existingRead } = await client
    .from(BUILDING_CLIENT_UPDATE_READS_TABLE)
    .select("id")
    .eq("update_id", parsedId)
    .eq("client_user_id", clientUserId)
    .maybeSingle();

  if (existingRead) {
    return { ok: true, error: null, alreadyRead: true };
  }

  const { error: insertError } = await client
    .from(BUILDING_CLIENT_UPDATE_READS_TABLE)
    .insert({
      update_id: parsedId,
      client_user_id: clientUserId,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: true, error: null, alreadyRead: true };
    }
    return { ok: false, error: insertError.message, alreadyRead: false };
  }

  return { ok: true, error: null, alreadyRead: false };
}

function isStoragePathOwnedByBuilding(
  storagePath: string,
  buildingId: string
): boolean {
  const normalized = buildingId.trim().toLowerCase();
  const path = storagePath.trim();
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${normalized}/`);
}

export type ClientBuildingUpdateAttachmentResult =
  | {
      ok: true;
      kind: "signed_url";
      url: string;
      title: string;
      fileName: string;
    }
  | {
      ok: true;
      kind: "stream";
      bytes: Uint8Array;
      contentType: string;
      title: string;
      fileName: string;
    }
  | {
      ok: false;
      error:
        | "permission_denied"
        | "not_found"
        | "no_attachment"
        | "invalid_storage_path"
        | string;
    };

export async function resolveClientBuildingUpdateAttachmentServer(
  auth: ClientPortalAuthContext,
  updateId: string
): Promise<ClientBuildingUpdateAttachmentResult> {
  if (!auth.permissions.can_view_client_updates) {
    return { ok: false, error: "permission_denied" };
  }

  const parsedId = parseBuildingClientUpdateId(updateId);
  if (!parsedId) return { ok: false, error: "not_found" };

  const buildingId = normalizeBuildingId(auth.buildingId);
  const client = getSupabaseServiceClient();
  if (!client) return { ok: false, error: "supabase_service_unconfigured" };

  const { data: updateRow, error: loadError } = await client
    .from(BUILDING_CLIENT_UPDATES_TABLE)
    .select("id, building_id, visible_to_client, document_id")
    .eq("id", parsedId)
    .maybeSingle();

  if (loadError || !updateRow) {
    return { ok: false, error: "not_found" };
  }

  const update = updateRow as Record<string, unknown>;
  if (String(update.building_id).trim().toLowerCase() !== buildingId) {
    return { ok: false, error: "not_found" };
  }
  if (!update.visible_to_client) {
    return { ok: false, error: "not_found" };
  }

  const documentId = update.document_id ? String(update.document_id) : null;
  if (!documentId) {
    return { ok: false, error: "no_attachment" };
  }

  const { data: docRow, error: docError } = await client
    .from(DOCUMENTS_TABLE)
    .select("id, building_id, visibility, storage_path, title, file_name, mime_type")
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !docRow) {
    return { ok: false, error: "not_found" };
  }

  const doc = docRow as Record<string, unknown>;
  const docBuildingId = String(doc.building_id ?? "").trim().toLowerCase();
  if (
    !isDocumentEligibleForClientUpdateLink({
      documentBuildingId: docBuildingId,
      updateBuildingId: buildingId,
      visibility: String(doc.visibility ?? "internal"),
    })
  ) {
    return { ok: false, error: "not_found" };
  }

  const storagePath = String(doc.storage_path ?? "").trim();
  if (!storagePath) {
    return { ok: false, error: "not_found" };
  }
  if (!isStoragePathOwnedByBuilding(storagePath, buildingId)) {
    return { ok: false, error: "invalid_storage_path" };
  }

  const title = String(doc.title ?? "מסמך");
  const fileName = String(doc.file_name ?? title);
  const contentType = String(doc.mime_type ?? "application/octet-stream");

  const { data: signed, error: signedError } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .createSignedUrl(storagePath, CLIENT_UPDATE_ATTACHMENT_SIGNED_URL_TTL_SEC);

  if (!signedError && signed?.signedUrl) {
    return {
      ok: true,
      kind: "signed_url",
      url: signed.signedUrl,
      title,
      fileName,
    };
  }

  const { data: fileData, error: downloadError } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .download(storagePath);

  if (downloadError || !fileData) {
    return {
      ok: false,
      error: downloadError?.message ?? signedError?.message ?? "download_failed",
    };
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  return {
    ok: true,
    kind: "stream",
    bytes,
    contentType,
    title,
    fileName,
  };
}
