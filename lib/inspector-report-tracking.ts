import {
  getPilotSupabaseClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
  isPilotCloudConfigured,
} from "./pilot-cloud";
import {
  closeDocumentInspectorMeta,
  createDocumentInspectorMeta,
  getDocumentInspectorMetaByDocumentId,
  listAllDocumentInspectorMeta,
} from "./document-inspector-meta";
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  buildDocumentStoragePath,
  resolveDocumentContentType,
  uploadDocumentCenterFile,
} from "./document-center";
import type { DocumentRecord } from "./document-center";

export const INSPECTOR_REPORTS_TABLE = "inspector_reports";
export const INSPECTOR_REPORTS_BUCKET = "inspector-reports";
export const INSPECTOR_REPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const INSPECTOR_REPORT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".docx",
  ".xlsx",
] as const;

export const INSPECTOR_REPORT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const INSPECTOR_REMINDER_DAY = 35;
export const INSPECTOR_ALERT_DAY = 40;
export const INSPECTOR_URGENT_DAY = 45;
export const INSPECTOR_DEADLINE_DAYS = 45;

export type InspectorReportStatus = "open" | "closed";

export type InspectorFollowUpPhase =
  | "none"
  | "active"
  | "reminder"
  | "alert"
  | "urgent"
  | "closed";

export type InspectorReportSource = "legacy" | "document";

export interface InspectorReportRecord {
  id: string;
  document_id: string | null;
  source: InspectorReportSource;
  building_id: string;
  elevator_id: string | null;
  report_date: string;
  inspector_name: string | null;
  document_name: string | null;
  document_url: string | null;
  file_url: string | null;
  document_description: string | null;
  has_remarks: boolean;
  deadline_at: string | null;
  status: InspectorReportStatus;
  closed_at: string | null;
  closure_notes: string | null;
  created_at: string;
}

export interface CreateInspectorReportInput {
  buildingId: string;
  elevatorId?: string | null;
  reportDate: string;
  inspectorName?: string;
  documentName?: string;
  documentUrl?: string;
  fileUrl?: string;
  storagePath?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  documentDescription?: string;
  hasRemarks: boolean;
}

export interface CloseInspectorReportInput {
  reportId: string;
  closureNotes?: string;
  closedAt?: string;
}

function mapLegacyInspectorReportRow(
  row: Record<string, unknown>
): InspectorReportRecord {
  const report = mapInspectorReportRow(row);
  return {
    ...report,
    document_id: null,
    source: "legacy",
  };
}

function mapDocumentInspectorToReport(
  document: DocumentRecord,
  meta: NonNullable<Awaited<ReturnType<typeof getDocumentInspectorMetaByDocumentId>>>
): InspectorReportRecord {
  return {
    id: document.id,
    document_id: document.id,
    source: "document",
    building_id: document.building_id,
    elevator_id: document.elevator_id,
    report_date: meta.report_date,
    inspector_name: meta.inspector_name,
    document_name: document.title,
    document_url: null,
    file_url: document.file_url,
    document_description: document.description,
    has_remarks: meta.has_remarks,
    deadline_at: meta.deadline_at,
    status: meta.status,
    closed_at: meta.closed_at,
    closure_notes: meta.closure_notes,
    created_at: document.created_at,
  };
}

function mapInspectorReportRow(row: Record<string, unknown>): Omit<
  InspectorReportRecord,
  "document_id" | "source"
> {
  const reportDate = String(row.report_date);
  return {
    id: String(row.id),
    building_id: String(row.building_id),
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    report_date: reportDate.includes("T") ? reportDate.split("T")[0] : reportDate,
    inspector_name: row.inspector_name ? String(row.inspector_name) : null,
    document_name: row.document_name ? String(row.document_name) : null,
    document_url: row.document_url ? String(row.document_url) : null,
    file_url: row.file_url ? String(row.file_url) : null,
    document_description: row.document_description
      ? String(row.document_description)
      : null,
    has_remarks: Boolean(row.has_remarks),
    deadline_at: row.deadline_at ? String(row.deadline_at) : null,
    status: row.status === "closed" ? "closed" : "open",
    closed_at: row.closed_at ? String(row.closed_at) : null,
    closure_notes: row.closure_notes ? String(row.closure_notes) : null,
    created_at: String(row.created_at),
  };
}

export function normalizeReportDate(value: string): string {
  return value.trim().split("T")[0];
}

export function computeInspectorDeadlineAt(reportDate: string): string {
  const normalized = normalizeReportDate(reportDate);
  const deadline = new Date(`${normalized}T12:00:00`);
  deadline.setDate(deadline.getDate() + INSPECTOR_DEADLINE_DAYS);
  return deadline.toISOString();
}

export function daysSinceReportDate(
  reportDate: string,
  now: Date = new Date()
): number {
  const normalized = normalizeReportDate(reportDate);
  const start = new Date(`${normalized}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000);
}

export function computeInspectorFollowUpPhase(
  report: Pick<
    InspectorReportRecord,
    "status" | "has_remarks" | "report_date"
  >,
  now: Date = new Date()
): InspectorFollowUpPhase {
  if (report.status === "closed") return "closed";
  if (!report.has_remarks) return "none";

  const days = daysSinceReportDate(report.report_date, now);
  if (days >= INSPECTOR_URGENT_DAY) return "urgent";
  if (days >= INSPECTOR_ALERT_DAY) return "alert";
  if (days >= INSPECTOR_REMINDER_DAY) return "reminder";
  return "active";
}

export function getInspectorPhaseLabel(phase: InspectorFollowUpPhase): string {
  switch (phase) {
    case "active":
      return "מעקב פעיל";
    case "reminder":
      return "תזכורת — יום 35";
    case "alert":
      return "התראה — יום 40";
    case "urgent":
      return "מכתב בהול ודחוף — יום 45+";
    case "closed":
      return "נסגר לאחר טיפול";
    default:
      return "ללא מעקב הערות";
  }
}

export function getInspectorPhaseBadgeClass(phase: InspectorFollowUpPhase): string {
  switch (phase) {
    case "reminder":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "alert":
      return "bg-orange-50 text-orange-800 border-orange-200";
    case "urgent":
      return "bg-red-50 text-red-800 border-red-200";
    case "closed":
      return "bg-green-50 text-green-800 border-green-200";
    case "active":
      return "bg-blue-50 text-blue-800 border-blue-200";
    default:
      return "bg-gray-50 text-gray-text border-gray-200";
  }
}

export function validateInspectorReportInput(
  input: CreateInspectorReportInput
): string | null {
  if (!input.buildingId.trim()) return "יש לבחור בניין.";
  if (!input.reportDate.trim()) return "יש להזין תאריך תסקיר.";
  if (
    !input.documentName?.trim() &&
    !input.documentUrl?.trim() &&
    !input.fileUrl?.trim() &&
    !input.documentDescription?.trim()
  ) {
    return "יש להזין שם מסמך, קובץ, קישור חיצוני או תיאור.";
  }
  return null;
}

export function getInspectorReportFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return "";
  return trimmed.slice(dot);
}

export function validateInspectorReportFile(
  file: Pick<File, "name" | "type" | "size">
): string | null {
  const extension = getInspectorReportFileExtension(file.name);
  const mimeAllowed =
    file.type &&
    INSPECTOR_REPORT_ALLOWED_MIME_TYPES.includes(
      file.type as (typeof INSPECTOR_REPORT_ALLOWED_MIME_TYPES)[number]
    );
  const extensionAllowed = INSPECTOR_REPORT_ALLOWED_EXTENSIONS.includes(
    extension as (typeof INSPECTOR_REPORT_ALLOWED_EXTENSIONS)[number]
  );

  if (!mimeAllowed && !extensionAllowed) {
    return "סוג קובץ לא נתמך. ניתן להעלות PDF, JPG, PNG, DOCX או XLSX.";
  }
  if (file.size <= 0) return "הקובץ ריק.";
  if (file.size > INSPECTOR_REPORT_MAX_FILE_BYTES) {
    return "הקובץ גדול מדי (מקסימום 20MB).";
  }
  return null;
}

export function sanitizeInspectorReportFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\?%*:|"<>]/g, "_");
  return base || "document";
}

export function buildInspectorReportStoragePath(
  buildingId: string,
  fileName: string,
  now: Date = new Date(),
  fileId: string = crypto.randomUUID()
): string {
  const resolved = resolveDocumentContentType(fileName);
  const contentType = resolved.ok ? resolved.contentType : "application/pdf";
  return buildDocumentStoragePath(
    buildingId,
    fileName,
    contentType,
    now,
    fileId
  );
}

export function buildInspectorReportPublicUrl(storagePath: string): string | null {
  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  if (!baseUrl || !storagePath.trim()) return null;
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/storage/v1/object/public/${INSPECTOR_REPORTS_BUCKET}/${encodedPath}`;
}

export function extractInspectorReportStoragePath(fileUrl: string): string | null {
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  const marker = `/storage/v1/object/public/${INSPECTOR_REPORTS_BUCKET}/`;
  const index = trimmed.indexOf(marker);
  if (index === -1) return null;

  const encodedPath = trimmed.slice(index + marker.length).split("?")[0];
  if (!encodedPath) return null;

  return encodedPath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function getInspectorReportDocumentUrl(
  report: Pick<InspectorReportRecord, "file_url" | "document_url">
): string | null {
  return report.file_url?.trim() || report.document_url?.trim() || null;
}

function uploadInspectorReportFileWithProgress(
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
      reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

export async function uploadInspectorReportFile(
  file: File,
  buildingId: string,
  onProgress?: (percent: number) => void
): Promise<{ fileUrl: string; storagePath: string } | null> {
  if (typeof window === "undefined") return null;

  const validationError = validateInspectorReportFile(file);
  if (validationError) {
    console.warn("[inspector-report] file validation:", validationError);
    return null;
  }

  const baseUrl = getSupabaseUrl()?.replace(/\/$/, "");
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey) return null;

  const storagePath = buildInspectorReportStoragePath(buildingId, file.name);
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/${INSPECTOR_REPORTS_BUCKET}/${encodedPath}`;

  onProgress?.(0);

  try {
    await uploadInspectorReportFileWithProgress(
      uploadUrl,
      file,
      {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      onProgress
    );
  } catch (error) {
    console.warn("[inspector-report] upload failed:", error);
    return null;
  }

  const fileUrl = buildInspectorReportPublicUrl(storagePath);
  if (!fileUrl) return null;

  return { fileUrl, storagePath };
}

export async function deleteInspectorReportStorageFile(
  fileUrl: string
): Promise<boolean> {
  const client = getPilotSupabaseClient();
  const storagePath = extractInspectorReportStoragePath(fileUrl);
  if (!client || !storagePath) return false;

  const { error } = await client.storage
    .from(INSPECTOR_REPORTS_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.warn("[inspector-report] storage delete failed:", error.message);
    return false;
  }

  return true;
}

export async function getInspectorReportById(
  reportId: string
): Promise<InspectorReportRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !reportId.trim()) return null;

  const document = await getDocumentById(reportId);
  if (document && document.document_type === "inspector_report") {
    const meta = await getDocumentInspectorMetaByDocumentId(reportId);
    if (meta) {
      return mapDocumentInspectorToReport(document, meta);
    }
  }

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) {
    console.warn("[inspector-report] get by id failed:", error?.message);
    return null;
  }

  return mapLegacyInspectorReportRow(data);
}

export async function deleteInspectorReport(reportId: string): Promise<boolean> {
  const report = await getInspectorReportById(reportId);
  if (!report) return false;

  if (report.source === "document" && report.document_id) {
    return deleteDocument(report.document_id);
  }

  const client = getPilotSupabaseClient();
  if (!client) return false;

  if (report.file_url) {
    await deleteInspectorReportStorageFile(report.file_url);
  }

  const { error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .delete()
    .eq("id", reportId);

  if (error) {
    console.warn("[inspector-report] delete failed:", error.message);
    return false;
  }

  return true;
}

export function formatInspectorReportDate(isoDate: string): string {
  const normalized = normalizeReportDate(isoDate);
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${normalized}T12:00:00`));
}

export function formatInspectorDeadline(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function generateUrgentLetterTemplate(params: {
  buildingName: string;
  buildingAddress?: string;
  reportDate: string;
  deadlineAt: string | null;
  documentName: string | null;
  inspectorName: string | null;
  daysSinceReport: number;
}): string {
  const documentLabel = params.documentName ?? "תסקיר בודק";
  const inspectorLabel = params.inspectorName ?? "הבודק המוסמך";
  const deadlineLabel = params.deadlineAt
    ? formatInspectorDeadline(params.deadlineAt)
    : formatInspectorDeadline(
        computeInspectorDeadlineAt(params.reportDate)
      );

  return [
    "נושא: מכתב בהול ודחוף — טיפול בהערות תסקיר בודק",
    "",
    `לכבוד ועד הבית / חברת הניהול`,
    `${params.buildingName}${params.buildingAddress ? ` · ${params.buildingAddress}` : ""}`,
    "",
    "שלום רב,",
    "",
    `בהמשך ל${documentLabel} מיום ${formatInspectorReportDate(params.reportDate)} (${inspectorLabel}),`,
    "התקבלו הערות הדורשות תיקון בתוך 45 יום.",
    "",
    `נכון להיום חלפו ${params.daysSinceReport} ימים ממועד התסקיר.`,
    `מועד היעד לטיפול: ${deadlineLabel}.`,
    "",
    "בהתאם לנהלי הבקרה, מועברת התראה דחופה לביצוע התיקונים הנדרשים",
    "ולדיווח על ביצועם ללא דיחוי נוסף.",
    "",
    "נא לאשר קבלת מכתב זה ולהעביר עדכון על מועד ביצוע התיקונים.",
    "",
    "בכבוד רב,",
    "יהודה פורטה · פורטה בקרה",
    "מעקב מקצועי מעליות",
  ].join("\n");
}

export function isInspectorReportTrackingConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function createInspectorReport(
  input: CreateInspectorReportInput
): Promise<InspectorReportRecord | null> {
  const validationError = validateInspectorReportInput(input);
  if (validationError) return null;

  const client = getPilotSupabaseClient();
  if (!client) return null;

  if (!input.fileUrl?.trim() || !input.storagePath?.trim()) {
    console.warn("[inspector-report] create requires uploaded file in document-center");
    return null;
  }

  const fileName = input.documentName?.trim() || "inspector-report";

  const { document, error: documentError } = await createDocument({
    buildingId: input.buildingId,
    elevatorId: input.elevatorId,
    documentType: "inspector_report",
    title: fileName,
    description: input.documentDescription,
    fileName,
    fileUrl: input.fileUrl,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    tags: ["תסקיר בודק"],
  });

  if (!document) {
    console.warn("[inspector-report] document create failed:", documentError);
    return null;
  }

  const meta = await createDocumentInspectorMeta({
    documentId: document.id,
    reportDate: input.reportDate,
    inspectorName: input.inspectorName,
    hasRemarks: input.hasRemarks,
  });

  if (!meta) {
    await deleteDocument(document.id);
    console.warn("[inspector-report] meta create failed — rolled back document");
    return null;
  }

  return mapDocumentInspectorToReport(document, meta);
}

export async function createInspectorReportWithFile(
  input: CreateInspectorReportInput,
  file: File,
  onProgress?: (percent: number) => void
): Promise<InspectorReportRecord | null> {
  const validationError = validateInspectorReportInput({
    ...input,
    documentName: input.documentName || file.name,
  });
  if (validationError) return null;

  const uploaded = await uploadDocumentCenterFile(file, input.buildingId, onProgress);
  if (!uploaded.ok) {
    console.warn("[inspector-report] upload failed:", uploaded);
    return null;
  }

  const contentTypeResult = resolveDocumentContentType(file.name, file.type);
  const mimeType = contentTypeResult.ok
    ? contentTypeResult.contentType
    : uploaded.contentType;

  return createInspectorReport({
    ...input,
    documentName: input.documentName || file.name.replace(/\.[^.]+$/, ""),
    fileUrl: uploaded.fileUrl,
    storagePath: uploaded.storagePath,
    mimeType,
    fileSizeBytes: file.size,
  });
}

async function listLegacyInspectorReports(): Promise<InspectorReportRecord[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .select("*")
    .order("report_date", { ascending: false });

  if (error || !data) {
    console.warn("[inspector-report] legacy list failed:", error?.message);
    return [];
  }

  return data.map((row) => mapLegacyInspectorReportRow(row));
}

async function listDocumentInspectorReports(): Promise<InspectorReportRecord[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const metaRows = await listAllDocumentInspectorMeta();
  if (metaRows.length === 0) return [];

  const reports: InspectorReportRecord[] = [];
  for (const meta of metaRows) {
    const document = await getDocumentById(meta.document_id);
    if (!document || document.document_type !== "inspector_report") continue;
    reports.push(mapDocumentInspectorToReport(document, meta));
  }

  return reports;
}

export async function getAllInspectorReports(): Promise<InspectorReportRecord[]> {
  const [legacyReports, documentReports] = await Promise.all([
    listLegacyInspectorReports(),
    listDocumentInspectorReports(),
  ]);

  return [...documentReports, ...legacyReports].sort((a, b) =>
    b.report_date.localeCompare(a.report_date)
  );
}

export async function closeInspectorReport(
  input: CloseInspectorReportInput,
  context?: {
    buildingName?: string;
    elevatorLabel?: string;
  }
): Promise<InspectorReportRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.reportId.trim()) return null;

  const existing = await getInspectorReportById(input.reportId);
  if (!existing) return null;

  const closedAt = input.closedAt ?? new Date().toISOString();

  if (existing.source === "document" && existing.document_id) {
    const meta = await closeDocumentInspectorMeta({
      documentId: existing.document_id,
      closureNotes: input.closureNotes,
      closedAt,
    });
    if (!meta) return null;

    const document = await getDocumentById(existing.document_id);
    if (!document) return null;

    const closedReport = mapDocumentInspectorToReport(document, meta);
    return closedReport;
  }

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .update({
      status: "closed",
      closed_at: closedAt,
      closure_notes: input.closureNotes?.trim() || null,
    })
    .eq("id", input.reportId)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[inspector-report] close failed:", error?.message);
    return null;
  }

  const closedReport = mapLegacyInspectorReportRow(data);
  return closedReport;
}

export function closeInspectorReportLocally(
  report: InspectorReportRecord,
  closureNotes?: string,
  closedAt: Date = new Date()
): InspectorReportRecord {
  return {
    ...report,
    status: "closed",
    closed_at: closedAt.toISOString(),
    closure_notes: closureNotes?.trim() || null,
  };
}

export async function closeInspectorReportByDocumentId(
  documentId: string,
  closureNotes?: string,
  context?: {
    buildingName?: string;
    elevatorLabel?: string;
  }
): Promise<InspectorReportRecord | null> {
  return closeInspectorReport(
    { reportId: documentId, closureNotes },
    context
  );
}
