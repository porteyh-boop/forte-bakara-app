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
