import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  BUILDING_FORBIDDEN_ERROR,
  deleteMasterDocumentServer,
  parseDocumentId,
  updateMasterDocumentVisibilityServer,
  validateMasterDocumentVisibilityValue,
} from "@/lib/master-documents-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

const FORBIDDEN_MUTATION_FIELDS = [
  "storagePath",
  "storage_path",
  "fileUrl",
  "file_url",
  "bucket",
] as const;

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}

function buildingForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "building_forbidden" }, { status: 403 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { documentId: routeDocumentId } = await context.params;
  const documentId = parseDocumentId(routeDocumentId);
  if (!documentId) {
    return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
  }

  try {
    const body = await request.json();

    for (const field of FORBIDDEN_MUTATION_FIELDS) {
      if (field in (body ?? {})) {
        return NextResponse.json({ error: "forbidden_field" }, { status: 400 });
      }
    }

    const buildingId = parseBuildingIdFilter(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const action =
      typeof body?.action === "string" ? body.action.trim() : "";
    if (action !== "update_visibility") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const visibility = validateMasterDocumentVisibilityValue(body?.visibility);
    if (!visibility) {
      return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
    }

    const result = await updateMasterDocumentVisibilityServer(
      documentId,
      buildingId,
      visibility
    );

    if (result.error === BUILDING_FORBIDDEN_ERROR) {
      return buildingForbiddenResponse();
    }
    if (result.error === "not_found") return notFoundResponse();
    if (!result.document) {
      return NextResponse.json(
        { document: null, error: result.error ?? "visibility_update_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { document: result.document, error: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { documentId: routeDocumentId } = await context.params;
  const documentId = parseDocumentId(routeDocumentId);
  if (!documentId) {
    return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await deleteMasterDocumentServer(documentId, buildingId);

  if (result.error === BUILDING_FORBIDDEN_ERROR) {
    return buildingForbiddenResponse();
  }
  if (result.error === "not_found") return notFoundResponse();
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "delete_failed",
        storageDeleted: result.storageDeleted ?? false,
        dbDeleted: result.dbDeleted ?? false,
        partialFailure: result.partialFailure ?? false,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, error: null });
}
