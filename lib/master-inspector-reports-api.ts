import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import {
  groupPreparedLetterStagesByDocumentId,
  type DocumentInspectorNotificationRecord,
} from "@/lib/document-inspector-notifications";
import type { InspectorLetterStage } from "@/lib/document-inspector-notifications";
import {
  mergePreparedLetterStageMaps,
} from "@/lib/inspector-follow-up-prepared-stages";
import type { InspectorReportRecord } from "@/lib/inspector-report-tracking";
import type {
  MasterInspectorNotificationDto,
  MasterInspectorReportDto,
  MasterInspectorReportListItemDto,
  MasterInspectorReportsListResult,
  MasterPreparedInspectorLetterStageDto,
} from "@/lib/master-inspector-reports-server";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

const MASTER_INSPECTOR_REPORTS_API = "/forte/api/master-inspector-reports";

interface ApiErrorPayload {
  error?: string;
}

interface CreateResponse {
  report?: MasterInspectorReportDto | null;
  error?: string | null;
  cleanupFailed?: boolean;
}

interface ListResponse {
  reports?: MasterInspectorReportListItemDto[];
  notifications?: MasterInspectorNotificationDto[];
  preparedLetterStages?: MasterPreparedInspectorLetterStageDto[];
  inspectorMetaDocumentIds?: string[];
  error?: string | null;
}

interface MutationResponse {
  ok?: boolean;
  report?: MasterInspectorReportListItemDto | null;
  error?: string | null;
}

export interface CreateMasterInspectorReportInput {
  buildingId: string;
  elevatorId?: string | null;
  documentName: string;
  reportDate: string;
  inspectorName?: string;
  hasRemarks: boolean;
  nextInspectionDate?: string | null;
  file: File;
}

export interface CreateMasterInspectorReportResult {
  report: MasterInspectorReportDto | null;
  error: string | null;
}

export type {
  MasterInspectorNotificationDto,
  MasterInspectorReportDto,
  MasterInspectorReportListItemDto,
  MasterInspectorReportsListResult,
  MasterPreparedInspectorLetterStageDto,
};

export function mapMasterInspectorReportListItemToRecord(
  item: MasterInspectorReportListItemDto
): InspectorReportRecord {
  return {
    id: item.id,
    document_id: item.document_id,
    source: item.source,
    building_id: item.building_id,
    elevator_id: item.elevator_id,
    report_date: item.report_date,
    inspector_name: item.inspector_name,
    document_name: item.document_name,
    document_url: item.document_url,
    file_url: item.file_url,
    document_description: null,
    has_remarks: item.has_remarks,
    deadline_at: item.deadline_at,
    next_inspection_date: item.next_inspection_date,
    status: item.status,
    closed_at: item.closed_at,
    closure_notes: item.closure_notes,
    created_at: "",
  };
}

export function mapMasterInspectorNotificationsToRecords(
  notifications: MasterInspectorNotificationDto[]
): DocumentInspectorNotificationRecord[] {
  return notifications.map((row) => ({
    id: `${row.document_id}:${row.notification_type}`,
    document_id: row.document_id,
    notification_type: row.notification_type,
    sent_at: row.sent_at,
  }));
}

export function buildPreparedStagesFromInspectorListResponse(input: {
  notifications: MasterInspectorNotificationDto[];
  preparedLetterStages: MasterPreparedInspectorLetterStageDto[];
}): Record<string, Set<InspectorLetterStage>> {
  const notificationRecords = mapMasterInspectorNotificationsToRecords(
    input.notifications
  );
  const fromNotifications =
    groupPreparedLetterStagesByDocumentId(notificationRecords);

  const fromLetters: Record<string, Set<InspectorLetterStage>> = {};
  for (const stage of input.preparedLetterStages) {
    const current =
      fromLetters[stage.reportDocumentId] ?? new Set<InspectorLetterStage>();
    current.add(stage.letterStage);
    fromLetters[stage.reportDocumentId] = current;
  }

  return mergePreparedLetterStageMaps(fromNotifications, fromLetters);
}

export function groupMasterInspectorNotificationsByDocumentId(
  notifications: MasterInspectorNotificationDto[]
): Record<string, DocumentInspectorNotificationRecord[]> {
  const grouped: Record<string, DocumentInspectorNotificationRecord[]> = {};
  for (const row of mapMasterInspectorNotificationsToRecords(notifications)) {
    if (!grouped[row.document_id]) {
      grouped[row.document_id] = [];
    }
    grouped[row.document_id].push(row);
  }
  return grouped;
}

export function isMasterInspectorReportsApiConfigured(): boolean {
  return isPilotCloudConfigured();
}

async function parseApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  return parseMasterApiError(payload, response.status);
}

function uploadInspectorReportWithProgress(
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", MASTER_INSPECTOR_REPORTS_API);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      resolve(
        new Response(JSON.stringify(xhr.response ?? {}), {
          status: xhr.status,
          headers: { "Content-Type": "application/json" },
        })
      );
    };

    xhr.onerror = () => reject(new Error("upload_network_error"));
    xhr.send(formData);
  });
}

export async function createMasterInspectorReport(
  input: CreateMasterInspectorReportInput,
  onProgress?: (percent: number) => void
): Promise<CreateMasterInspectorReportResult> {
  if (!isMasterInspectorReportsApiConfigured() || !input.buildingId.trim()) {
    return { report: null, error: "not_configured" };
  }

  if (typeof window === "undefined") {
    return { report: null, error: "browser_only" };
  }

  const formData = new FormData();
  formData.append("buildingId", input.buildingId.trim());
  formData.append("documentName", input.documentName.trim());
  formData.append("reportDate", input.reportDate.trim());
  formData.append("hasRemarks", input.hasRemarks ? "true" : "false");
  formData.append("file", input.file);

  if (input.elevatorId?.trim()) {
    formData.append("elevatorId", input.elevatorId.trim());
  }
  if (input.inspectorName?.trim()) {
    formData.append("inspectorName", input.inspectorName.trim());
  }
  if (input.nextInspectionDate?.trim()) {
    formData.append("nextInspectionDate", input.nextInspectionDate.trim());
  }

  try {
    onProgress?.(0);
    const response = await uploadInspectorReportWithProgress(formData, onProgress);
    onProgress?.(100);

    const payload = await parseMasterApiJson<CreateResponse>(response);
    if (!response.ok) {
      return {
        report: null,
        error: payload?.error ?? (await parseApiError(response)),
      };
    }

    if (!payload?.report) {
      return { report: null, error: payload?.error ?? "create_failed" };
    }

    return { report: payload.report, error: null };
  } catch (error) {
    console.warn("[master-inspector-reports-api] create error:", error);
    return { report: null, error: "create_failed" };
  }
}

export async function listMasterInspectorReports(
  buildingId: string
): Promise<MasterInspectorReportsListResult> {
  const empty: MasterInspectorReportsListResult = {
    reports: [],
    notifications: [],
    preparedLetterStages: [],
    inspectorMetaDocumentIds: [],
    error: null,
  };

  if (!isMasterInspectorReportsApiConfigured() || !buildingId.trim()) {
    return { ...empty, error: "not_configured" };
  }

  if (typeof window === "undefined") {
    return { ...empty, error: "browser_only" };
  }

  const normalized = buildingId.trim();
  const params = new URLSearchParams({ buildingId: normalized });

  try {
    const response = await masterApiFetch(
      `${MASTER_INSPECTOR_REPORTS_API}?${params.toString()}`
    );
    const payload = await parseMasterApiJson<ListResponse>(response);

    if (!response.ok) {
      return {
        ...empty,
        error: payload?.error ?? (await parseApiError(response)),
      };
    }

    return {
      reports: payload?.reports ?? [],
      notifications: payload?.notifications ?? [],
      preparedLetterStages: payload?.preparedLetterStages ?? [],
      inspectorMetaDocumentIds: payload?.inspectorMetaDocumentIds ?? [],
      error: null,
    };
  } catch (error) {
    console.warn("[master-inspector-reports-api] list error:", error);
    return { ...empty, error: "list_failed" };
  }
}

export async function closeMasterInspectorReport(
  reportId: string,
  buildingId: string,
  closureNotes?: string
): Promise<InspectorReportRecord | null> {
  if (
    !isMasterInspectorReportsApiConfigured() ||
    !reportId.trim() ||
    !buildingId.trim()
  ) {
    return null;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await masterApiFetch(
      `${MASTER_INSPECTOR_REPORTS_API}/${encodeURIComponent(reportId.trim())}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "close",
          buildingId: buildingId.trim(),
          closureNotes: closureNotes ?? "",
        }),
      }
    );
    const payload = await parseMasterApiJson<MutationResponse>(response);

    if (!response.ok || !payload?.ok || !payload.report) {
      console.warn(
        "[master-inspector-reports-api] close failed:",
        payload?.error ?? response.status
      );
      return null;
    }

    return mapMasterInspectorReportListItemToRecord(payload.report);
  } catch (error) {
    console.warn("[master-inspector-reports-api] close error:", error);
    return null;
  }
}

export async function deleteMasterInspectorReport(
  reportId: string,
  buildingId: string
): Promise<boolean> {
  if (
    !isMasterInspectorReportsApiConfigured() ||
    !reportId.trim() ||
    !buildingId.trim()
  ) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  try {
    const params = new URLSearchParams({ buildingId: buildingId.trim() });
    const response = await masterApiFetch(
      `${MASTER_INSPECTOR_REPORTS_API}/${encodeURIComponent(reportId.trim())}?${params.toString()}`,
      { method: "DELETE" }
    );
    const payload = await parseMasterApiJson<MutationResponse>(response);

    if (!response.ok || !payload?.ok) {
      console.warn(
        "[master-inspector-reports-api] delete failed:",
        payload?.error ?? response.status
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[master-inspector-reports-api] delete error:", error);
    return false;
  }
}
