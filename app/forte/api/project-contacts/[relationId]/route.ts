import { NextRequest, NextResponse } from "next/server";
import { normalizeRequestedBuildingId } from "@/lib/building-contacts-server";
import {
  isProjectContactId,
  parseProjectContactUpdateInput,
  removeContactFromProject,
  updateProjectContactRelation,
} from "@/lib/project-contacts-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ relationId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
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

  const { relationId } = await context.params;
  if (!isProjectContactId(relationId)) {
    return NextResponse.json({ error: "invalid_relation_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const buildingId = normalizeRequestedBuildingId(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const patch = parseProjectContactUpdateInput(body);
    if (!patch) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await updateProjectContactRelation({
      relationId,
      buildingId,
      ...patch,
    });

    if (!result.contact) {
      const status = result.error?.includes("לא נמצא") ? 404 : 400;
      return NextResponse.json({ contact: null, error: result.error }, { status });
    }

    return NextResponse.json({ contact: result.contact, error: null });
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

  const { relationId } = await context.params;
  if (!isProjectContactId(relationId)) {
    return NextResponse.json({ error: "invalid_relation_id" }, { status: 400 });
  }

  const buildingId = normalizeRequestedBuildingId(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await removeContactFromProject({ relationId, buildingId });
  if (!result.ok) {
    const status = result.error?.includes("לא נמצא") ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, error: null });
}
