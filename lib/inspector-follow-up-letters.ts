import type { ProjectContactWithDetails } from "./contacts";
import {
  ELEVATOR_COMPANY_OPTIONS,
  MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
  type MasterLetterTemplateId,
} from "./master-letter-templates";
import type { MasterLetterFieldValue } from "./master-letters";
import type { InspectorLetterStage } from "./document-inspector-notifications";
import {
  formatInspectorDeadline,
  formatInspectorReportDate,
  normalizeReportDate,
  type InspectorReportRecord,
} from "./inspector-report-tracking";

export const INSPECTOR_LETTER_STAGES: InspectorLetterStage[] = [
  "letter_1",
  "letter_2",
  "letter_3",
];

export interface InspectorFollowUpLetterAlert {
  report: InspectorReportRecord;
  stage: InspectorLetterStage;
  title: string;
  subtitle: string;
  deadlineLabel: string;
  daysRemainingLabel: string;
  urgent: boolean;
  prepareButtonLabel: string;
}

export interface InspectorFollowUpLetterPrefill {
  templateId: MasterLetterTemplateId;
  templateFields: Record<string, MasterLetterFieldValue>;
  subject: string;
  title: string;
  dossierSection: "inspections";
  elevatorId: string | null;
  suggestedContactRelationId: string | null;
  inspectorReportDocumentId: string;
  letterStage: InspectorLetterStage;
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function parseDeadlineDate(
  report: Pick<InspectorReportRecord, "deadline_at" | "report_date">
): Date {
  const raw = report.deadline_at?.trim();
  if (raw) {
    const normalized = raw.includes("T") ? raw.split("T")[0] : raw;
    return startOfLocalDay(new Date(`${normalized}T12:00:00`));
  }
  const normalizedReport = normalizeReportDate(report.report_date);
  const fallback = startOfLocalDay(new Date(`${normalizedReport}T12:00:00`));
  fallback.setDate(fallback.getDate() + 45);
  return fallback;
}

export function daysUntilInspectorDeadline(
  report: Pick<InspectorReportRecord, "deadline_at" | "report_date">,
  now: Date = new Date()
): number {
  const deadline = parseDeadlineDate(report);
  const today = startOfLocalDay(now);
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
}

/** Which letter stage window applies today (time-based, not "first missing"). */
export function getActiveInspectorLetterStageWindow(
  report: Pick<InspectorReportRecord, "status" | "has_remarks" | "deadline_at" | "report_date">,
  now: Date = new Date()
): InspectorLetterStage | null {
  if (report.status !== "open" || !report.has_remarks) return null;

  const today = startOfLocalDay(now);
  const deadline = parseDeadlineDate(report);

  const letter2Start = new Date(deadline);
  letter2Start.setDate(letter2Start.getDate() - 7);

  const letter3Start = new Date(deadline);
  letter3Start.setDate(letter3Start.getDate() + 1);

  if (today.getTime() >= startOfLocalDay(letter3Start).getTime()) {
    return "letter_3";
  }
  if (
    today.getTime() >= startOfLocalDay(letter2Start).getTime() &&
    today.getTime() <= deadline.getTime()
  ) {
    return "letter_2";
  }
  return "letter_1";
}

export function isInspectorLetterStageDue(
  stage: InspectorLetterStage,
  report: InspectorReportRecord,
  now: Date = new Date()
): boolean {
  return getActiveInspectorLetterStageWindow(report, now) === stage;
}

export function getNextRequiredInspectorLetterStage(
  report: InspectorReportRecord,
  prepared: ReadonlySet<InspectorLetterStage>,
  now: Date = new Date()
): InspectorLetterStage | null {
  const activeStage = getActiveInspectorLetterStageWindow(report, now);
  if (!activeStage || prepared.has(activeStage)) return null;
  return activeStage;
}

export function getInspectorLetterStageLabel(stage: InspectorLetterStage): string {
  switch (stage) {
    case "letter_1":
      return "מכתב ראשון";
    case "letter_2":
      return "מכתב שני";
    case "letter_3":
      return "מכתב שלישי";
  }
}

export function getInspectorLetterAlertTitle(stage: InspectorLetterStage): string {
  switch (stage) {
    case "letter_1":
      return "נדרש מכתב ראשון לחברת המעליות";
    case "letter_2":
      return "נדרש מכתב שני לחברת המעליות";
    case "letter_3":
      return "המועד לטיפול בהערות הבודק חלף";
  }
}

function formatDaysRemainingLabel(days: number): string {
  if (days > 0) return `נותרו ${days} ימים לסיום הטיפול`;
  if (days === 0) return "היום הוא מועד היעד לטיפול";
  return `איחור של ${Math.abs(days)} ימים מהמועד`;
}

function resolveElevatorCompanyField(
  elevatorCompany: string | null | undefined
): Record<string, MasterLetterFieldValue> {
  const trimmed = elevatorCompany?.trim() ?? "";
  if (!trimmed) return { elevator_company: "אחר", elevator_company_other: "" };

  const known = ELEVATOR_COMPANY_OPTIONS.find(
    (option) => option !== "אחר" && option === trimmed
  );
  if (known) return { elevator_company: known };
  return { elevator_company: "אחר", elevator_company_other: trimmed };
}

const ELEVATOR_CONTACT_HINTS = [
  "מעלית",
  "מעליות",
  "תחזוק",
  "שירות",
  "elevator",
  "maintenance",
];

export function suggestElevatorCompanyContact(
  contacts: ProjectContactWithDetails[],
  elevatorCompany: string | null | undefined
): ProjectContactWithDetails | null {
  const companyHint = elevatorCompany?.trim().toLowerCase() ?? "";

  for (const contact of contacts) {
    const role = `${contact.projectRole} ${contact.roleTitle}`.toLowerCase();
    if (ELEVATOR_CONTACT_HINTS.some((hint) => role.includes(hint))) {
      return contact;
    }
  }

  if (companyHint) {
    for (const contact of contacts) {
      if (contact.company.trim().toLowerCase().includes(companyHint)) {
        return contact;
      }
      if (
        companyHint.includes(contact.company.trim().toLowerCase()) &&
        contact.company.trim()
      ) {
        return contact;
      }
    }
  }

  return null;
}

function buildLetterIssueDetails(params: {
  stage: InspectorLetterStage;
  buildingName: string;
  report: InspectorReportRecord;
  elevatorLabel: string | null;
  letter1Prepared: boolean;
}): string {
  const reportDate = formatInspectorReportDate(params.report.report_date);
  const deadline = formatInspectorDeadline(params.report.deadline_at);
  const inspector = params.report.inspector_name?.trim() || "הבודק המוסמך";
  const documentLabel = params.report.document_name?.trim() || "תסקיר בודק";
  const elevatorLine = params.elevatorLabel
    ? `המכתב מתייחס למעלית: ${params.elevatorLabel}.`
    : "";

  switch (params.stage) {
    case "letter_1":
      return [
        `בהמשך ל${documentLabel} מיום ${reportDate} (${inspector}),`,
        "התקבל תסקיר בודק עם הערות לתיקון.",
        elevatorLine,
        `מועד אחרון להשלמת הטיפול: ${deadline}.`,
        "נבקש להשלים את הטיפול בהערות הבודק במסגרת המועד שנקבע,",
        "ולעדכן אותנו לאחר השלמת הטיפול.",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "letter_2":
      return [
        `בהמשך ל${documentLabel} מיום ${reportDate},`,
        params.letter1Prepared
          ? "ובהמשך למכתב הראשון שהועבר לכם,"
          : "",
        `נותרו 7 ימים למועד האחרון לטיפול (${deadline}).`,
        "טרם התקבל אישור על סגירת הטיפול בהערות הבודק.",
        "נבקש להשלים את הטיפול ולהעביר אישור על ביצוע.",
        elevatorLine,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "letter_3":
      return [
        `בהמשך ל${documentLabel} מיום ${reportDate},`,
        `המועד שנקבע להשלמת הטיפול (${deadline}) חלף.`,
        "הערות הבודק עדיין במעקב פתוח.",
        "נבקש להעביר התייחסות ולהשלים את הטיפול ללא דיחוי.",
        elevatorLine,
      ]
        .filter(Boolean)
        .join("\n\n");
  }
}

function buildLetterSubject(
  stage: InspectorLetterStage,
  buildingName: string
): string {
  switch (stage) {
    case "letter_1":
      return `תסקיר בודק עם הערות לתיקון — ${buildingName}`;
    case "letter_2":
      return `תזכורת — השלמת טיפול בהערות בודק — ${buildingName}`;
    case "letter_3":
      return `המועד לטיפול בהערות הבודק חלף — ${buildingName}`;
  }
}

function buildLetterTitle(stage: InspectorLetterStage, reportDate: string): string {
  const dateLabel = formatInspectorReportDate(reportDate);
  switch (stage) {
    case "letter_1":
      return `מכתב ראשון לחברת מעליות — תסקיר ${dateLabel}`;
    case "letter_2":
      return `מכתב שני לחברת מעליות — תסקיר ${dateLabel}`;
    case "letter_3":
      return `מכתב שלישי לחברת מעליות — תסקיר ${dateLabel}`;
  }
}

export function buildInspectorFollowUpLetterPrefill(input: {
  stage: InspectorLetterStage;
  report: InspectorReportRecord;
  buildingName: string;
  elevatorLabel: string | null;
  elevatorCompany: string | null | undefined;
  preparedStages: ReadonlySet<InspectorLetterStage>;
  suggestedContact: ProjectContactWithDetails | null;
}): InspectorFollowUpLetterPrefill {
  const issueTopic =
    input.stage === "letter_3"
      ? "המועד לטיפול בהערות הבודק חלף"
      : input.stage === "letter_2"
        ? "תזכורת — השלמת טיפול בהערות בודק"
        : "תסקיר בודק עם הערות לתיקון";

  const deadlineIso = input.report.deadline_at?.includes("T")
    ? input.report.deadline_at.split("T")[0]
    : input.report.deadline_at ?? normalizeReportDate(input.report.report_date);

  return {
    templateId: MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
    templateFields: {
      ...resolveElevatorCompanyField(input.elevatorCompany),
      issue_topic: issueTopic,
      response_deadline: deadlineIso ?? "",
      issue_details: buildLetterIssueDetails({
        stage: input.stage,
        buildingName: input.buildingName,
        report: input.report,
        elevatorLabel: input.elevatorLabel,
        letter1Prepared: input.preparedStages.has("letter_1"),
      }),
    },
    subject: buildLetterSubject(input.stage, input.buildingName),
    title: buildLetterTitle(input.stage, input.report.report_date),
    dossierSection: "inspections",
    elevatorId: input.report.elevator_id,
    suggestedContactRelationId: input.suggestedContact?.id ?? null,
    inspectorReportDocumentId: input.report.document_id ?? input.report.id,
    letterStage: input.stage,
  };
}

export function buildInspectorFollowUpAlert(
  report: InspectorReportRecord,
  stage: InspectorLetterStage,
  elevatorLabel: string,
  now: Date = new Date()
): InspectorFollowUpLetterAlert {
  const days = daysUntilInspectorDeadline(report, now);
  const deadlineLabel = formatInspectorDeadline(report.deadline_at);

  return {
    report,
    stage,
    title: getInspectorLetterAlertTitle(stage),
    subtitle: [
      elevatorLabel,
      `תסקיר מ-${formatInspectorReportDate(report.report_date)}`,
    ].join(" · "),
    deadlineLabel,
    daysRemainingLabel: formatDaysRemainingLabel(days),
    urgent: stage === "letter_3",
    prepareButtonLabel: stage === "letter_3" ? "הכן מכתב דחוף" : "הכן מכתב",
  };
}

export function computeInspectorFollowUpAlerts(input: {
  reports: InspectorReportRecord[];
  preparedByDocumentId: Record<string, ReadonlySet<InspectorLetterStage>>;
  elevatorLabelByReportId: Record<string, string>;
  now?: Date;
}): InspectorFollowUpLetterAlert[] {
  const now = input.now ?? new Date();
  const alerts: InspectorFollowUpLetterAlert[] = [];

  for (const report of input.reports) {
    if (report.status !== "open" || !report.has_remarks) continue;

    const documentId = report.document_id ?? report.id;
    const prepared =
      input.preparedByDocumentId[documentId] ?? new Set<InspectorLetterStage>();
    const stage = getNextRequiredInspectorLetterStage(report, prepared, now);
    if (!stage) continue;

    alerts.push(
      buildInspectorFollowUpAlert(
        report,
        stage,
        input.elevatorLabelByReportId[report.id] ?? "כל הבניין",
        now
      )
    );
  }

  return alerts.sort((a, b) => {
    const stageOrder = INSPECTOR_LETTER_STAGES.indexOf(a.stage) -
      INSPECTOR_LETTER_STAGES.indexOf(b.stage);
    if (stageOrder !== 0) return stageOrder;
    return b.report.report_date.localeCompare(a.report.report_date);
  });
}

export function buildInspectorFollowUpStatusSummary(input: {
  report: InspectorReportRecord;
  prepared: ReadonlySet<InspectorLetterStage>;
  elevatorLabel: string;
  now?: Date;
}): {
  active: boolean;
  reportDateLabel: string;
  inspectorName: string;
  elevatorLabel: string;
  deadlineLabel: string;
  daysRemainingLabel: string;
  nextLetterLabel: string;
} | null {
  if (input.report.status !== "open" || !input.report.has_remarks) return null;

  const now = input.now ?? new Date();
  const nextStage = getNextRequiredInspectorLetterStage(
    input.report,
    input.prepared,
    now
  );

  return {
    active: true,
    reportDateLabel: formatInspectorReportDate(input.report.report_date),
    inspectorName: input.report.inspector_name?.trim() || "—",
    elevatorLabel: input.elevatorLabel,
    deadlineLabel: formatInspectorDeadline(input.report.deadline_at),
    daysRemainingLabel: formatDaysRemainingLabel(
      daysUntilInspectorDeadline(input.report, now)
    ),
    nextLetterLabel: nextStage
      ? getInspectorLetterStageLabel(nextStage)
      : "כל המכתבים הוכנו — מעקב פתוח",
  };
}

export function inspectorFollowUpPopupSessionKey(
  buildingId: string,
  documentId: string,
  stage: InspectorLetterStage
): string {
  return `forte-v2-inspector-popup:${buildingId}:${documentId}:${stage}`;
}

export function isInspectorFollowUpPopupDismissed(
  buildingId: string,
  documentId: string,
  stage: InspectorLetterStage
): boolean {
  if (typeof window === "undefined") return false;
  return (
    sessionStorage.getItem(
      inspectorFollowUpPopupSessionKey(buildingId, documentId, stage)
    ) === "1"
  );
}

export function dismissInspectorFollowUpPopup(
  buildingId: string,
  documentId: string,
  stage: InspectorLetterStage
): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    inspectorFollowUpPopupSessionKey(buildingId, documentId, stage),
    "1"
  );
}
