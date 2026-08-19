import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  DOCUMENTS_TABLE,
  DOCUMENT_TYPES,
  normalizeDocumentTags,
  resolveDocumentVisibility,
  type DocumentTypeId,
  type DocumentVisibility,
} from "@/lib/document-center";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const DOCUMENT_LIST_COLUMNS =
  "id, building_id, document_type, title, file_name, file_url, tags, visibility, created_at, ai_metadata";

export interface MasterDocumentDto {
  id: string;
  building_id: string;
  document_type: DocumentTypeId;
  title: string;
  file_name: string;
  file_url: string;
  tags: string[];
  visibility: DocumentVisibility;
  created_at: string;
  /** Required for InspectionsTab inspector letter follow-up stages only. */
  ai_metadata: Record<string, unknown> | null;
}

function normalizeDocumentType(value: unknown): DocumentTypeId {
  const documentType = String(value ?? "other");
  return DOCUMENT_TYPES.some((type) => type.id === documentType)
    ? (documentType as DocumentTypeId)
    : "other";
}

export function mapMasterDocumentDto(
  row: Record<string, unknown>
): MasterDocumentDto {
  const rawTags = row.tags;
  const tags = Array.isArray(rawTags)
    ? normalizeDocumentTags(rawTags.map((tag) => String(tag)))
    : [];

  const aiMetadata =
    row.ai_metadata && typeof row.ai_metadata === "object"
      ? (row.ai_metadata as Record<string, unknown>)
      : null;

  return {
    id: String(row.id),
    building_id: String(row.building_id).trim().toLowerCase(),
    document_type: normalizeDocumentType(row.document_type),
    title: String(row.title ?? ""),
    file_name: String(row.file_name ?? ""),
    file_url: String(row.file_url ?? ""),
    tags,
    visibility: resolveDocumentVisibility(row),
    created_at: String(row.created_at ?? ""),
    ai_metadata: aiMetadata,
  };
}

export async function listMasterDocumentsByBuildingServer(
  buildingId: string
): Promise<{ documents: MasterDocumentDto[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { documents: [], error: "supabase_service_unconfigured" };
  }

  const normalized = parseBuildingIdFilter(buildingId);
  if (!normalized) {
    return { documents: [], error: "invalid_building_id" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { documents: [], error: "supabase_service_unconfigured" };
  }

  const { data, error } = await client
    .from(DOCUMENTS_TABLE)
    .select(DOCUMENT_LIST_COLUMNS)
    .eq("building_id", normalized)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[master-documents-server] list failed:", error.message);
    return { documents: [], error: error.message || "list_failed" };
  }

  const documents = (data ?? []).map((row) =>
    mapMasterDocumentDto(row as Record<string, unknown>)
  );

  return { documents, error: null };
}
