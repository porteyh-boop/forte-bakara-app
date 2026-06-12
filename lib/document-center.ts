import {
  getPilotSupabaseClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isPilotCloudConfigured,
} from "./pilot-cloud";

export const DOCUMENTS_TABLE = "documents";
export const DOCUMENT_CENTER_BUCKET = "document-center";
export const DOCUMENT_CENTER_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_CENTER_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".docx",
  ".xlsx",
] as const;

export const DOCUMENT_CENTER_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
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

export type DocumentOcrStatus = "none" | "pending" | "ready" | "failed";

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

export const DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR =
  "סוג הקובץ אינו נתמך. יש להעלות PDF או תמונה בפורמט נתמך.";

const DOCUMENT_EXTENSION_MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const DOCUMENT_MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
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
  if (error.code === "42P01" || message.includes("documents")) {
    return `${message} · ודאו ש-migration 008 הורץ ב-Supabase`;
  }
  return message || "שגיאה לא ידועה";
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
    ai_metadata: null,
    updated_at: now,
  };
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

export function normalizeDocumentTags(input: string[] | string): string[] {
  const raw = Array.isArray(input)
    ? input
    : input.split(/[,;#]+/);

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of raw) {
    const value = tag.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }

  return normalized.sort((a, b) => a.localeCompare(b, "he"));
}

export function parseDocumentTagsInput(input: string): string[] {
  return normalizeDocumentTags(input);
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
    return "סוג קובץ לא נתמך. ניתן להעלות PDF, JPG, PNG, DOCX או XLSX.";
  }
  if (file.size <= 0) return "הקובץ ריק.";
  if (file.size > DOCUMENT_CENTER_MAX_FILE_BYTES) {
    return "הקובץ גדול מדי (מקסימום 20MB).";
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
  fileId: string = crypto.randomUUID()
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
    xhr.onerror = () => reject(new Error("Upload failed · network error"));
    xhr.send(file);
  });
}

async function uploadDocumentViaSupabaseClient(
  file: File,
  storagePath: string,
  contentType: string
): Promise<void> {
  const client = getPilotSupabaseClient();
  if (!client) {
    throw new Error("Supabase client unavailable");
  }

  const { error } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .upload(storagePath, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(formatSupabaseError(error));
  }
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
    console.error("[document-center] file validation:", validationError);
    return {
      ok: false,
      stage: "validation",
      error: validationError,
    };
  }

  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) {
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details: "Supabase env missing",
    };
  }

  const resolvedContentType = resolveDocumentContentType(file.name, file.type);
  if (!resolvedContentType.ok) {
    return {
      ok: false,
      stage: "validation",
      error: resolvedContentType.error,
    };
  }

  const contentType = resolvedContentType.contentType;
  if (contentType === "application/octet-stream") {
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

  onProgress?.(0);

  const failUpload = (responseText: string): UploadDocumentResult => {
    const details = formatStorageUploadFailureDetails({
      contentType,
      storagePath,
      responseText,
    });
    return {
      ok: false,
      stage: "upload",
      error: "העלאת הקובץ נכשלה",
      details,
    };
  };

  try {
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

    try {
      onProgress?.(50);
      await uploadDocumentViaSupabaseClient(file, storagePath, contentType);
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
      return failUpload(clientResponseText);
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
      const hasAllTags = tagFilters.every((tag) => document.tags.includes(tag));
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
    console.error("[document-center] insert validation:", validationError, input);
    return { document: null, error: validationError };
  }

  const client = getPilotSupabaseClient();
  if (!client) {
    return {
      document: null,
      error: "Supabase לא מוגדר",
    };
  }

  const row = buildDocumentInsertRow(input);
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

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    const formatted = error ? formatSupabaseError(error) : "no row returned";
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
