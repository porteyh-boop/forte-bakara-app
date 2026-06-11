import { getPilotSupabaseClient, isPilotCloudConfigured } from "./pilot-cloud";

export const INSPECTOR_REPORTS_TABLE = "inspector_reports";

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

export interface InspectorReportRecord {
  id: string;
  building_id: string;
  elevator_id: string | null;
  report_date: string;
  inspector_name: string | null;
  document_name: string | null;
  document_url: string | null;
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
  documentDescription?: string;
  hasRemarks: boolean;
}

export interface CloseInspectorReportInput {
  reportId: string;
  closureNotes?: string;
  closedAt?: string;
}

function mapInspectorReportRow(row: Record<string, unknown>): InspectorReportRecord {
  const reportDate = String(row.report_date);
  return {
    id: String(row.id),
    building_id: String(row.building_id),
    elevator_id: row.elevator_id ? String(row.elevator_id) : null,
    report_date: reportDate.includes("T") ? reportDate.split("T")[0] : reportDate,
    inspector_name: row.inspector_name ? String(row.inspector_name) : null,
    document_name: row.document_name ? String(row.document_name) : null,
    document_url: row.document_url ? String(row.document_url) : null,
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
    !input.documentDescription?.trim()
  ) {
    return "יש להזין שם מסמך, קישור חיצוני או תיאור.";
  }
  return null;
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

  const hasRemarks = input.hasRemarks;
  const row = {
    building_id: input.buildingId.trim().toLowerCase(),
    elevator_id: input.elevatorId?.trim() || null,
    report_date: normalizeReportDate(input.reportDate),
    inspector_name: input.inspectorName?.trim() || null,
    document_name: input.documentName?.trim() || null,
    document_url: input.documentUrl?.trim() || null,
    document_description: input.documentDescription?.trim() || null,
    has_remarks: hasRemarks,
    deadline_at: hasRemarks
      ? computeInspectorDeadlineAt(input.reportDate)
      : null,
    status: "open",
    closed_at: null,
    closure_notes: null,
  };

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[inspector-report] create failed:", error?.message);
    return null;
  }

  return mapInspectorReportRow(data);
}

export async function getAllInspectorReports(): Promise<InspectorReportRecord[]> {
  const client = getPilotSupabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from(INSPECTOR_REPORTS_TABLE)
    .select("*")
    .order("report_date", { ascending: false });

  if (error || !data) {
    console.warn("[inspector-report] list failed:", error?.message);
    return [];
  }

  return data.map((row) => mapInspectorReportRow(row));
}

export async function closeInspectorReport(
  input: CloseInspectorReportInput
): Promise<InspectorReportRecord | null> {
  const client = getPilotSupabaseClient();
  if (!client || !input.reportId.trim()) return null;

  const closedAt = input.closedAt ?? new Date().toISOString();
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

  return mapInspectorReportRow(data);
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
