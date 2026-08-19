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
  DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE,
  type InspectorLetterStage,
  type InspectorNotificationType,
} from "@/lib/document-inspector-notifications";
import {
  buildDocumentInspectorMetaInsertRow,
  DOCUMENT_INSPECTOR_META_TABLE,
  type DocumentInspectorMetaRecord,
} from "@/lib/document-inspector-meta";
import {
  extractInspectorReportStoragePath,
  INSPECTOR_REPORTS_BUCKET,
  INSPECTOR_REPORTS_TABLE,
  type InspectorReportSource,
} from "@/lib/inspector-report-tracking";
import { parseDocumentId } from "@/lib/master-documents-server";
import {
  MASTER_LETTER_METADATA_KEY,
  MASTER_LETTER_METADATA_SCHEMA_VERSION,
} from "@/lib/master-letter-metadata";
import { MASTER_LETTER_TAG } from "@/lib/master-letters";
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

export const BUILDING_FORBIDDEN_ERROR = "building_forbidden";

const INSPECTOR_REPORT_MUTATION_COLUMNS =
  "id, building_id, document_type, storage_path, file_url";

const INSPECTOR_REPORT_LIST_COLUMNS =
  "id, building_id, document_type, title, file_name, file_url, tags, visibility, created_at";

const INSPECTOR_DOCUMENT_READ_COLUMNS =
  "id, building_id, elevator_id, title, file_url";

const INSPECTOR_META_READ_COLUMNS =
  "document_id, report_date, inspector_name, has_remarks, deadline_at, next_inspection_date, status, closed_at, closure_notes";

const LEGACY_INSPECTOR_REPORT_READ_COLUMNS =
  "id, building_id, elevator_id, report_date, inspector_name, document_name, document_url, file_url, has_remarks, deadline_at, status, closed_at, closure_notes";

const INSPECTOR_NOTIFICATION_READ_COLUMNS =
  "document_id, notification_type, sent_at";

const PREPARED_LETTER_READ_COLUMNS = "id, tags, ai_metadata";

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

export interface MasterInspectorReportListItemDto {
  id: string;
  document_id: string | null;
  source: InspectorReportSource;
  building_id: string;
  elevator_id: string | null;
  report_date: string;
  inspector_name: string | null;
  document_name: string | null;
  file_url: string | null;
  document_url: string | null;
  has_remarks: boolean;
  deadline_at: string | null;
  next_inspection_date: string | null;
  status: InspectorReportStatus;
  closed_at: string | null;
  closure_notes: string | null;
}

export interface MasterInspectorNotificationDto {
  document_id: string;
  notification_type: InspectorNotificationType;
  sent_at: string;
}

export interface MasterPreparedInspectorLetterStageDto {
  reportDocumentId: string;
  letterStage: InspectorLetterStage;
}

export interface MasterInspectorReportsListResult {
  reports: MasterInspectorReportListItemDto[];
  notifications: MasterInspectorNotificationDto[];
  preparedLetterStages: MasterPreparedInspectorLetterStageDto[];
  inspectorMetaDocumentIds: string[];
  error: string | null;
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

function isInspectorNotificationTypeValue(
  value: string
): value is InspectorNotificationType {
  return (
    value === "day_35" ||
    value === "day_40" ||
    value === "day_45_plus" ||
    value === "letter_1" ||
    value === "letter_2" ||
    value === "letter_3"
  );
}

function isInspectorLetterStageValue(value: string): value is InspectorLetterStage {
  return value === "letter_1" || value === "letter_2" || value === "letter_3";
}

function extractPreparedLetterStageFromAiMetadata(
  aiMetadata: unknown
): MasterPreparedInspectorLetterStageDto | null {
  if (!aiMetadata || typeof aiMetadata !== "object") return null;

  const envelope = aiMetadata as Record<string, unknown>;
  const letter = envelope[MASTER_LETTER_METADATA_KEY];
  if (!letter || typeof letter !== "object") return null;

  const data = letter as Record<string, unknown>;
  if (Number(data.schemaVersion) !== MASTER_LETTER_METADATA_SCHEMA_VERSION) {
    return null;
  }

  const followUpRaw = data.inspectorFollowUp;
  if (!followUpRaw || typeof followUpRaw !== "object") return null;

  const followUp = followUpRaw as Record<string, unknown>;
  const reportDocumentId = String(followUp.reportDocumentId ?? "").trim();
  const letterStage = String(followUp.letterStage ?? "").trim();
  if (!reportDocumentId || !isInspectorLetterStageValue(letterStage)) {
    return null;
  }

  return { reportDocumentId, letterStage };
}

function mapLegacyInspectorReportListItem(
  row: Record<string, unknown>,
  buildingId: string
): MasterInspectorReportListItemDto {
  const reportDate = String(row.report_date);
  const normalizedReportDate = reportDate.includes("T")
    ? reportDate.split("T")[0]
    : reportDate;

  return {
    id: String(row.id),
    document_id: null,
    source: "legacy",
    building_id: buildingId,
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    report_date: normalizedReportDate,
    inspector_name: row.inspector_name ? String(row.inspector_name) : null,
    document_name: row.document_name ? String(row.document_name) : null,
    file_url: row.file_url ? String(row.file_url) : null,
    document_url: row.document_url ? String(row.document_url) : null,
    has_remarks: Boolean(row.has_remarks),
    deadline_at: row.deadline_at ? String(row.deadline_at) : null,
    next_inspection_date: null,
    status: row.status === "closed" ? "closed" : "open",
    closed_at: row.closed_at ? String(row.closed_at) : null,
    closure_notes: row.closure_notes ? String(row.closure_notes) : null,
  };
}

function mapDocumentInspectorReportListItem(
  documentRow: Record<string, unknown>,
  meta: DocumentInspectorMetaRecord,
  buildingId: string
): MasterInspectorReportListItemDto {
  return {
    id: String(documentRow.id),
    document_id: String(documentRow.id),
    source: "document",
    building_id: buildingId,
    elevator_id: documentRow.elevator_id
      ? String(documentRow.elevator_id)
      : null,
    report_date: meta.report_date,
    inspector_name: meta.inspector_name,
    document_name: String(documentRow.title ?? ""),
    file_url: String(documentRow.file_url ?? "") || null,
    document_url: null,
    has_remarks: meta.has_remarks,
    deadline_at: meta.deadline_at,
    next_inspection_date: meta.next_inspection_date,
    status: meta.status,
    closed_at: meta.closed_at,
    closure_notes: meta.closure_notes,
  };
}

async function listDocumentBasedInspectorReportsForBuildingServer(
  buildingId: string
): Promise<{
  reports: MasterInspectorReportListItemDto[];
  inspectorMetaDocumentIds: string[];
  documentIds: string[];
  error: string | null;
}> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      reports: [],
      inspectorMetaDocumentIds: [],
      documentIds: [],
      error: "supabase_service_unconfigured",
    };
  }

  const { data: documentRows, error: documentError } = await client
    .from(DOCUMENTS_TABLE)
    .select(INSPECTOR_DOCUMENT_READ_COLUMNS)
    .eq("building_id", buildingId)
    .eq("document_type", "inspector_report")
    .order("created_at", { ascending: false });

  if (documentError) {
    console.warn(
      "[master-inspector-reports-server] document list failed:",
      documentError.message
    );
    return {
      reports: [],
      inspectorMetaDocumentIds: [],
      documentIds: [],
      error: documentError.message || "list_failed",
    };
  }

  const documents = (documentRows ?? []) as Record<string, unknown>[];
  const documentIds = documents.map((row) => String(row.id));
  if (documentIds.length === 0) {
    return {
      reports: [],
      inspectorMetaDocumentIds: [],
      documentIds: [],
      error: null,
    };
  }

  const { data: metaRows, error: metaError } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .select(INSPECTOR_META_READ_COLUMNS)
    .in("document_id", documentIds);

  if (metaError) {
    console.warn(
      "[master-inspector-reports-server] meta list failed:",
      metaError.message
    );
    return {
      reports: [],
      inspectorMetaDocumentIds: [],
      documentIds: [],
      error: metaError.message || "list_failed",
    };
  }

  const metaByDocumentId = new Map<string, DocumentInspectorMetaRecord>();
  for (const row of metaRows ?? []) {
    const meta = mapDocumentInspectorMetaRow(row as Record<string, unknown>);
    metaByDocumentId.set(meta.document_id, meta);
  }

  const reports: MasterInspectorReportListItemDto[] = [];
  const inspectorMetaDocumentIds: string[] = [];

  for (const documentRow of documents) {
    const documentId = String(documentRow.id);
    const meta = metaByDocumentId.get(documentId);
    if (!meta) continue;
    inspectorMetaDocumentIds.push(documentId);
    reports.push(
      mapDocumentInspectorReportListItem(documentRow, meta, buildingId)
    );
  }

  reports.sort((a, b) => b.report_date.localeCompare(a.report_date));

  return {
    reports,
    inspectorMetaDocumentIds,
    documentIds,
    error: null,
  };
}

async function listLegacyInspectorReportsForBuildingServer(
  buildingId: string
): Promise<{ reports: MasterInspectorReportListItemDto[]; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { reports: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .select(LEGACY_INSPECTOR_REPORT_READ_COLUMNS)
    .eq("building_id", buildingId)
    .order("report_date", { ascending: false });

  if (error) {
    console.warn(
      "[master-inspector-reports-server] legacy list failed:",
      error.message
    );
    return { reports: [], error: error.message || "list_failed" };
  }

  const reports = (data ?? []).map((row) =>
    mapLegacyInspectorReportListItem(row as Record<string, unknown>, buildingId)
  );

  return { reports, error: null };
}

async function listInspectorNotificationsForBuildingDocumentIds(
  documentIds: string[]
): Promise<{ notifications: MasterInspectorNotificationDto[]; error: string | null }> {
  if (documentIds.length === 0) {
    return { notifications: [], error: null };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { notifications: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE)
    .select(INSPECTOR_NOTIFICATION_READ_COLUMNS)
    .in("document_id", documentIds)
    .order("sent_at", { ascending: false });

  if (error) {
    console.warn(
      "[master-inspector-reports-server] notifications list failed:",
      error.message
    );
    return { notifications: [], error: error.message || "list_failed" };
  }

  const notifications: MasterInspectorNotificationDto[] = [];
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const notificationType = String(record.notification_type);
    if (!isInspectorNotificationTypeValue(notificationType)) continue;
    notifications.push({
      document_id: String(record.document_id),
      notification_type: notificationType,
      sent_at: String(record.sent_at),
    });
  }

  return { notifications, error: null };
}

async function listPreparedInspectorLetterStagesForBuildingServer(
  buildingId: string
): Promise<{
  preparedLetterStages: MasterPreparedInspectorLetterStageDto[];
  error: string | null;
}> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      preparedLetterStages: [],
      error: "supabase_service_unconfigured",
    };
  }

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select(PREPARED_LETTER_READ_COLUMNS)
    .eq("building_id", buildingId);

  if (error) {
    console.warn(
      "[master-inspector-reports-server] prepared letter list failed:",
      error.message
    );
    return { preparedLetterStages: [], error: error.message || "list_failed" };
  }

  const preparedLetterStages: MasterPreparedInspectorLetterStageDto[] = [];
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const rawTags = record.tags;
    const tags = Array.isArray(rawTags)
      ? rawTags.map((tag) => String(tag).trim())
      : [];
    if (!tags.includes(MASTER_LETTER_TAG)) continue;

    const stage = extractPreparedLetterStageFromAiMetadata(record.ai_metadata);
    if (stage) {
      preparedLetterStages.push(stage);
    }
  }

  return { preparedLetterStages, error: null };
}

async function listBuildingDocumentIdsServer(
  buildingId: string
): Promise<{ documentIds: string[]; error: string | null }> {
  const client = getSupabaseServiceClient();
  if (!client) {
    return { documentIds: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select("id")
    .eq("building_id", buildingId);

  if (error) {
    console.warn(
      "[master-inspector-reports-server] building document ids failed:",
      error.message
    );
    return { documentIds: [], error: error.message || "list_failed" };
  }

  return {
    documentIds: (data ?? []).map((row) =>
      String((row as Record<string, unknown>).id)
    ),
    error: null,
  };
}

export function parseInspectorReportId(value: unknown): string | null {
  return parseDocumentId(value);
}

type InspectorReportBuildingVerifyResult =
  | {
      ok: true;
      source: "document";
      reportId: string;
      buildingId: string;
      storagePath: string;
    }
  | {
      ok: true;
      source: "legacy";
      reportId: string;
      buildingId: string;
      fileUrl: string | null;
    }
  | {
      ok: false;
      error:
        | "not_found"
        | typeof BUILDING_FORBIDDEN_ERROR
        | "invalid_building_id"
        | "invalid_report_id"
        | "supabase_service_unconfigured";
    };

function isStoragePathOwnedByBuilding(
  storagePath: string,
  buildingId: string
): boolean {
  const normalized = buildingId.trim().toLowerCase();
  const path = storagePath.trim();
  if (!path || path.includes("..") || path.startsWith("/")) return false;
  return path.startsWith(`${normalized}/`);
}

async function verifyInspectorReportBuildingServer(
  reportId: string,
  buildingId: string
): Promise<InspectorReportBuildingVerifyResult> {
  const expectedBuilding = parseBuildingIdFilter(buildingId);
  if (!expectedBuilding) {
    return { ok: false, error: "invalid_building_id" };
  }

  const parsedReportId = parseInspectorReportId(reportId);
  if (!parsedReportId) {
    return { ok: false, error: "invalid_report_id" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const { data: documentRow, error: documentError } = await client
    .from(DOCUMENTS_TABLE)
    .select(INSPECTOR_REPORT_MUTATION_COLUMNS)
    .eq("id", parsedReportId)
    .maybeSingle();

  if (documentError) {
    console.warn(
      "[master-inspector-reports-server] report verify document lookup failed:",
      documentError.message
    );
    return { ok: false, error: "not_found" };
  }

  if (
    documentRow &&
    String((documentRow as Record<string, unknown>).document_type) ===
      "inspector_report"
  ) {
    const row = documentRow as Record<string, unknown>;
    const rowBuilding = String(row.building_id ?? "").trim().toLowerCase();
    if (rowBuilding !== expectedBuilding) {
      return { ok: false, error: BUILDING_FORBIDDEN_ERROR };
    }

    const { data: metaRow, error: metaError } = await client
      .from(DOCUMENT_INSPECTOR_META_TABLE)
      .select("document_id")
      .eq("document_id", parsedReportId)
      .maybeSingle();

    if (metaError || !metaRow) {
      return { ok: false, error: "not_found" };
    }

    return {
      ok: true,
      source: "document",
      reportId: parsedReportId,
      buildingId: rowBuilding,
      storagePath: String(row.storage_path ?? "").trim(),
    };
  }

  const { data: legacyRow, error: legacyError } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .select("id, building_id, file_url")
    .eq("id", parsedReportId)
    .maybeSingle();

  if (legacyError) {
    console.warn(
      "[master-inspector-reports-server] report verify legacy lookup failed:",
      legacyError.message
    );
    return { ok: false, error: "not_found" };
  }

  if (legacyRow) {
    const row = legacyRow as Record<string, unknown>;
    const rowBuilding = String(row.building_id ?? "").trim().toLowerCase();
    if (rowBuilding !== expectedBuilding) {
      return { ok: false, error: BUILDING_FORBIDDEN_ERROR };
    }

    return {
      ok: true,
      source: "legacy",
      reportId: parsedReportId,
      buildingId: rowBuilding,
      fileUrl: row.file_url ? String(row.file_url) : null,
    };
  }

  return { ok: false, error: "not_found" };
}

async function deleteLegacyInspectorReportStorageFileServer(
  fileUrl: string | null
): Promise<boolean> {
  if (!fileUrl?.trim()) return true;

  const storagePath = extractInspectorReportStoragePath(fileUrl);
  if (!storagePath) return true;

  const client = getSupabaseServiceClient();
  if (!client) return false;

  const { error } = await client.storage
    .from(INSPECTOR_REPORTS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn(
      "[master-inspector-reports-server] legacy storage delete failed:",
      error.message
    );
    return false;
  }

  return true;
}

export interface MasterInspectorReportMutationResult {
  ok: boolean;
  report: MasterInspectorReportListItemDto | null;
  error: string | null;
}

export async function closeMasterInspectorReportServer(
  reportId: string,
  buildingId: string,
  closureNotes?: string | null
): Promise<MasterInspectorReportMutationResult> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, report: null, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyInspectorReportBuildingServer(reportId, buildingId);
  if (!verified.ok) {
    return { ok: false, report: null, error: verified.error };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, report: null, error: "supabase_service_unconfigured" };
  }

  const closedAt = new Date().toISOString();
  const normalizedClosureNotes = closureNotes?.trim() || null;

  if (verified.source === "document") {
    const { data, error } = await client
      .from(DOCUMENT_INSPECTOR_META_TABLE)
      .update({
        status: "closed",
        closed_at: closedAt,
        closure_notes: normalizedClosureNotes,
        updated_at: closedAt,
      })
      .eq("document_id", verified.reportId)
      .select(INSPECTOR_META_READ_COLUMNS)
      .single();

    if (error || !data) {
      console.warn(
        "[master-inspector-reports-server] close document meta failed:",
        error?.message
      );
      return { ok: false, report: null, error: error?.message || "close_failed" };
    }

    const { data: documentRow, error: documentError } = await client
      .from(DOCUMENTS_TABLE)
      .select(INSPECTOR_DOCUMENT_READ_COLUMNS)
      .eq("id", verified.reportId)
      .eq("building_id", verified.buildingId)
      .single();

    if (documentError || !documentRow) {
      return { ok: false, report: null, error: "close_failed" };
    }

    const meta = mapDocumentInspectorMetaRow(data as Record<string, unknown>);
    return {
      ok: true,
      report: mapDocumentInspectorReportListItem(
        documentRow as Record<string, unknown>,
        meta,
        verified.buildingId
      ),
      error: null,
    };
  }

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .update({
      status: "closed",
      closed_at: closedAt,
      closure_notes: normalizedClosureNotes,
    })
    .eq("id", verified.reportId)
    .eq("building_id", verified.buildingId)
    .select(LEGACY_INSPECTOR_REPORT_READ_COLUMNS)
    .single();

  if (error || !data) {
    console.warn(
      "[master-inspector-reports-server] close legacy report failed:",
      error?.message
    );
    return { ok: false, report: null, error: error?.message || "close_failed" };
  }

  return {
    ok: true,
    report: mapLegacyInspectorReportListItem(
      data as Record<string, unknown>,
      verified.buildingId
    ),
    error: null,
  };
}

export async function deleteMasterInspectorReportServer(
  reportId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  const verified = await verifyInspectorReportBuildingServer(reportId, buildingId);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "supabase_service_unconfigured" };
  }

  if (verified.source === "document") {
    if (verified.storagePath) {
      if (!isStoragePathOwnedByBuilding(verified.storagePath, verified.buildingId)) {
        return { ok: false, error: "invalid_storage_path" };
      }
      await deleteInspectorReportStorageFile(verified.storagePath);
    }

    const { error } = await client
      .from(DOCUMENTS_TABLE)
      .delete()
      .eq("id", verified.reportId)
      .eq("building_id", verified.buildingId);

    if (error) {
      console.warn(
        "[master-inspector-reports-server] delete document report failed:",
        error.message
      );
      return { ok: false, error: error.message || "delete_failed" };
    }

    return { ok: true, error: null };
  }

  await deleteLegacyInspectorReportStorageFileServer(verified.fileUrl);

  const { error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .delete()
    .eq("id", verified.reportId)
    .eq("building_id", verified.buildingId);

  if (error) {
    console.warn(
      "[master-inspector-reports-server] delete legacy report failed:",
      error.message
    );
    return { ok: false, error: error.message || "delete_failed" };
  }

  return { ok: true, error: null };
}

export async function listMasterInspectorReportsByBuildingServer(
  buildingId: string
): Promise<MasterInspectorReportsListResult> {
  if (!isSupabaseServiceConfigured()) {
    return {
      reports: [],
      notifications: [],
      preparedLetterStages: [],
      inspectorMetaDocumentIds: [],
      error: "supabase_service_unconfigured",
    };
  }

  const normalizedBuilding = parseBuildingIdFilter(buildingId);
  if (!normalizedBuilding) {
    return {
      reports: [],
      notifications: [],
      preparedLetterStages: [],
      inspectorMetaDocumentIds: [],
      error: "invalid_building_id",
    };
  }

  const [
    documentBased,
    legacy,
    buildingDocuments,
    preparedLetters,
  ] = await Promise.all([
    listDocumentBasedInspectorReportsForBuildingServer(normalizedBuilding),
    listLegacyInspectorReportsForBuildingServer(normalizedBuilding),
    listBuildingDocumentIdsServer(normalizedBuilding),
    listPreparedInspectorLetterStagesForBuildingServer(normalizedBuilding),
  ]);

  const errors = [
    documentBased.error,
    legacy.error,
    buildingDocuments.error,
    preparedLetters.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    return {
      reports: [],
      notifications: [],
      preparedLetterStages: [],
      inspectorMetaDocumentIds: [],
      error: errors[0] ?? "list_failed",
    };
  }

  const notificationsResult =
    await listInspectorNotificationsForBuildingDocumentIds(
      buildingDocuments.documentIds
    );

  if (notificationsResult.error) {
    return {
      reports: [],
      notifications: [],
      preparedLetterStages: [],
      inspectorMetaDocumentIds: [],
      error: notificationsResult.error,
    };
  }

  const reports = [...documentBased.reports, ...legacy.reports].sort((a, b) =>
    b.report_date.localeCompare(a.report_date)
  );

  return {
    reports,
    notifications: notificationsResult.notifications,
    preparedLetterStages: preparedLetters.preparedLetterStages,
    inspectorMetaDocumentIds: documentBased.inspectorMetaDocumentIds,
    error: null,
  };
}
