import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  listMasterDocumentsByBuildingServer,
  uploadMasterDocumentServer,
  validateMasterDocumentUploadMetadata,
} from "@/lib/master-documents-server";
import {
  normalizeDocumentTags,
  normalizeDocumentVisibility,
  type DocumentTypeId,
  type DocumentVisibility,
} from "@/lib/document-center";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await listMasterDocumentsByBuildingServer(buildingId);
  if (result.error) {
    return NextResponse.json(
      { documents: [], error: result.error },
      { status: result.error === "invalid_building_id" ? 400 : 502 }
    );
  }

  return NextResponse.json(
    { documents: result.documents, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

const FORBIDDEN_UPLOAD_FIELDS = [
  "storagePath",
  "storage_path",
  "fileUrl",
  "file_url",
  "bucket",
] as const;

function parseTagsField(raw: FormDataEntryValue | null): string[] | null {
  if (raw === null) return [];
  const value = String(raw).trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return null;
    return normalizeDocumentTags(parsed.map((tag) => String(tag)));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  for (const field of FORBIDDEN_UPLOAD_FIELDS) {
    if (formData.has(field)) {
      return NextResponse.json({ error: "forbidden_field" }, { status: 400 });
    }
  }

  const buildingId = parseBuildingIdFilter(formData.get("buildingId"));
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const tags = parseTagsField(formData.get("tags"));
  if (tags === null) {
    return NextResponse.json({ error: "invalid_tags" }, { status: 400 });
  }

  const visibilityRaw = formData.get("visibility");
  const visibility =
    visibilityRaw === null || String(visibilityRaw).trim() === ""
      ? undefined
      : normalizeDocumentVisibility(String(visibilityRaw));

  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
  const metadataError = validateMasterDocumentUploadMetadata({
    buildingId,
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    fileSizeBytes: fileBuffer.byteLength,
    tags,
    visibility,
  });

  if (metadataError) {
    const status =
      metadataError === "invalid_building_id" ? 400 : 400;
    return NextResponse.json({ error: metadataError }, { status });
  }

  const documentType = String(formData.get("documentType")).trim() as DocumentTypeId;
  const title = String(formData.get("title") ?? fileEntry.name).trim();

  const result = await uploadMasterDocumentServer({
    buildingId,
    documentType,
    title,
    fileName: fileEntry.name,
    fileBuffer,
    mimeType: fileEntry.type,
    fileSizeBytes: fileBuffer.byteLength,
    tags,
    visibility: visibility as DocumentVisibility | undefined,
  });

  if (!result.document) {
    const status =
      result.error === "supabase_service_unconfigured" ? 503 : 502;
    return NextResponse.json(
      {
        document: null,
        error: result.error ?? "upload_failed",
        cleanupFailed: result.cleanupFailed ?? false,
      },
      { status }
    );
  }

  return NextResponse.json(
    { document: result.document, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
