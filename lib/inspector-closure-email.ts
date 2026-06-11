import { getMasterCode } from "./pilot-cloud";
import {
  formatInspectorReportDate,
  getInspectorPhaseLabel,
  computeInspectorFollowUpPhase,
  type InspectorReportRecord,
} from "./inspector-report-tracking";

export const INSPECTOR_NOTIFY_EMAIL = "lifts.forte@gmail.com";

export interface InspectorClosureEmailPayload {
  buildingName: string;
  elevatorLabel: string;
  reportDate: string;
  inspectorName: string;
  statusLabel: string;
  closureNotes: string;
  documentUrl: string;
  dossierUrl: string;
}

export function buildInspectorClosureEmailPayload(params: {
  report: InspectorReportRecord;
  buildingName: string;
  elevatorLabel: string;
  documentUrl: string | null;
  dossierUrl: string;
  closureNotes?: string;
}): InspectorClosureEmailPayload {
  const closedReport: InspectorReportRecord = {
    ...params.report,
    status: "closed",
    closure_notes: params.closureNotes?.trim() || params.report.closure_notes,
  };

  return {
    buildingName: params.buildingName,
    elevatorLabel: params.elevatorLabel || "—",
    reportDate: formatInspectorReportDate(params.report.report_date),
    inspectorName: params.report.inspector_name ?? "—",
    statusLabel: getInspectorPhaseLabel(
      computeInspectorFollowUpPhase(closedReport)
    ),
    closureNotes: params.closureNotes?.trim() || params.report.closure_notes || "—",
    documentUrl: params.documentUrl ?? "—",
    dossierUrl: params.dossierUrl || "—",
  };
}

export function buildInspectorClosureEmailSubject(): string {
  return "עודכן תיעוד ביצוע הערות בודק מוסמך";
}

export function buildInspectorClosureEmailText(
  payload: InspectorClosureEmailPayload
): string {
  return [
    "עודכן תיעוד ביצוע הערות בתסקיר בודק.",
    "",
    `בניין: ${payload.buildingName}`,
    `מעלית: ${payload.elevatorLabel}`,
    `תאריך תסקיר: ${payload.reportDate}`,
    `שם בודק: ${payload.inspectorName}`,
    `סטטוס: ${payload.statusLabel}`,
    `הערות סגירה: ${payload.closureNotes}`,
    `קישור למסמך / לתיק המעלית: ${payload.documentUrl}`,
    payload.dossierUrl !== payload.documentUrl
      ? `תיק מעלית: ${payload.dossierUrl}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendInspectorClosureNotification(
  payload: InspectorClosureEmailPayload
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "browser-only" };
  }

  const masterCode = getMasterCode();
  if (!masterCode) {
    return { ok: false, error: "master code not configured" };
  }

  try {
    const response = await fetch("/api/master/inspector-closure-notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-master-code": masterCode,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      return {
        ok: false,
        error: body.error ?? `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
