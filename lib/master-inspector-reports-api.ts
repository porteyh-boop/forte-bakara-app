import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { MasterInspectorReportDto } from "@/lib/master-inspector-reports-server";
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

export type { MasterInspectorReportDto };

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
