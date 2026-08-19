import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  createMasterInspectorReportServer,
  listMasterInspectorReportsByBuildingServer,
  validateMasterInspectorReportCreateMetadata,
} from "@/lib/master-inspector-reports-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const FORBIDDEN_UPLOAD_FIELDS = [
  "storagePath",
  "storage_path",
  "fileUrl",
  "file_url",
  "bucket",
  "documentId",
  "document_id",
] as const;

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

  const result = await listMasterInspectorReportsByBuildingServer(buildingId);
  if (result.error) {
    const status =
      result.error === "invalid_building_id"
        ? 400
        : result.error === "supabase_service_unconfigured"
          ? 503
          : 502;
    return NextResponse.json(
      {
        reports: [],
        notifications: [],
        preparedLetterStages: [],
        inspectorMetaDocumentIds: [],
        error: result.error,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      reports: result.reports,
      notifications: result.notifications,
      preparedLetterStages: result.preparedLetterStages,
      inspectorMetaDocumentIds: result.inspectorMetaDocumentIds,
      error: null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
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

  const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
  const metadataError = validateMasterInspectorReportCreateMetadata({
    buildingId,
    elevatorId: formData.get("elevatorId"),
    documentName: formData.get("documentName"),
    reportDate: formData.get("reportDate"),
    inspectorName: formData.get("inspectorName"),
    hasRemarks: formData.get("hasRemarks"),
    nextInspectionDate: formData.get("nextInspectionDate"),
    fileName: fileEntry.name,
    mimeType: fileEntry.type,
    fileSizeBytes: fileBuffer.byteLength,
  });

  if (metadataError) {
    return NextResponse.json({ error: metadataError }, { status: 400 });
  }

  const hasRemarksRaw = formData.get("hasRemarks");
  const hasRemarks = String(hasRemarksRaw ?? "").trim() === "true";

  const elevatorRaw = formData.get("elevatorId");
  const elevatorId =
    elevatorRaw === null || String(elevatorRaw).trim() === ""
      ? null
      : String(elevatorRaw).trim();

  const nextInspectionRaw = formData.get("nextInspectionDate");
  const nextInspectionDate =
    nextInspectionRaw === null || String(nextInspectionRaw).trim() === ""
      ? null
      : String(nextInspectionRaw).trim().split("T")[0];

  const result = await createMasterInspectorReportServer({
    buildingId,
    elevatorId,
    documentName: String(formData.get("documentName") ?? fileEntry.name).trim(),
    reportDate: String(formData.get("reportDate")).trim().split("T")[0],
    inspectorName: String(formData.get("inspectorName") ?? "").trim() || undefined,
    hasRemarks,
    nextInspectionDate,
    fileName: fileEntry.name,
    fileBuffer,
    mimeType: fileEntry.type,
    fileSizeBytes: fileBuffer.byteLength,
  });

  if (!result.report) {
    const status =
      result.error === "supabase_service_unconfigured" ? 503 : 502;
    return NextResponse.json(
      {
        report: null,
        error: result.error ?? "create_failed",
        cleanupFailed: result.cleanupFailed ?? false,
        partialCleanup: result.partialCleanup ?? null,
      },
      { status }
    );
  }

  return NextResponse.json(
    {
      report: result.report,
      error: null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
