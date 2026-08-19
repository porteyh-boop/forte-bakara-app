import {
  buildDocumentInsertRow,
  buildDocumentInsertRowWithoutVisibilityColumn,
  buildDocumentPublicUrl,
  buildDocumentStoragePath,
  DOCUMENT_CENTER_BUCKET,
  DOCUMENTS_TABLE,
  DOCUMENT_TAG_INSPECTOR_REPORT,
  DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR,
  isMissingVisibilityColumnError,
  normalizeDocumentTags,
  resolveDocumentContentType,
  type CreateDocumentInput,
} from "@/lib/document-center";
import {
  buildDocumentInspectorMetaInsertRow,
  DOCUMENT_INSPECTOR_META_TABLE,
  type DocumentInspectorMetaRecord,
} from "@/lib/document-inspector-meta";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import { isValidIsoDate } from "@/lib/israeli-date-input";
import {
  INSPECTOR_REPORT_MAX_FILE_BYTES,
  validateInspectorReportFile,
  validateInspectorReportInput,
  type CreateInspectorReportInput,
  type InspectorReportStatus,
} from "@/lib/inspector-report-tracking";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const ELEVATORS_TABLE = "elevators";

const INSPECTOR_REPORT_LIST_COLUMNS =
  "id, building_id, document_type, title, file_name, file_url, tags, visibility, created_at";

export interface MasterInspectorReportCreateInput {
  buildingId: string;
  elevatorId?: string | null;
  documentName: string;
  reportDate: string;
  inspectorName?: string;
  hasRemarks: boolean;
  nextInspectionDate?: string | null;
  fileName: string;
  fileBuffer: Buffer;
  mimeType?: string;
  fileSizeBytes: number;
}

export interface MasterInspectorReportDto {
  id: string;
  document_id: string;
  building_id: string;
  elevator_id: string | null;
  report_date: string;
  inspector_name: string | null;
  document_name: string | null;
  file_url: string | null;
  has_remarks: boolean;
  deadline_at: string | null;
  next_inspection_date: string | null;
  status: InspectorReportStatus;
  closed_at: string | null;
  closure_notes: string | null;
  created_at: string;
}

export interface MasterInspectorReportCreateResult {
  report: MasterInspectorReportDto | null;
  error: string | null;
  cleanupFailed?: boolean;
  partialCleanup?: {
    storageDeleted?: boolean;
    documentDeleted?: boolean;
  };
}

function normalizeOptionalElevatorId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function parseHasRemarks(value: unknown): boolean | null {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

function normalizeOptionalDate(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.split("T")[0];
}

function mapDocumentInspectorMetaRow(
  row: Record<string, unknown>
): DocumentInspectorMetaRecord {
  const reportDate = String(row.report_date);
  return {
    document_id: String(row.document_id),
    report_date: reportDate.includes("T") ? reportDate.split("T")[0] : reportDate,
    inspector_name: row.inspector_name ? String(row.inspector_name) : null,
    has_remarks: Boolean(row.has_remarks),
    deadline_at: row.deadline_at ? String(row.deadline_at) : null,
    next_inspection_date: row.next_inspection_date
      ? normalizeOptionalDate(row.next_inspection_date)
      : null,
    status: row.status === "closed" ? "closed" : "open",
    closed_at: row.closed_at ? String(row.closed_at) : null,
    closure_notes: row.closure_notes ? String(row.closure_notes) : null,
    legacy_inspector_report_id: row.legacy_inspector_report_id
      ? String(row.legacy_inspector_report_id)
      : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapMasterInspectorReportDto(
  documentRow: Record<string, unknown>,
  meta: DocumentInspectorMetaRecord
): MasterInspectorReportDto {
  return {
    id: String(documentRow.id),
    document_id: String(documentRow.id),
    building_id: String(documentRow.building_id).trim().toLowerCase(),
    elevator_id: documentRow.elevator_id
      ? String(documentRow.elevator_id)
      : null,
    report_date: meta.report_date,
    inspector_name: meta.inspector_name,
    document_name: String(documentRow.title ?? ""),
    file_url: String(documentRow.file_url ?? "") || null,
    has_remarks: meta.has_remarks,
    deadline_at: meta.deadline_at,
    next_inspection_date: meta.next_inspection_date,
    status: meta.status,
    closed_at: meta.closed_at,
    closure_notes: meta.closure_notes,
    created_at: String(documentRow.created_at ?? ""),
  };
}

async function deleteInspectorReportStorageFile(
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
      "[master-inspector-reports-server] storage cleanup failed:",
      error.message
    );
    return false;
  }

  return true;
}

async function deleteInspectorReportDocumentRow(
  documentId: string,
  buildingId: string
): Promise<boolean> {
  const client = getSupabaseServiceClient();
  if (!client) return false;

  const { error } = await client
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", documentId)
    .eq("building_id", buildingId);

  if (error) {
    console.warn(
      "[master-inspector-reports-server] document cleanup failed:",
      error.message
    );
    return false;
  }

  return true;
}

async function insertInspectorDocumentRow(
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
    .select(INSPECTOR_REPORT_LIST_COLUMNS)
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
      .select(INSPECTOR_REPORT_LIST_COLUMNS)
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

async function insertInspectorMetaRow(input: {
  documentId: string;
  reportDate: string;
  inspectorName?: string;
  hasRemarks: boolean;
  nextInspectionDate?: string | null;
}): Promise<{ meta: DocumentInspectorMetaRecord | null; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { meta: null, error: "supabase_service_unconfigured" };
  }

  const row = buildDocumentInspectorMetaInsertRow(input);
  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    return {
      meta: null,
      error: error?.message || "meta_insert_failed",
    };
  }

  return {
    meta: mapDocumentInspectorMetaRow(data as Record<string, unknown>),
    error: null,
  };
}

export async function verifyElevatorBelongsToBuildingServer(
  elevatorId: string,
  buildingId: string
): Promise<boolean> {
  const client = getSupabaseServiceClient();
  if (!client) return false;

  const { data, error } = await client
    .from(ELEVATORS_TABLE)
    .select("elevator_id")
    .eq("building_id", buildingId)
    .eq("elevator_id", elevatorId)
    .eq("is_active", true)
    .maybeSingle();

  return !error && Boolean(data);
}

export function validateMasterInspectorReportCreateMetadata(input: {
  buildingId: string;
  elevatorId?: unknown;
  documentName: unknown;
  reportDate: unknown;
  inspectorName?: unknown;
  hasRemarks: unknown;
  nextInspectionDate?: unknown;
  fileName: string;
  mimeType?: string;
  fileSizeBytes: number;
}): string | null {
  const normalizedBuilding = parseBuildingIdFilter(input.buildingId);
  if (!normalizedBuilding) return "invalid_building_id";

  const documentName = String(input.documentName ?? "").trim();
  if (!documentName) return "missing_title";

  const reportDate = normalizeOptionalDate(input.reportDate);
  if (!reportDate || !isValidIsoDate(reportDate)) return "invalid_report_date";

  const nextInspectionDate = normalizeOptionalDate(input.nextInspectionDate);
  if (nextInspectionDate && !isValidIsoDate(nextInspectionDate)) {
    return "invalid_next_inspection_date";
  }

  const hasRemarks = parseHasRemarks(input.hasRemarks);
  if (hasRemarks === null) return "invalid_has_remarks";

  const elevatorId = normalizeOptionalElevatorId(input.elevatorId);
  if (input.elevatorId !== undefined && input.elevatorId !== null) {
    const raw = String(input.elevatorId).trim();
    if (raw && !elevatorId) return "invalid_elevator_id";
  }

  const fileValidationError = validateInspectorReportFile({
    name: input.fileName,
    type: input.mimeType ?? "",
    size: input.fileSizeBytes,
  });
  if (fileValidationError) return fileValidationError;

  if (input.fileSizeBytes > INSPECTOR_REPORT_MAX_FILE_BYTES) {
    return "file_too_large";
  }

  const inspectorInput: CreateInspectorReportInput = {
    buildingId: normalizedBuilding,
    elevatorId,
    reportDate,
    inspectorName: String(input.inspectorName ?? "").trim() || undefined,
    documentName,
    fileUrl: "server-upload",
    hasRemarks,
    nextInspectionDate,
  };

  const businessValidationError = validateInspectorReportInput(inspectorInput);
  if (businessValidationError) return "invalid_metadata";

  const contentTypeResult = resolveDocumentContentType(
    input.fileName,
    input.mimeType ?? ""
  );
  if (!contentTypeResult.ok) return contentTypeResult.error;
  if (contentTypeResult.contentType === "application/octet-stream") {
    return DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR;
  }

  return null;
}

export async function createMasterInspectorReportServer(
  input: MasterInspectorReportCreateInput
): Promise<MasterInspectorReportCreateResult> {
  if (!isSupabaseServiceConfigured()) {
    return { report: null, error: "supabase_service_unconfigured" };
  }

  const normalizedBuilding = parseBuildingIdFilter(input.buildingId);
  if (!normalizedBuilding) {
    return { report: null, error: "invalid_building_id" };
  }

  const metadataError = validateMasterInspectorReportCreateMetadata({
    buildingId: normalizedBuilding,
    elevatorId: input.elevatorId,
    documentName: input.documentName,
    reportDate: input.reportDate,
    inspectorName: input.inspectorName,
    hasRemarks: input.hasRemarks,
    nextInspectionDate: input.nextInspectionDate,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
  });
  if (metadataError) {
    return { report: null, error: metadataError };
  }

  const elevatorId = normalizeOptionalElevatorId(input.elevatorId);
  if (elevatorId) {
    const elevatorOk = await verifyElevatorBelongsToBuildingServer(
      elevatorId,
      normalizedBuilding
    );
    if (!elevatorOk) {
      return { report: null, error: "invalid_elevator_for_building" };
    }
  }

  const contentTypeResult = resolveDocumentContentType(
    input.fileName,
    input.mimeType ?? ""
  );
  if (!contentTypeResult.ok) {
    return { report: null, error: contentTypeResult.error };
  }

  const contentType = contentTypeResult.contentType;
  const storagePath = buildDocumentStoragePath(
    normalizedBuilding,
    input.fileName,
    contentType
  );

  if (!storagePath.startsWith(`${normalizedBuilding}/`)) {
    return { report: null, error: "invalid_storage_path" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { report: null, error: "supabase_service_unconfigured" };
  }

  const { error: uploadError } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .upload(storagePath, input.fileBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.warn(
      "[master-inspector-reports-server] storage upload failed:",
      uploadError.message
    );
    return { report: null, error: uploadError.message || "upload_failed" };
  }

  const fileUrl = buildDocumentPublicUrl(storagePath);
  if (!fileUrl) {
    const storageDeleted = await deleteInspectorReportStorageFile(storagePath);
    return {
      report: null,
      error: "public_url_failed",
      cleanupFailed: !storageDeleted,
    };
  }

  const documentTitle = input.documentName.trim();
  const createInput: CreateDocumentInput = {
    buildingId: normalizedBuilding,
    elevatorId,
    documentType: "inspector_report",
    title: documentTitle,
    fileName: input.fileName.trim(),
    fileUrl,
    storagePath,
    mimeType: contentType,
    fileSizeBytes: input.fileSizeBytes,
    tags: normalizeDocumentTags([DOCUMENT_TAG_INSPECTOR_REPORT]),
    visibility: "internal",
  };

  const insertDocumentResult = await insertInspectorDocumentRow(createInput);
  if (!insertDocumentResult.row) {
    const storageDeleted = await deleteInspectorReportStorageFile(storagePath);
    return {
      report: null,
      error: insertDocumentResult.error ?? "insert_failed",
      cleanupFailed: !storageDeleted,
      partialCleanup: { storageDeleted },
    };
  }

  const documentId = String(insertDocumentResult.row.id);
  const metaResult = await insertInspectorMetaRow({
    documentId,
    reportDate: normalizeOptionalDate(input.reportDate)!,
    inspectorName: input.inspectorName?.trim() || undefined,
    hasRemarks: input.hasRemarks,
    nextInspectionDate: normalizeOptionalDate(input.nextInspectionDate),
  });

  if (!metaResult.meta) {
    const documentDeleted = await deleteInspectorReportDocumentRow(
      documentId,
      normalizedBuilding
    );
    const storageDeleted = await deleteInspectorReportStorageFile(storagePath);
    const cleanupFailed = !documentDeleted || !storageDeleted;

    return {
      report: null,
      error: metaResult.error ?? "meta_insert_failed",
      cleanupFailed,
      partialCleanup: { storageDeleted, documentDeleted },
    };
  }

  return {
    report: mapMasterInspectorReportDto(insertDocumentResult.row, metaResult.meta),
    error: null,
  };
}
