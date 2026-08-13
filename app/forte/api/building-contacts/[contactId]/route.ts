import { NextRequest, NextResponse } from "next/server";
import {
  deleteBuildingContactForBuilding,
  isBuildingContactId,
  normalizeRequestedBuildingId,
  parseBuildingContactInput,
  updateBuildingContactForBuilding,
} from "@/lib/building-contacts-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ contactId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

async function handleUpdate(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  if (!isAllowedForteApiOrigin(request)) {
    return originForbiddenResponse();
  }

  const authError = requireMasterApiSession(request);
  if (authError) return authError;

  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }

  const { contactId } = await context.params;
  if (!isBuildingContactId(contactId)) {
    return NextResponse.json({ error: "invalid_contact_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const buildingId = normalizeRequestedBuildingId(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const input = parseBuildingContactInput(body?.input);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await updateBuildingContactForBuilding(
      contactId,
      buildingId,
      input
    );
    if (!result.contact) {
      const status = result.error?.includes("לא נמצא") ? 404 : 400;
      return NextResponse.json({ contact: null, error: result.error }, { status });
    }

    return NextResponse.json({ contact: result.contact, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return handleUpdate(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleUpdate(request, context);
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

  const { contactId } = await context.params;
  if (!isBuildingContactId(contactId)) {
    return NextResponse.json({ error: "invalid_contact_id" }, { status: 400 });
  }

  const buildingId = normalizeRequestedBuildingId(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await deleteBuildingContactForBuilding(contactId, buildingId);
  if (!result.ok) {
    const status = result.error?.includes("לא נמצא") ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, error: null });
}
