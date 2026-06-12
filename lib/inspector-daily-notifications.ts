import { getBuildingDataset } from "./buildings";
import { getDocumentById } from "./document-center";
import type { DocumentInspectorMetaRecord } from "./document-inspector-meta";
import { listAllDocumentInspectorMeta } from "./document-inspector-meta";
import {
  getSentNotificationTypes,
  listAllDocumentInspectorNotifications,
  recordNotificationSent,
  type InspectorNotificationType,
} from "./document-inspector-notifications";
import {
  buildInspectorNotificationEmailText,
  sendInspectorNotificationEmail,
  type InspectorNotificationEmailPayload,
} from "./inspector-notification-email";
import {
  daysSinceReportDate,
  formatInspectorReportDate,
  getInspectorPhaseLabel,
  computeInspectorFollowUpPhase,
  INSPECTOR_ALERT_DAY,
  INSPECTOR_REMINDER_DAY,
  INSPECTOR_URGENT_DAY,
  type InspectorReportRecord,
} from "./inspector-report-tracking";

export interface InspectorDailyNotificationRunResult {
  ok: boolean;
  scanned: number;
  sent: Record<InspectorNotificationType, number>;
  skipped: number;
  errors: string[];
}

function resolveBuildingNameSafe(buildingId: string): string {
  try {
    return getBuildingDataset(buildingId).building.name;
  } catch {
    return buildingId;
  }
}

function resolveElevatorLabel(
  buildingId: string,
  elevatorId: string | null
): string {
  if (!elevatorId) return "כל הבניין";
  try {
    const elevator = getBuildingDataset(buildingId).elevators.find(
      (item) => item.id === elevatorId
    );
    return elevator?.name ?? elevatorId;
  } catch {
    return elevatorId;
  }
}

/** שלב יחיד לפי ימים — catch-up: ביום 45+ רק day_45_plus, לא 35/40 */
export function resolveInspectorNotificationType(
  daysSince: number
): InspectorNotificationType | null {
  if (daysSince >= INSPECTOR_URGENT_DAY) return "day_45_plus";
  if (daysSince >= INSPECTOR_ALERT_DAY) return "day_40";
  if (daysSince >= INSPECTOR_REMINDER_DAY) return "day_35";
  return null;
}

export function pickInspectorNotificationToSend(
  daysSince: number,
  alreadySent: ReadonlySet<InspectorNotificationType>
): InspectorNotificationType | null {
  const type = resolveInspectorNotificationType(daysSince);
  if (!type || alreadySent.has(type)) return null;
  return type;
}

function buildEmailPayload(params: {
  report: InspectorReportRecord;
  daysSince: number;
}): InspectorNotificationEmailPayload {
  return {
    buildingName: resolveBuildingNameSafe(params.report.building_id),
    elevatorLabel: resolveElevatorLabel(
      params.report.building_id,
      params.report.elevator_id
    ),
    reportDate: formatInspectorReportDate(params.report.report_date),
    inspectorName: params.report.inspector_name ?? "—",
    daysSinceReport: params.daysSince,
    statusLabel: getInspectorPhaseLabel(
      computeInspectorFollowUpPhase(params.report)
    ),
    documentUrl: params.report.file_url ?? "—",
  };
}

function mapMetaToReport(
  meta: DocumentInspectorMetaRecord,
  document: NonNullable<Awaited<ReturnType<typeof getDocumentById>>>
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

export async function runInspectorDailyNotifications(
  now: Date = new Date()
): Promise<InspectorDailyNotificationRunResult> {
  const result: InspectorDailyNotificationRunResult = {
    ok: true,
    scanned: 0,
    sent: { day_35: 0, day_40: 0, day_45_plus: 0 },
    skipped: 0,
    errors: [],
  };

  const [metaRows, existingNotifications] = await Promise.all([
    listAllDocumentInspectorMeta(),
    listAllDocumentInspectorNotifications(),
  ]);

  const notificationsByDocumentId = new Map<string, Set<InspectorNotificationType>>();
  for (const row of existingNotifications) {
    const current =
      notificationsByDocumentId.get(row.document_id) ??
      new Set<InspectorNotificationType>();
    current.add(row.notification_type);
    notificationsByDocumentId.set(row.document_id, current);
  }

  const openMetaRows = metaRows.filter(
    (meta) => meta.status === "open" && meta.has_remarks
  );

  for (const meta of openMetaRows) {
    result.scanned += 1;

    const document = await getDocumentById(meta.document_id);
    if (!document || document.document_type !== "inspector_report") {
      result.skipped += 1;
      continue;
    }

    const report = mapMetaToReport(meta, document);
    const daysSince = daysSinceReportDate(report.report_date, now);
    const alreadySent =
      notificationsByDocumentId.get(meta.document_id) ??
      getSentNotificationTypes([]);

    const typeToSend = pickInspectorNotificationToSend(daysSince, alreadySent);
    if (!typeToSend) {
      result.skipped += 1;
      continue;
    }

    const payload = buildEmailPayload({ report, daysSince });
    const sendResult = await sendInspectorNotificationEmail(typeToSend, payload);
    if (!sendResult.ok) {
      result.ok = false;
      result.errors.push(
        `${meta.document_id}/${typeToSend}: ${sendResult.error ?? "send failed"}`
      );
      continue;
    }

    const recorded = await recordNotificationSent({
      documentId: meta.document_id,
      notificationType: typeToSend,
    });
    if (!recorded) {
      result.skipped += 1;
      continue;
    }

    alreadySent.add(typeToSend);
    notificationsByDocumentId.set(meta.document_id, alreadySent);
    result.sent[typeToSend] += 1;
  }

  return result;
}

// QA / tests — וידוא שגוף המייל נבנה
export function buildInspectorDailyNotificationPreview(
  report: InspectorReportRecord,
  daysSince: number
): string {
  return buildInspectorNotificationEmailText(
    buildEmailPayload({ report, daysSince })
  );
}
