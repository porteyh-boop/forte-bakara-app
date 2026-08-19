import {
  BUILDING_FORBIDDEN_ERROR,
  parseBuildingIdFilter,
} from "@/lib/master-client-access-server";
import {
  buildDocumentInsertRow,
  buildDocumentInsertRowWithoutVisibilityColumn,
  buildDocumentPublicUrl,
  buildDocumentStoragePath,
  DOCUMENT_CENTER_BUCKET,
  DOCUMENTS_TABLE,
  DOCUMENT_TYPES,
  DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR,
  isMissingVisibilityColumnError,
  normalizeDocumentTags,
  normalizeDocumentVisibility,
  resolveDocumentContentType,
  resolveDocumentVisibility,
  validateDocumentCenterFile,
  type CreateDocumentInput,
  type DocumentTypeId,
  type DocumentVisibility,
} from "@/lib/document-center";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const DOCUMENT_LIST_COLUMNS =
  "id, building_id, document_type, title, file_name, file_url, tags, visibility, created_at, ai_metadata";

const DOCUMENT_MUTATION_COLUMNS = "id, building_id, storage_path";

export { BUILDING_FORBIDDEN_ERROR };

export function parseDocumentId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(trimmed) ? trimmed : null;
}

interface MasterDocumentMutationRow {
  id: string;
  building_id: string;
  storage_path: string;
}

async function loadMasterDocumentMutationRow(
  documentId: string
): Promise<MasterDocumentMutationRow | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select(DOCUMENT_MUTATION_COLUMNS)
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    building_id: String(row.building_id ?? "").trim().toLowerCase(),
    storage_path: String(row.storage_path ?? "").trim(),
  };
}

export async function verifyMasterDocumentBuildingServer(
  documentId: string,
  buildingId: string
): Promise<
  | { ok: true; row: MasterDocumentMutationRow }
  | { ok: false; error: typeof BUILDING_FORBIDDEN_ERROR | "not_found" | "invalid_building_id" }
> {
  const expected = parseBuildingIdFilter(buildingId);
  if (!expected) {
    return { ok: false, error: "invalid_building_id" };
  }

  const row = await loadMasterDocumentMutationRow(documentId);
  if (!row) {
    return { ok: false, error: "not_found" };
  }

  if (row.building_id !== expected) {
    return { ok: false, error: BUILDING_FORBIDDEN_ERROR };
  }

  return { ok: true, row };
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

export function validateMasterDocumentVisibilityValue(
  value: unknown
): DocumentVisibility | null {
  if (value === "internal" || value === "client") {
    return value;
  }
  return null;
}

export interface MasterDocumentDto {
  id: string;
  building_id: string;
  document_type: DocumentTypeId;
  title: string;
  file_name: string;
  file_url: string;
  tags: string[];
  visibility: DocumentVisibility;
  created_at: string;
  /** Required for InspectionsTab inspector letter follow-up stages only. */
  ai_metadata: Record<string, unknown> | null;
}

function normalizeDocumentType(value: unknown): DocumentTypeId {
  const documentType = String(value ?? "other");
  return DOCUMENT_TYPES.some((type) => type.id === documentType)
    ? (documentType as DocumentTypeId)
    : "other";
}

export function mapMasterDocumentDto(
  row: Record<string, unknown>
): MasterDocumentDto {
  const rawTags = row.tags;
  const tags = Array.isArray(rawTags)
    ? normalizeDocumentTags(rawTags.map((tag) => String(tag)))
    : [];

  const aiMetadata =
    row.ai_metadata && typeof row.ai_metadata === "object"
      ? (row.ai_metadata as Record<string, unknown>)
      : null;

  return {
    id: String(row.id),
    building_id: String(row.building_id).trim().toLowerCase(),
    document_type: normalizeDocumentType(row.document_type),
    title: String(row.title ?? ""),
    file_name: String(row.file_name ?? ""),
    file_url: String(row.file_url ?? ""),
    tags,
    visibility: resolveDocumentVisibility(row),
    created_at: String(row.created_at ?? ""),
    ai_metadata: aiMetadata,
  };
}

export async function listMasterDocumentsByBuildingServer(
  buildingId: string
): Promise<{ documents: MasterDocumentDto[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { documents: [], error: "supabase_service_unconfigured" };
  }

  const normalized = parseBuildingIdFilter(buildingId);
  if (!normalized) {
    return { documents: [], error: "invalid_building_id" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { documents: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select(DOCUMENT_LIST_COLUMNS)
    .eq("building_id", normalized)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[master-documents-server] list failed:", error.message);
    return { documents: [], error: error.message || "list_failed" };
  }

  const documents = (data ?? []).map((row) =>
    mapMasterDocumentDto(row as Record<string, unknown>)
  );

  return { documents, error: null };
}

export interface MasterDocumentUploadInput {
  buildingId: string;
  documentType: DocumentTypeId;
  title: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType?: string;
  fileSizeBytes: number;
  tags?: string[];
  visibility?: DocumentVisibility;
}

export interface MasterDocumentUploadResult {
  document: MasterDocumentDto | null;
  error: string | null;
  cleanupFailed?: boolean;
}

function validateUploadFileName(fileName: string): string | null {
  const trimmed = fileName.trim();
  if (!trimmed) return "יש לצרף קובץ.";
  if (
    trimmed.includes("..") ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    return "שם קובץ לא תקין.";
  }
  return null;
}

function parseUploadDocumentType(value: unknown): DocumentTypeId | null {
  const documentType = String(value ?? "").trim();
  return DOCUMENT_TYPES.some((type) => type.id === documentType)
    ? (documentType as DocumentTypeId)
    : null;
}

export function validateMasterDocumentUploadMetadata(input: {
  buildingId: string;
  documentType: unknown;
  title: unknown;
  fileName: string;
  mimeType?: string;
  fileSizeBytes: number;
  tags?: unknown;
  visibility?: unknown;
}): string | null {
  const normalizedBuilding = parseBuildingIdFilter(input.buildingId);
  if (!normalizedBuilding) return "invalid_building_id";

  const documentType = parseUploadDocumentType(input.documentType);
  if (!documentType) return "invalid_document_type";

  const title = String(input.title ?? "").trim();
  if (!title) return "missing_title";

  const fileNameError = validateUploadFileName(input.fileName);
  if (fileNameError) return "invalid_file_name";

  const fileValidationError = validateDocumentCenterFile({
    name: input.fileName,
    type: input.mimeType ?? "",
    size: input.fileSizeBytes,
  });
  if (fileValidationError) return fileValidationError;

  const contentTypeResult = resolveDocumentContentType(
    input.fileName,
    input.mimeType ?? ""
  );
  if (!contentTypeResult.ok) return contentTypeResult.error;
  if (contentTypeResult.contentType === "application/octet-stream") {
    return DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR;
  }

  if (input.fileSizeBytes <= 0) return "empty_file";

  if (input.visibility !== undefined && input.visibility !== null) {
    const visibility = String(input.visibility).trim();
    if (visibility !== "internal" && visibility !== "client") {
      return "invalid_visibility";
    }
  }

  if (input.tags !== undefined && input.tags !== null && !Array.isArray(input.tags)) {
    return "invalid_tags";
  }

  return null;
}

async function deleteMasterDocumentStorageFile(
  storagePath: string
): Promise<boolean> {
  if (!storagePath.trim()) return false;

  const client = getSupabaseServiceClient();
  if (!client) return false;

  const { error } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn(
      "[master-documents-server] storage cleanup failed:",
      error.message
    );
    return false;
  }

  return true;
}

async function insertMasterDocumentRow(
  input: CreateDocumentInput
): Promise<{ row: Record<string, unknown> | null; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { row: null, error: "supabase_service_unconfigured" };
  }

  const row = buildDocumentInsertRow(input);
  const firstAttempt = await client
    .from(DOCUMENTS_TABLE)
    .insert(row)
    .select(DOCUMENT_LIST_COLUMNS)
    .single();

  if (!firstAttempt.error && firstAttempt.data) {
    return {
      row: firstAttempt.data as Record<string, unknown>,
      error: null,
    };
  }

  if (
    firstAttempt.error &&
    isMissingVisibilityColumnError(firstAttempt.error)
  ) {
    const legacyRow = buildDocumentInsertRowWithoutVisibilityColumn(input);
    const retryAttempt = await client
      .from(DOCUMENTS_TABLE)
      .insert(legacyRow)
      .select(DOCUMENT_LIST_COLUMNS)
      .single();

    if (!retryAttempt.error && retryAttempt.data) {
      return {
        row: retryAttempt.data as Record<string, unknown>,
        error: null,
      };
    }

    return {
      row: null,
      error: retryAttempt.error?.message || "insert_failed",
    };
  }

  return {
    row: null,
    error: firstAttempt.error?.message || "insert_failed",
  };
}

export async function uploadMasterDocumentServer(
  input: MasterDocumentUploadInput
): Promise<MasterDocumentUploadResult> {
  if (!isSupabaseServiceConfigured()) {
    return { document: null, error: "supabase_service_unconfigured" };
  }

  const normalizedBuilding = parseBuildingIdFilter(input.buildingId);
  if (!normalizedBuilding) {
    return { document: null, error: "invalid_building_id" };
  }

  const metadataError = validateMasterDocumentUploadMetadata({
    buildingId: normalizedBuilding,
    documentType: input.documentType,
    title: input.title,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    tags: input.tags,
    visibility: input.visibility,
  });
  if (metadataError) {
    return { document: null, error: metadataError };
  }

  const contentTypeResult = resolveDocumentContentType(
    input.fileName,
    input.mimeType ?? ""
  );
  if (!contentTypeResult.ok) {
    return { document: null, error: contentTypeResult.error };
  }

  const contentType = contentTypeResult.contentType;
  const storagePath = buildDocumentStoragePath(
    normalizedBuilding,
    input.fileName,
    contentType
  );

  if (!storagePath.startsWith(`${normalizedBuilding}/`)) {
    return { document: null, error: "invalid_storage_path" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { document: null, error: "supabase_service_unconfigured" };
  }

  const { error: uploadError } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .upload(storagePath, input.fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.warn(
      "[master-documents-server] storage upload failed:",
      uploadError.message
    );
    return { document: null, error: uploadError.message || "upload_failed" };
  }

  const fileUrl = buildDocumentPublicUrl(storagePath);
  if (!fileUrl) {
    await deleteMasterDocumentStorageFile(storagePath);
    return { document: null, error: "public_url_failed" };
  }

  const createInput: CreateDocumentInput = {
    buildingId: normalizedBuilding,
    documentType: input.documentType,
    title: input.title.trim(),
    fileName: input.fileName.trim(),
    fileUrl,
    storagePath,
    mimeType: contentType,
    fileSizeBytes: input.fileSizeBytes,
    tags: normalizeDocumentTags(input.tags ?? []),
    visibility: input.visibility,
  };

  const insertResult = await insertMasterDocumentRow(createInput);
  if (!insertResult.row) {
    const cleanupFailed = !(await deleteMasterDocumentStorageFile(storagePath));
    return {
      document: null,
      error: insertResult.error ?? "insert_failed",
      cleanupFailed,
    };
  }

  return {
    document: mapMasterDocumentDto(insertResult.row),
    error: null,
  };
}

export async function updateMasterDocumentVisibilityServer(
  documentId: string,
  buildingId: string,
  visibility: DocumentVisibility
): Promise<{
  document: MasterDocumentDto | null;
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { document: null, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyMasterDocumentBuildingServer(
    documentId,
    buildingId
  );
  if (!verified.ok) {
    return { document: null, error: verified.error };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { document: null, error: "supabase_service_unconfigured" };
  }

  const normalizedVisibility = normalizeDocumentVisibility(visibility);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .update({
      visibility: normalizedVisibility,
      updated_at: now,
    })
    .eq("id", verified.row.id)
    .eq("building_id", verified.row.building_id)
    .select(DOCUMENT_LIST_COLUMNS)
    .single();

  if (error || !data) {
    console.warn(
      "[master-documents-server] visibility update failed:",
      error?.message
    );
    return {
      document: null,
      error: error?.message || "visibility_update_failed",
    };
  }

  return {
    document: mapMasterDocumentDto(data as Record<string, unknown>),
    error: null,
  };
}

export interface DeleteMasterDocumentResult {
  ok: boolean;
  error: string | null;
  storageDeleted?: boolean;
  dbDeleted?: boolean;
  partialFailure?: boolean;
}

export async function deleteMasterDocumentServer(
  documentId: string,
  buildingId: string
): Promise<DeleteMasterDocumentResult> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyMasterDocumentBuildingServer(
    documentId,
    buildingId
  );
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const storagePath = verified.row.storage_path;
  let storageDeleted = false;

  if (storagePath) {
    if (!isStoragePathOwnedByBuilding(storagePath, verified.row.building_id)) {
      return { ok: false, error: "invalid_storage_path" };
    }

    const { error: storageError } = await client.storage
      .from(DOCUMENT_CENTER_BUCKET)
      .remove([storagePath]);

    if (storageError) {
      console.warn(
        "[master-documents-server] storage delete failed:",
        storageError.message
      );
      return {
        ok: false,
        error: "storage_delete_failed",
        storageDeleted: false,
        dbDeleted: false,
      };
    }

    storageDeleted = true;
  }

  const { error: dbError } = await client
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", verified.row.id)
    .eq("building_id", verified.row.building_id);

  if (dbError) {
    console.warn(
      "[master-documents-server] db delete failed after storage delete:",
      dbError.message
    );
    return {
      ok: false,
      error: "db_delete_failed",
      storageDeleted,
      dbDeleted: false,
      partialFailure: storageDeleted,
    };
  }

  return {
    ok: true,
    error: null,
    storageDeleted,
    dbDeleted: true,
  };
}
