import {
  getPilotSupabaseClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isPilotCloudConfigured,
} from "./pilot-cloud";

/** לוגים מובנים לדיבוג שרשרת העלאה — חפשו ב-Console: [document-center][trace] */
export function traceDocumentCenter(
  step: string,
  data?: Record<string, unknown>
): void {
  console.info("[document-center][trace]", step, data ?? {});
}

export const DOCUMENTS_TABLE = "documents";
export const DOCUMENT_CENTER_BUCKET = "document-center";
export const DOCUMENT_CENTER_MAX_FILE_MB = 50;
export const DOCUMENT_CENTER_MAX_FILE_BYTES =
  DOCUMENT_CENTER_MAX_FILE_MB * 1024 * 1024;

export function getDocumentCenterMaxFileSizeError(): string {
  return `הקובץ גדול מדי (מקסימום ${DOCUMENT_CENTER_MAX_FILE_MB}MB).`;
}

export const DOCUMENT_CENTER_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xlsx",
] as const;

export const DOCUMENT_CENTER_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const DOCUMENT_TYPES = [
  { id: "inspector_report", label: "תסקיר בודק" },
  { id: "contract", label: "חוזה" },
  { id: "certificate", label: "תעודה / אישור" },
  { id: "maintenance", label: "תחזוקה" },
  { id: "invoice", label: "חשבונית" },
  { id: "correspondence", label: "התכתבות" },
  { id: "other", label: "אחר" },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

/** תגיות קבועות לבחירה, סינון והצגה במרכז המסמכים */
export const DOCUMENT_PREDEFINED_TAGS = [
  "תסקיר בודק",
  "הערות בודק",
  "אישור בודק",
  "חוזה שירות",
  "הצעת מחיר",
  "הצעת מחיר למזמין",
  "אישור הצעת מחיר",
  "חשבונית",
  "דוח תקלה",
  "דוח שירות",
  "בדיקת קבלה",
  "מפרט מעלית",
  "תוכנית מעלית",
  "אישור מכון התקנים",
  "בטיחות",
  "שדרוג / מודרניזציה",
  "התכתבויות",
  "תיק מתקן",
  "תמונות",
  "חוות דעת",
  "פיקוח עליון",
  "מכתב",
  "אחר",
] as const;

export type DocumentPredefinedTag = (typeof DOCUMENT_PREDEFINED_TAGS)[number];

export const DOCUMENT_TAG_INSPECTOR_REPORT: DocumentPredefinedTag =
  "תסקיר בודק";

export type DocumentOcrStatus = "none" | "pending" | "ready" | "failed";

export const DOCUMENT_VISIBILITY_OPTIONS = ["internal", "client"] as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITY_OPTIONS)[number];
export const DEFAULT_DOCUMENT_VISIBILITY: DocumentVisibility = "internal";

export interface DocumentRecord {
  id: string;
  building_id: string;
  elevator_id: string | null;
  document_type: DocumentTypeId;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  tags: string[];
  ocr_status: DocumentOcrStatus;
  ocr_text: string | null;
  ai_summary: string | null;
  ai_metadata: Record<string, unknown> | null;
  visibility: DocumentVisibility;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInput {
  buildingId: string;
  elevatorId?: string | null;
  documentType: DocumentTypeId;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  mimeType?: string;
  fileSizeBytes?: number;
  tags?: string[];
  visibility?: DocumentVisibility;
  aiMetadata?: Record<string, unknown> | null;
}

export interface DocumentSearchFilters {
  query?: string;
  buildingId?: string;
  elevatorId?: string;
  documentType?: DocumentTypeId | "";
  tags?: string[];
}

export type DocumentCenterStage = "validation" | "upload" | "insert" | "list";

export type UploadDocumentResult =
  | { ok: true; fileUrl: string; storagePath: string; contentType: string }
  | { ok: false; error: string; details?: string; stage: "upload" | "validation" };

export interface DocumentListResult {
  documents: DocumentRecord[];
  error: string | null;
}

export interface CreateDocumentResult {
  document: DocumentRecord | null;
  error: string | null;
}

export interface UpdateDocumentVisibilityResult {
  document: DocumentRecord | null;
  error: string | null;
}

export const DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR =
  "סוג הקובץ אינו נתמך. יש להעלות PDF או תמונה בפורמט נתמך.";

const DOCUMENT_EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const DOCUMENT_MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

export type ResolveDocumentContentTypeResult =
  | { ok: true; contentType: string }
  | { ok: false; error: string };

function formatSupabaseError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): string {
  const parts = [error.message, error.code, error.details, error.hint].filter(
    Boolean
  );
  const message = parts.join(" · ");
  if (isMissingVisibilityColumnError(error)) {
    return `${message} · ודאו ש-migration 016 הורץ ב-Supabase SQL Editor`;
  }
  if (
    message.toLowerCase().includes("bucket not found") ||
    message.includes("document-center")
  ) {
    return `${message} · ודאו ש-migrations 008/010 הורצו ב-Supabase`;
  }
  if (error.code === "42P01" || message.includes("documents")) {
    return `${message} · ודאו ש-migration 008 הורץ ב-Supabase`;
  }
  return message || "שגיאה לא ידועה";
}

export function isMissingVisibilityColumnError(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): boolean {
  const message = [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    message.includes("visibility") &&
    (message.includes("column") ||
      message.includes("schema cache") ||
      error.code === "PGRST204")
  );
}

export function formatStorageUploadUserError(responseText: string): string {
  const lower = responseText.toLowerCase();
  if (lower.includes("bucket not found")) {
    return "Bucket document-center לא נמצא. הריצו migration 010 ב-Supabase SQL Editor.";
  }
  if (
    lower.includes("mime") ||
    lower.includes("content type") ||
    lower.includes("invalidrequest")
  ) {
    return "סוג הקובץ נדחה על ידי האחסון. ודאו PDF/JPG/PNG/DOCX/XLSX בלבד.";
  }
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return "אין הרשאת העלאה ל-Storage. הריצו migration 009 ב-Supabase SQL Editor.";
  }
  if (lower.includes("payload too large") || lower.includes("file_size_limit")) {
    return getDocumentCenterMaxFileSizeError();
  }
  return responseText.trim() || "שגיאת העלאה לא ידועה";
}

export function generateDocumentFileId(now: Date = new Date()): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function resolveDocumentContentType(
  fileName: string,
  fileType = ""
): ResolveDocumentContentTypeResult {
  const normalizedType = fileType.trim().toLowerCase();
  if (
    normalizedType &&
    DOCUMENT_CENTER_ALLOWED_MIME_TYPES.includes(
      normalizedType as (typeof DOCUMENT_CENTER_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return { ok: true, contentType: normalizedType };
  }

  const extension = getDocumentFileExtension(fileName);
  const fromExtension = DOCUMENT_EXTENSION_MIME_MAP[extension];
  if (fromExtension) {
    return { ok: true, contentType: fromExtension };
  }

  return { ok: false, error: DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR };
}

export function resolveStorageExtension(
  fileName: string,
  contentType: string
): string {
  const fromName = getDocumentFileExtension(fileName);
  if (fromName && DOCUMENT_EXTENSION_MIME_MAP[fromName]) {
    return fromName;
  }
  return DOCUMENT_MIME_TO_EXTENSION[contentType] ?? ".bin";
}

export function formatStorageUploadFailureDetails(params: {
  contentType: string;
  storagePath: string;
  responseText: string;
}): string {
  return [
    "העלאת הקובץ נכשלה",
    `contentType: ${params.contentType}`,
    `storagePath: ${params.storagePath}`,
    `Supabase: ${params.responseText}`,
  ].join("\n");
}

export function buildDocumentInsertRow(input: CreateDocumentInput) {
  const now = new Date().toISOString();
  const visibility = normalizeDocumentVisibility(input.visibility);
  return {
    building_id: input.buildingId.trim().toLowerCase(),
    elevator_id: input.elevatorId?.trim() || null,
    document_type: input.documentType,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    file_name: input.fileName.trim(),
    file_url: input.fileUrl.trim(),
    storage_path: input.storagePath.trim(),
    mime_type: input.mimeType?.trim() || null,
    file_size_bytes: input.fileSizeBytes ?? null,
    tags: normalizeDocumentTags(input.tags ?? []),
    ocr_status: "none",
    ocr_text: null,
    ai_summary: null,
    ai_metadata: input.aiMetadata ?? null,
    visibility,
    updated_at: now,
  };
}

/** גיבוי כשעמודת visibility עדיין לא קיימת (לפני migration 016) */
export function buildDocumentInsertRowWithoutVisibilityColumn(
  input: CreateDocumentInput
) {
  const row = buildDocumentInsertRow(input);
  const { visibility, ...withoutVisibility } = row;
  const existingMeta =
    input.aiMetadata && typeof input.aiMetadata === "object"
      ? input.aiMetadata
      : {};
  return {
    ...withoutVisibility,
    ai_metadata: { ...existingMeta, visibility },
  };
}

export function normalizeDocumentVisibility(
  value: unknown
): DocumentVisibility {
  return value === "client" ? "client" : DEFAULT_DOCUMENT_VISIBILITY;
}

export function resolveDocumentVisibility(
  row: Record<string, unknown>
): DocumentVisibility {
  if (row.visibility !== undefined && row.visibility !== null) {
    const columnValue = String(row.visibility).trim();
    if (columnValue === "client" || columnValue === "internal") {
      return columnValue;
    }
  }
  const metadata =
    row.ai_metadata && typeof row.ai_metadata === "object"
      ? (row.ai_metadata as Record<string, unknown>)
      : null;
  return normalizeDocumentVisibility(metadata?.visibility);
}

export function isDocumentVisibleToClient(document: DocumentRecord): boolean {
  return document.visibility === "client";
}

export function filterClientVisibleDocuments(
  documents: DocumentRecord[]
): DocumentRecord[] {
  return documents.filter(isDocumentVisibleToClient);
}

export function getDocumentVisibilityLabel(
  visibility: DocumentVisibility
): string {
  return visibility === "client" ? "גלוי ללקוח" : "פנימי בלבד";
}

export function getDocumentVisibilityBadgeLabel(
  visibility: DocumentVisibility
): string {
  return visibility === "client" ? "👁 גלוי ללקוח" : "🔒 פנימי";
}

export function getDocumentVisibilityChangeMessage(
  nextVisibility: DocumentVisibility
): string {
  return nextVisibility === "client"
    ? "המסמך גלוי כעת ללקוח בפורטל."
    : "המסמך הוגדר כפנימי ואינו מוצג ללקוח.";
}

export function getDocumentUploadVisibilityHint(
  visibility: DocumentVisibility
): string | null {
  return visibility === "internal"
    ? "פנימי — המסמך אינו מוצג בפורטל הלקוח."
    : null;
}

function mapDocumentRow(row: Record<string, unknown>): DocumentRecord {
  const rawTags = row.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const documentType = String(row.document_type ?? "other");
  const knownType = DOCUMENT_TYPES.some((type) => type.id === documentType)
    ? (documentType as DocumentTypeId)
    : "other";

  const ocrStatus = String(row.ocr_status ?? "none");
  const normalizedOcrStatus: DocumentOcrStatus =
    ocrStatus === "pending" ||
    ocrStatus === "ready" ||
    ocrStatus === "failed"
      ? ocrStatus
      : "none";

  return {
    id: String(row.id),
    building_id: String(row.building_id),
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    document_type: knownType,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    file_name: String(row.file_name),
    file_url: String(row.file_url),
    storage_path: String(row.storage_path),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    file_size_bytes:
      row.file_size_bytes === null || row.file_size_bytes === undefined
        ? null
        : Number(row.file_size_bytes),
    tags,
    ocr_status: normalizedOcrStatus,
    ocr_text: row.ocr_text ? String(row.ocr_text) : null,
    ai_summary: row.ai_summary ? String(row.ai_summary) : null,
    ai_metadata:
      row.ai_metadata && typeof row.ai_metadata === "object"
        ? (row.ai_metadata as Record<string, unknown>)
        : null,
    visibility: resolveDocumentVisibility(row),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function isDocumentCenterConfigured(): boolean {
  return isPilotCloudConfigured();
}

export function getDocumentTypeLabel(documentType: string): string {
  return (
    DOCUMENT_TYPES.find((type) => type.id === documentType)?.label ?? "אחר"
  );
}

export function isPredefinedDocumentTag(
  tag: string
): tag is DocumentPredefinedTag {
  return (DOCUMENT_PREDEFINED_TAGS as readonly string[]).includes(tag);
}

export function normalizeDocumentTags(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : input.split(/[,;#]+/);

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of raw) {
    const value = tag.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.sort((a, b) => a.localeCompare(b, "he"));
}

export function normalizePredefinedDocumentTags(input: string[]): string[] {
  return normalizeDocumentTags(input).filter(isPredefinedDocumentTag);
}

export function parseDocumentTagsInput(input: string): string[] {
  return normalizeDocumentTags(input);
}

/** תגיות ישנות שמסוננות יחד עם התגית הקבועה המקבילה */
export const DOCUMENT_TAG_FILTER_EQUIVALENTS: Partial<
  Record<DocumentPredefinedTag, readonly string[]>
> = {
  התכתבויות: ["התכתבות", "התכתבויות"],
};

export function getDocumentTagFilterMatches(filterTag: string): string[] {
  if (isPredefinedDocumentTag(filterTag)) {
    const equivalents = DOCUMENT_TAG_FILTER_EQUIVALENTS[filterTag];
    return equivalents ? [...equivalents] : [filterTag];
  }
  return [filterTag];
}

export function documentHasTagFilter(
  documentTags: string[],
  filterTag: string
): boolean {
  const matches = getDocumentTagFilterMatches(filterTag);
  return matches.some((tag) => documentTags.includes(tag));
}

export function getDocumentLegacyFilterTags(
  documents: DocumentRecord[]
): string[] {
  const predefined = new Set<string>(DOCUMENT_PREDEFINED_TAGS);
  const legacy = new Set<string>();

  for (const document of documents) {
    for (const tag of document.tags) {
      if (predefined.has(tag)) continue;
      if (isPredefinedDocumentTag(tag)) continue;
      legacy.add(tag);
    }
  }

  return Array.from(legacy).sort((a, b) => a.localeCompare(b, "he"));
}

export function getDocumentFilterTagOptions(
  documents: DocumentRecord[] = []
): string[] {
  return [...DOCUMENT_PREDEFINED_TAGS, ...getDocumentLegacyFilterTags(documents)];
}

export function formatDocumentTags(tags: string[]): string {
  return normalizeDocumentTags(tags).join(", ");
}

export function getDocumentFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return "";
  return trimmed.slice(dot);
}

export function validateDocumentCenterFile(
  file: Pick<File, "name" | "type" | "size">
): string | null {
  const extension = getDocumentFileExtension(file.name);
  const mimeAllowed =
    file.type &&
    DOCUMENT_CENTER_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof DOCUMENT_CENTER_ALLOWED_MIME_TYPES)[number]
    );
  const extensionAllowed = DOCUMENT_CENTER_ALLOWED_EXTENSIONS.includes(
    extension as (typeof DOCUMENT_CENTER_ALLOWED_EXTENSIONS)[number]
  );

  if (!mimeAllowed && !extensionAllowed) {
    return "סוג קובץ לא נתמך. ניתן להעלות PDF, JPG, PNG, DOC, DOCX או XLSX.";
  }
  if (file.size <= 0) return "הקובץ ריק.";
  if (file.size > DOCUMENT_CENTER_MAX_FILE_BYTES) {
    return getDocumentCenterMaxFileSizeError();
  }
  return null;
}

export function validateCreateDocumentInput(
  input: CreateDocumentInput
): string | null {
  if (!input.buildingId.trim()) return "יש לבחור בניין.";
  if (!input.title.trim()) return "יש להזין כותרת מסמך.";
  if (!input.fileName.trim()) return "יש לצרף קובץ.";
  if (!input.fileUrl.trim() || !input.storagePath.trim()) {
    return "קובץ לא הועלה.";
  }
  if (!DOCUMENT_TYPES.some((type) => type.id === input.documentType)) {
    return "סוג מסמך לא תקין.";
  }
  return null;
}

export function sanitizeDocumentFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\?%*:|"<>]/g, "_");
  return base || "document";
}

export function buildDocumentStoragePath(
  buildingId: string,
  fileName: string,
  contentType: string,
  now: Date = new Date(),
  fileId: string = generateDocumentFileId(now)
): string {
  const normalizedBuilding = buildingId.trim().toLowerCase();
  const datePart = now.toISOString().split("T")[0];
  const extension = resolveStorageExtension(fileName, contentType);
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;
  return `${normalizedBuilding}/${datePart}/${fileId}${suffix}`;
}

export function buildDocumentPublicUrl(storagePath: string): string | null {
  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  if (!baseUrl || !storagePath.trim()) return null;
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/storage/v1/object/public/${DOCUMENT_CENTER_BUCKET}/${encodedPath}`;
}

export function extractDocumentStoragePath(fileUrl: string): string | null {
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  const marker = `/storage/v1/object/public/${DOCUMENT_CENTER_BUCKET}/`;
  const index = trimmed.indexOf(marker);
  if (index === -1) return null;

  const encodedPath = trimmed.slice(index + marker.length).split("?")[0];
  if (!encodedPath) return null;

  return encodedPath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function uploadDocumentWithProgress(
  uploadUrl: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      traceDocumentCenter("storage.xhr.response", {
        status: xhr.status,
        statusText: xhr.statusText,
        responseText: xhr.responseText?.slice(0, 500) ?? "",
        uploadUrl,
      });
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new Error(
          xhr.responseText ||
            `Upload failed (${xhr.status}) · bucket=${DOCUMENT_CENTER_BUCKET}`
        )
      );
    };
    xhr.onerror = () => {
      traceDocumentCenter("storage.xhr.network_error", { uploadUrl });
      reject(new Error("Upload failed · network error"));
    };
    xhr.send(file);
  });
}

async function uploadDocumentViaSupabaseClient(
  file: File,
  storagePath: string,
  contentType: string
): Promise<{ path: string | null }> {
  const client = getPilotSupabaseClient();
  if (!client) {
    throw new Error("Supabase client unavailable");
  }

  traceDocumentCenter("storage.client.request", {
    bucket: DOCUMENT_CENTER_BUCKET,
    storagePath,
    contentType,
    fileName: file.name,
    fileType: file.type,
    fileSizeBytes: file.size,
  });

  const { data, error } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .upload(storagePath, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    traceDocumentCenter("storage.client.error", {
      message: error.message,
      name: error.name,
      storagePath,
      contentType,
    });
    throw new Error(formatSupabaseError(error));
  }

  traceDocumentCenter("storage.client.success", {
    path: data?.path ?? storagePath,
    id: data?.id ?? null,
    fullPath: data?.fullPath ?? null,
  });

  return { path: data?.path ?? storagePath };
}

export async function uploadDocumentCenterFile(
  file: File,
  buildingId: string,
  onProgress?: (percent: number) => void
): Promise<UploadDocumentResult> {
  if (typeof window === "undefined") {
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details: "upload is browser-only",
    };
  }

  const validationError = validateDocumentCenterFile(file);
  if (validationError) {
    traceDocumentCenter("validation.file.failed", {
      fileName: file.name,
      fileType: file.type,
      fileSizeBytes: file.size,
      error: validationError,
    });
    console.error("[document-center] file validation:", validationError);
    return {
      ok: false,
      stage: "validation",
      error: validationError,
    };
  }

  traceDocumentCenter("validation.file.ok", {
    fileName: file.name,
    fileType: file.type,
    fileSizeBytes: file.size,
    buildingId,
  });

  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    traceDocumentCenter("env.missing", {
      hasUrl: Boolean(baseUrl),
      hasAnonKey: Boolean(anonKey),
    });
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details: "Supabase env missing",
    };
  }

  const resolvedContentType = resolveDocumentContentType(file.name, file.type);
  if (!resolvedContentType.ok) {
    traceDocumentCenter("validation.mime.failed", {
      fileName: file.name,
      fileType: file.type,
      error: resolvedContentType.error,
    });
    return {
      ok: false,
      stage: "validation",
      error: resolvedContentType.error,
    };
  }

  const contentType = resolvedContentType.contentType;
  traceDocumentCenter("validation.mime.resolved", {
    fileName: file.name,
    fileType: file.type,
    resolvedContentType: contentType,
  });

  if (contentType === "application/octet-stream") {
    traceDocumentCenter("validation.mime.blocked_octet_stream", {
      fileName: file.name,
      fileType: file.type,
    });
    return {
      ok: false,
      stage: "validation",
      error: DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR,
    };
  }

  const storagePath = buildDocumentStoragePath(
    buildingId,
    file.name,
    contentType
  );
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/${DOCUMENT_CENTER_BUCKET}/${encodedPath}`;

  traceDocumentCenter("storage.path", {
    storagePath,
    encodedPath,
    uploadUrl,
    contentType,
    buildingId,
  });

  onProgress?.(0);

  const failUpload = (responseText: string): UploadDocumentResult => {
    const userHint = formatStorageUploadUserError(responseText);
    const details = formatStorageUploadFailureDetails({
      contentType,
      storagePath,
      responseText,
    });
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details: userHint ? `${userHint}\n${details}` : details,
    };
  };

  onProgress?.(5);

  try {
    const clientResult = await uploadDocumentViaSupabaseClient(
      file,
      storagePath,
      contentType
    );
    traceDocumentCenter("storage.upload.success", {
      method: "supabase-client",
      path: clientResult.path,
    });
    onProgress?.(100);
  } catch (clientError) {
    const clientResponseText =
      clientError instanceof Error ? clientError.message : String(clientError);
    console.error("[document-center] client upload failed:", {
      bucket: DOCUMENT_CENTER_BUCKET,
      contentType,
      storagePath,
      responseText: clientResponseText,
      error: clientError,
    });

    try {
      onProgress?.(20);
      await uploadDocumentWithProgress(
        uploadUrl,
        file,
        {
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
          "Content-Type": contentType,
          "x-upsert": "false",
        },
        onProgress
      );
      traceDocumentCenter("storage.upload.success", {
        method: "xhr-fallback",
        storagePath,
      });
    } catch (xhrError) {
      const xhrResponseText =
        xhrError instanceof Error ? xhrError.message : String(xhrError);
      console.error("[document-center] xhr upload failed:", {
        bucket: DOCUMENT_CENTER_BUCKET,
        contentType,
        storagePath,
        responseText: xhrResponseText,
        error: xhrError,
      });
      return failUpload(xhrResponseText || clientResponseText);
    }
  }

  const fileUrl = buildDocumentPublicUrl(storagePath);
  if (!fileUrl) {
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details: "public URL could not be built",
    };
  }

  console.info("[document-center] upload success:", {
    pathVersion: "uuid-date-v2",
    bucket: DOCUMENT_CENTER_BUCKET,
    contentType,
    storagePath,
    fileUrl,
  });

  return { ok: true, fileUrl, storagePath, contentType };
}

export async function deleteDocumentCenterStorageFile(
  storagePath: string
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !storagePath.trim()) return false;

  const { error } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn("[document-center] storage delete failed:", error.message);
    return false;
  }

  return true;
}

export function filterDocuments(
  documents: DocumentRecord[],
  filters: DocumentSearchFilters
): DocumentRecord[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const buildingId = filters.buildingId?.trim().toLowerCase() ?? "";
  const elevatorId = filters.elevatorId?.trim() ?? "";
  const documentType = filters.documentType ?? "";
  const tagFilters = normalizeDocumentTags(filters.tags ?? []);

  return documents.filter((document) => {
    if (buildingId && document.building_id.toLowerCase() !== buildingId) {
      return false;
    }
    if (elevatorId && document.elevator_id !== elevatorId) {
      return false;
    }
    if (documentType && document.document_type !== documentType) {
      return false;
    }
    if (tagFilters.length > 0) {
      const hasAllTags = tagFilters.every((tag) =>
        documentHasTagFilter(document.tags, tag)
      );
      if (!hasAllTags) return false;
    }
    if (!query) return true;

    const haystack = [
      document.title,
      document.description ?? "",
      document.file_name,
      document.tags.join(" "),
      getDocumentTypeLabel(document.document_type),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function collectDocumentTags(documents: DocumentRecord[]): string[] {
  const tags = new Set<string>();
  for (const document of documents) {
    for (const tag of document.tags) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b, "he"));
}

export async function createDocument(
  input: CreateDocumentInput
): Promise<CreateDocumentResult> {
  const validationError = validateCreateDocumentInput(input);
  if (validationError) {
    traceDocumentCenter("db.insert.validation.failed", {
      error: validationError,
      input,
    });
    console.error("[document-center] insert validation:", validationError, input);
    return { document: null, error: validationError };
  }

  const client = getPilotSupabaseClient();
  if (!client) {
    traceDocumentCenter("db.insert.client_unavailable", {});
    return {
      document: null,
      error: "Supabase לא מוגדר",
    };
  }

  const row = buildDocumentInsertRow(input);
  traceDocumentCenter("db.insert.payload", { table: DOCUMENTS_TABLE, row });
  console.info("[document-center] insert payload:", {
    building_id: row.building_id,
    elevator_id: row.elevator_id,
    document_type: row.document_type,
    title: row.title,
    file_name: row.file_name,
    file_url: row.file_url,
    storage_path: row.storage_path,
    tags: row.tags,
  });

  let data: Record<string, unknown> | null = null;
  let error: {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  } | null = null;

  const firstAttempt = await client
    .from(DOCUMENTS_TABLE)
    .insert(row)
    .select("*")
    .single();
  data = firstAttempt.data;
  error = firstAttempt.error;

  traceDocumentCenter("db.insert.response", {
    attempt: "with_visibility_column",
    success: !error && Boolean(data),
    data: data ? { id: data.id, title: data.title } : null,
    error: error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null,
  });

  if (error && isMissingVisibilityColumnError(error)) {
    const legacyRow = buildDocumentInsertRowWithoutVisibilityColumn(input);
    console.warn(
      "[document-center] visibility column missing — retrying insert without column"
    );
    const retryAttempt = await client
      .from(DOCUMENTS_TABLE)
      .insert(legacyRow)
      .select("*")
      .single();
    data = retryAttempt.data;
    error = retryAttempt.error;
    traceDocumentCenter("db.insert.response", {
      attempt: "legacy_without_visibility_column",
      success: !error && Boolean(data),
      data: data ? { id: data.id, title: data.title } : null,
      error: error
        ? {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          }
        : null,
    });
  }

  if (error || !data) {
    const formatted = error ? formatSupabaseError(error) : "no row returned";
    traceDocumentCenter("db.insert.failed", {
      formatted,
      table: DOCUMENTS_TABLE,
    });
    console.error("[document-center] insert failed:", {
      error,
      table: DOCUMENTS_TABLE,
      row,
    });
    return {
      document: null,
      error: formatted,
    };
  }

  const document = mapDocumentRow(data);
  traceDocumentCenter("db.insert.success", {
    id: document.id,
    title: document.title,
    building_id: document.building_id,
    storage_path: document.storage_path,
  });
  console.info("[document-center] insert success:", {
    id: document.id,
    title: document.title,
    building_id: document.building_id,
  });
  return { document, error: null };
}

export async function getAllDocuments(): Promise<DocumentListResult> {
  const client = getPilotSupabaseClient();
  if (!client) {
    return {
      documents: [],
      error: "Supabase לא מוגדר",
    };
  }

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    const formatted = formatSupabaseError(error);
    console.error("[document-center] list failed:", {
      error,
      table: DOCUMENTS_TABLE,
    });
    return {
      documents: [],
      error: formatted,
    };
  }

  const documents = (data ?? []).map((row) => mapDocumentRow(row));
  console.info("[document-center] list success:", { count: documents.length });
  return { documents, error: null };
}

export async function getDocumentById(
  documentId: string
): Promise<DocumentRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !documentId.trim()) return null;

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[document-center] get by id failed:", error?.message);
    return null;
  }

  return mapDocumentRow(data);
}

export async function updateDocumentVisibility(
  documentId: string,
  visibility: DocumentVisibility
): Promise<UpdateDocumentVisibilityResult> {
  const client = getPilotSupabaseClient();
  if (!client || !documentId.trim()) {
    return {
      document: null,
      error: "Supabase לא מוגדר",
    };
  }

  const normalizedVisibility = normalizeDocumentVisibility(visibility);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .update({
      visibility: normalizedVisibility,
      updated_at: now,
    })
    .eq("id", documentId.trim())
    .select("*")
    .single();

  if (error || !data) {
    const formatted = error ? formatSupabaseError(error) : "no row returned";
    console.error("[document-center] visibility update failed:", {
      error,
      documentId,
      visibility: normalizedVisibility,
    });
    return {
      document: null,
      error: formatted,
    };
  }

  const document = mapDocumentRow(data);
  console.info("[document-center] visibility update success:", {
    id: document.id,
    visibility: document.visibility,
  });
  return { document, error: null };
}

export async function deleteDocument(documentId: string): Promise<boolean> {
  const client = getPilotSupabaseClient();
  if (!client || !documentId.trim()) return false;

  const document = await getDocumentById(documentId);
  if (!document) return false;

  if (document.storage_path) {
    await deleteDocumentCenterStorageFile(document.storage_path);
  }

  const { error } = await client
    .from(DOCUMENTS_TABLE)
    .delete()
    .eq("id", documentId);

  if (error) {
    console.warn("[document-center] delete failed:", error.message);
    return false;
  }

  return true;
}

export function formatDocumentDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function isDocumentReadyForOcr(document: DocumentRecord): boolean {
  return document.ocr_status === "none" && Boolean(document.file_url);
}

export function isDocumentReadyForAi(document: DocumentRecord): boolean {
  return document.ocr_status === "ready" && !document.ai_summary;
}
