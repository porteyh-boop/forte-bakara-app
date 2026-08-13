import { NextRequest, NextResponse } from "next/server";
import { normalizeRequestedBuildingId } from "@/lib/building-contacts-server";
import { parseContactInput } from "@/lib/contacts-server";
import {
  attachContactsToProject,
  createContactAndAttachFromBody,
  listProjectContactsForBuilding,
  parseAttachContactsBody,
} from "@/lib/project-contacts-server";
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

  const buildingId = normalizeRequestedBuildingId(
    request.nextUrl.searchParams.get("buildingId")
  );
  if (!buildingId) {
    return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
  }

  const result = await listProjectContactsForBuilding(buildingId);
  if (result.error) {
    const status = result.error.includes("לא נמצא") ? 404 : 502;
    return NextResponse.json({ contacts: [], error: result.error }, { status });
  }

  return NextResponse.json({ contacts: result.contacts, error: null });
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

  try {
    const body = await request.json();
    const buildingId = normalizeRequestedBuildingId(body?.buildingId);
    if (!buildingId) {
      return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
    }

    const attachBody = parseAttachContactsBody(body);
    if (attachBody) {
      const normalizedBuildingId = normalizeRequestedBuildingId(attachBody.buildingId);
      if (!normalizedBuildingId) {
        return NextResponse.json({ error: "invalid_building_id" }, { status: 400 });
      }

      const result = await attachContactsToProject({
        buildingId: normalizedBuildingId,
        contactIds: attachBody.contactIds,
      });

      if (result.attached.length === 0) {
        return NextResponse.json(
          {
            attached: [],
            skipped: result.skipped,
            error: result.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        attached: result.attached,
        skipped: result.skipped,
        error: result.error,
      });
    }

    const input = parseContactInput(body?.input);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await createContactAndAttachFromBody({
      buildingId,
      input,
      projectRole:
        typeof body?.projectRole === "string" ? body.projectRole : undefined,
      isPrimary: Boolean(body?.isPrimary),
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
