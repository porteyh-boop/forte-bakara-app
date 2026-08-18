import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  createClientUserAccessServer,
  listClientUserAccessRecordsServer,
  parseBuildingIdFilter,
  parseCreateClientUserAccessInput,
} from "@/lib/master-client-access-server";
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

  const result = await listClientUserAccessRecordsServer(buildingId);
  if (result.error) {
    return NextResponse.json(
      { records: [], error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({ records: result.records, error: null });
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
    const input = parseCreateClientUserAccessInput(body?.input ?? body);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const result = await createClientUserAccessServer(input);
    if (!result.session) {
      const status =
        result.error === "invalid_elevator" ? 400 : result.error ? 502 : 400;
      return NextResponse.json(
        { session: null, error: result.error ?? "create_failed" },
        { status }
      );
    }

    return NextResponse.json({ session: result.session, error: null });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
