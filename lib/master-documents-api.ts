import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { MasterDocumentDto } from "@/lib/master-documents-server";
import {
  type DocumentRecord,
  type DocumentTypeId,
  type DocumentVisibility,
} from "@/lib/document-center";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

const MASTER_DOCUMENTS_API = "/forte/api/master-documents";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  documents?: MasterDocumentDto[];
  error?: string | null;
}

interface UploadResponse {
  document?: MasterDocumentDto | null;
  error?: string | null;
}

interface VisibilityResponse {
  document?: MasterDocumentDto | null;
  error?: string | null;
}

interface DeleteResponse {
  ok?: boolean;
  error?: string | null;
}

export interface UploadMasterDocumentInput {
  buildingId: string;
  documentType: DocumentTypeId;
  title: string;
  file: File;
  tags?: string[];
  visibility?: DocumentVisibility;
}

export interface UploadMasterDocumentResult {
  document: DocumentRecord | null;
  error: string | null;
}

export interface UpdateMasterDocumentVisibilityResult {
  document: DocumentRecord | null;
  error: string | null;
}

export interface DeleteMasterDocumentResult {
  ok: boolean;
  error: string | null;
}

export type { MasterDocumentDto };

export function isMasterDocumentsApiConfigured(): boolean {
  return isPilotCloudConfigured();
}

/** Maps secure list DTO to DocumentRecord for existing V2 UI/mutation paths (3A read-only). */
export function mapMasterDocumentDtoToRecord(
  dto: MasterDocumentDto
): DocumentRecord {
  return {
    id: dto.id,
    building_id: dto.building_id,
    elevator_id: null,
    document_type: dto.document_type as DocumentTypeId,
    title: dto.title,
    description: null,
    file_name: dto.file_name,
    file_url: dto.file_url,
    storage_path: "",
    mime_type: null,
    file_size_bytes: null,
    tags: dto.tags,
    ocr_status: "none",
    ocr_text: null,
    ai_summary: null,
    ai_metadata: dto.ai_metadata,
    visibility: dto.visibility as DocumentVisibility,
    created_at: dto.created_at,
    updated_at: dto.created_at,
  };
}

async function parseApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  return parseMasterApiError(payload, response.status);
}

export async function listMasterDocumentsByBuilding(
  buildingId: string
): Promise<DocumentRecord[]> {
  if (!isMasterDocumentsApiConfigured() || !buildingId.trim()) return [];

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await masterApiFetch(
      `${MASTER_DOCUMENTS_API}?${params.toString()}`,
      { method: "GET", cache: "no-store" }
    );

    const payload = await parseMasterApiJson<ListResponse>(response);
    if (!response.ok) {
      console.warn(
        "[master-documents-api] list failed:",
        payload?.error ?? (await parseApiError(response))
      );
      return [];
    }

    return (payload?.documents ?? []).map(mapMasterDocumentDtoToRecord);
  } catch (error) {
    console.warn("[master-documents-api] list error:", error);
    return [];
  }
}

function uploadMasterDocumentWithProgress(
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", MASTER_DOCUMENTS_API);
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

export async function uploadMasterDocument(
  input: UploadMasterDocumentInput,
  onProgress?: (percent: number) => void
): Promise<UploadMasterDocumentResult> {
  if (!isMasterDocumentsApiConfigured() || !input.buildingId.trim()) {
    return { document: null, error: "not_configured" };
  }

  if (typeof window === "undefined") {
    return { document: null, error: "browser_only" };
  }

  const formData = new FormData();
  formData.append("buildingId", input.buildingId.trim());
  formData.append("documentType", input.documentType);
  formData.append("title", input.title.trim());
  formData.append("file", input.file);
  formData.append("tags", JSON.stringify(input.tags ?? []));
  if (input.visibility) {
    formData.append("visibility", input.visibility);
  }

  try {
    onProgress?.(0);
    const response = await uploadMasterDocumentWithProgress(formData, onProgress);
    onProgress?.(100);

    const payload = await parseMasterApiJson<UploadResponse>(response);
    if (!response.ok) {
      return {
        document: null,
        error: payload?.error ?? (await parseApiError(response)),
      };
    }

    if (!payload?.document) {
      return { document: null, error: payload?.error ?? "upload_failed" };
    }

    return {
      document: mapMasterDocumentDtoToRecord(payload.document),
      error: null,
    };
  } catch (error) {
    console.warn("[master-documents-api] upload error:", error);
    return { document: null, error: "upload_failed" };
  }
}

export async function updateMasterDocumentVisibility(
  buildingId: string,
  documentId: string,
  visibility: DocumentVisibility
): Promise<UpdateMasterDocumentVisibilityResult> {
  if (!isMasterDocumentsApiConfigured() || !buildingId.trim() || !documentId.trim()) {
    return { document: null, error: "not_configured" };
  }

  try {
    const response = await masterApiFetch(
      `${MASTER_DOCUMENTS_API}/${encodeURIComponent(documentId.trim())}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          buildingId: buildingId.trim(),
          action: "update_visibility",
          visibility,
        }),
      }
    );

    const payload = await parseMasterApiJson<VisibilityResponse>(response);
    if (!response.ok) {
      return {
        document: null,
        error: payload?.error ?? (await parseApiError(response)),
      };
    }

    if (!payload?.document) {
      return {
        document: null,
        error: payload?.error ?? "visibility_update_failed",
      };
    }

    return {
      document: mapMasterDocumentDtoToRecord(payload.document),
      error: null,
    };
  } catch (error) {
    console.warn("[master-documents-api] visibility update error:", error);
    return { document: null, error: "visibility_update_failed" };
  }
}

export async function deleteMasterDocument(
  buildingId: string,
  documentId: string
): Promise<DeleteMasterDocumentResult> {
  if (!isMasterDocumentsApiConfigured() || !buildingId.trim() || !documentId.trim()) {
    return { ok: false, error: "not_configured" };
  }

  try {
    const params = new URLSearchParams({ buildingId: buildingId.trim() });
    const response = await masterApiFetch(
      `${MASTER_DOCUMENTS_API}/${encodeURIComponent(documentId.trim())}?${params.toString()}`,
      { method: "DELETE" }
    );

    const payload = await parseMasterApiJson<DeleteResponse>(response);
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error ?? (await parseApiError(response)),
      };
    }

    return { ok: Boolean(payload?.ok), error: null };
  } catch (error) {
    console.warn("[master-documents-api] delete error:", error);
    return { ok: false, error: "delete_failed" };
  }
}
