import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  BUILDING_FORBIDDEN_ERROR,
  closeMasterInspectorReportServer,
  deleteMasterInspectorReportServer,
  parseInspectorReportId,
} from "@/lib/master-inspector-reports-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ reportId: string }>;
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

  const { reportId: routeReportId } = await context.params;
  const reportId = parseInspectorReportId(routeReportId);
  if (!reportId) {
    return NextResponse.json({ error: "invalid_report_id" }, { status: 400 });
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

    const action = typeof body?.action === "string" ? body.action : "";
    if (action !== "close") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }

    const closureNotes =
      body?.closureNotes === null
        ? null
        : typeof body?.closureNotes === "string"
          ? body.closureNotes
          : undefined;

    const result = await closeMasterInspectorReportServer(
      reportId,
      buildingId,
      closureNotes
    );

    if (result.error === BUILDING_FORBIDDEN_ERROR) {
      return buildingForbiddenResponse();
    }
    if (result.error === "not_found") return notFoundResponse();
    if (result.error === "invalid_building_id") {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }
    if (!result.ok || !result.report) {
      return NextResponse.json(
        { ok: false, report: null, error: result.error ?? "close_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, report: result.report, error: null },
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

  const { reportId: routeReportId } = await context.params;
  const reportId = parseInspectorReportId(routeReportId);
  if (!reportId) {
    return NextResponse.json({ error: "invalid_report_id" }, { status: 400 });
  }

  for (const field of FORBIDDEN_MUTATION_FIELDS) {
    if (request.nextUrl.searchParams.has(field)) {
      return NextResponse.json({ error: "forbidden_field" }, { status: 400 });
    }
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await deleteMasterInspectorReportServer(reportId, buildingId);
  if (result.error === BUILDING_FORBIDDEN_ERROR) {
    return buildingForbiddenResponse();
  }
  if (result.error === "not_found") return notFoundResponse();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "delete_failed" },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { ok: true, error: null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
