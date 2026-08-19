import { NextRequest, NextResponse } from "next/server";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import {
  BUILDING_FORBIDDEN_ERROR,
  closeMasterFaultServer,
  deleteMasterFaultServer,
  parseFaultId,
  reopenMasterFaultServer,
  startMasterFaultTreatmentServer,
  updateMasterFaultTreatmentNoteServer,
} from "@/lib/master-faults-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ faultId: string }>;
}

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

  const { faultId: routeFaultId } = await context.params;
  const faultId = parseFaultId(routeFaultId);
  if (!faultId) {
    return NextResponse.json({ error: "invalid_fault_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const buildingId = parseBuildingIdFilter(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "start_treatment") {
      const treatmentNote =
        body?.treatmentNote === null
          ? null
          : typeof body?.treatmentNote === "string"
            ? body.treatmentNote
            : undefined;

      const result = await startMasterFaultTreatmentServer(
        faultId,
        buildingId,
        treatmentNote
      );
      if (result.error === BUILDING_FORBIDDEN_ERROR) {
        return buildingForbiddenResponse();
      }
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "start_treatment_failed" },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    if (action === "update_treatment_note") {
      const treatmentNote =
        typeof body?.treatmentNote === "string" ? body.treatmentNote : "";
      const result = await updateMasterFaultTreatmentNoteServer(
        faultId,
        buildingId,
        treatmentNote
      );
      if (result.error === BUILDING_FORBIDDEN_ERROR) {
        return buildingForbiddenResponse();
      }
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "update_treatment_note_failed" },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    if (action === "close") {
      const closureNote =
        body?.closureNote === null
          ? null
          : typeof body?.closureNote === "string"
            ? body.closureNote
            : undefined;

      const result = await closeMasterFaultServer(
        faultId,
        buildingId,
        closureNote
      );
      if (result.error === BUILDING_FORBIDDEN_ERROR) {
        return buildingForbiddenResponse();
      }
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "close_failed" },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    if (action === "reopen") {
      const result = await reopenMasterFaultServer(faultId, buildingId);
      if (result.error === BUILDING_FORBIDDEN_ERROR) {
        return buildingForbiddenResponse();
      }
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "reopen_failed" },
          { status: 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
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

  const { faultId: routeFaultId } = await context.params;
  const faultId = parseFaultId(routeFaultId);
  if (!faultId) {
    return NextResponse.json({ error: "invalid_fault_id" }, { status: 400 });
  }

  const buildingId = parseBuildingIdFilter(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await deleteMasterFaultServer(faultId, buildingId);
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

  return NextResponse.json({ ok: true, error: null });
}
