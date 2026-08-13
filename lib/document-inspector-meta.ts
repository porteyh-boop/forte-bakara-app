import { getPilotSupabaseClient } from "./pilot-cloud";

export const DOCUMENT_INSPECTOR_META_TABLE = "document_inspector_meta";
export const INSPECTOR_DEADLINE_DAYS = 45;

export type DocumentInspectorStatus = "open" | "closed";

export interface DocumentInspectorMetaRecord {
  document_id: string;
  report_date: string;
  inspector_name: string | null;
  has_remarks: boolean;
  deadline_at: string | null;
  next_inspection_date: string | null;
  status: DocumentInspectorStatus;
  closed_at: string | null;
  closure_notes: string | null;
  legacy_inspector_report_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDocumentInspectorMetaInput {
  documentId: string;
  reportDate: string;
  inspectorName?: string;
  hasRemarks: boolean;
  nextInspectionDate?: string | null;
  legacyInspectorReportId?: string | null;
}

export interface CloseDocumentInspectorMetaInput {
  documentId: string;
  closureNotes?: string;
  closedAt?: string;
}

function normalizeReportDate(value: string): string {
  return value.trim().split("T")[0];
}

function normalizeOptionalDate(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.split("T")[0];
}

export function formatNextInspectionDate(iso: string | null): string {
  if (!iso) return "לא הוגדר";
  const normalized = normalizeReportDate(iso);
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${normalized}T12:00:00`));
}

export type NextInspectionDisplayStatus =
  | "not_set"
  | "upcoming"
  | "due_soon"
  | "overdue";

export function daysUntilDate(
  isoDate: string,
  now: Date = new Date()
): number {
  const normalized = normalizeReportDate(isoDate);
  const target = new Date(`${normalized}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export function getNextInspectionDisplayStatus(
  isoDate: string | null,
  now: Date = new Date()
): NextInspectionDisplayStatus {
  if (!isoDate?.trim()) return "not_set";
  const days = daysUntilDate(isoDate, now);
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "upcoming";
}

export function formatNextInspectionStatusLabel(
  isoDate: string | null,
  now: Date = new Date()
): string {
  const status = getNextInspectionDisplayStatus(isoDate, now);
  if (status === "not_set") return "לא הוגדר";
  if (status === "overdue") return "בדיקה נדרשת";
  const days = daysUntilDate(isoDate!, now);
  if (status === "due_soon") {
    return days === 0 ? "בדיקה היום" : `נותרו ${days} ימים`;
  }
  return formatNextInspectionDate(isoDate);
}

function computeInspectorDeadlineAt(reportDate: string): string {
  const normalized = normalizeReportDate(reportDate);
  const deadline = new Date(`${normalized}T12:00:00`);
  deadline.setDate(deadline.getDate() + INSPECTOR_DEADLINE_DAYS);
  return deadline.toISOString();
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
      ? normalizeReportDate(String(row.next_inspection_date))
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

export function buildDocumentInspectorMetaInsertRow(
  input: CreateDocumentInspectorMetaInput
) {
  const now = new Date().toISOString();
  const reportDate = normalizeReportDate(input.reportDate);
  const hasRemarks = input.hasRemarks;

  return {
    document_id: input.documentId,
    report_date: reportDate,
    inspector_name: input.inspectorName?.trim() || null,
    has_remarks: hasRemarks,
    deadline_at: hasRemarks ? computeInspectorDeadlineAt(reportDate) : null,
    next_inspection_date: normalizeOptionalDate(input.nextInspectionDate),
    status: "open",
    closed_at: null,
    closure_notes: null,
    legacy_inspector_report_id: input.legacyInspectorReportId ?? null,
    updated_at: now,
  };
}

export async function createDocumentInspectorMeta(
  input: CreateDocumentInspectorMetaInput
): Promise<DocumentInspectorMetaRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.documentId.trim()) return null;

  const row = buildDocumentInspectorMetaInsertRow(input);
  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[document-inspector-meta] create failed:", error?.message);
    return null;
  }

  return mapDocumentInspectorMetaRow(data);
}

export async function getDocumentInspectorMetaByDocumentId(
  documentId: string
): Promise<DocumentInspectorMetaRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !documentId.trim()) return null;

  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .select("*")
    .eq("document_id", documentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("[document-inspector-meta] get failed:", error.message);
    }
    return null;
  }

  return mapDocumentInspectorMetaRow(data);
}

export async function listAllDocumentInspectorMeta(): Promise<
  DocumentInspectorMetaRecord[]
> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .select("*")
    .order("report_date", { ascending: false });

  if (error || !data) {
    console.warn("[document-inspector-meta] list failed:", error?.message);
    return [];
  }

  return data.map((row) => mapDocumentInspectorMetaRow(row));
}

export async function closeDocumentInspectorMeta(
  input: CloseDocumentInspectorMetaInput
): Promise<DocumentInspectorMetaRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.documentId.trim()) return null;

  const closedAt = input.closedAt ?? new Date().toISOString();
  const { data, error } = await client
    .from(DOCUMENT_INSPECTOR_META_TABLE)
    .update({
      status: "closed",
      closed_at: closedAt,
      closure_notes: input.closureNotes?.trim() || null,
      updated_at: closedAt,
    })
    .eq("document_id", input.documentId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("[document-inspector-meta] close failed:", error?.message);
    return null;
  }

  return mapDocumentInspectorMetaRow(data);
}
