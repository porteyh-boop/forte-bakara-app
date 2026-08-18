import { NextRequest, NextResponse } from "next/server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import {
  deactivateClientAccessServer,
  parseClientUserId,
  parseUpdateClientAccessScopeInput,
  parseUpdateClientUserProfileInput,
  reactivateClientAccessServer,
  updateClientAccessScopeServer,
  updateClientUserProfileServer,
} from "@/lib/master-client-access-server";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

function notFoundResponse(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
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

  const { userId: routeUserId } = await context.params;
  const userId = parseClientUserId(routeUserId);
  if (!userId) {
    return NextResponse.json({ error: "invalid_user_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "deactivate") {
      const result = await deactivateClientAccessServer(userId);
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "deactivate_failed" },
          { status: result.error === "invalid_user_id" ? 400 : 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    if (action === "reactivate") {
      const result = await reactivateClientAccessServer(userId);
      if (result.error === "not_found") return notFoundResponse();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "reactivate_failed" },
          { status: result.error === "invalid_user_id" ? 400 : 502 }
        );
      }
      return NextResponse.json({ ok: true, error: null });
    }

    if (action === "update_scope") {
      const scopeInput = parseUpdateClientAccessScopeInput({
        ...body,
        userId,
      });
      if (!scopeInput) {
        return NextResponse.json({ error: "invalid_input" }, { status: 400 });
      }

      const result = await updateClientAccessScopeServer(scopeInput);
      if (result.error === "not_found") return notFoundResponse();
      if (!result.session) {
        const status = result.error === "invalid_elevator" ? 400 : 502;
        return NextResponse.json(
          { session: null, error: result.error ?? "update_scope_failed" },
          { status }
        );
      }
      return NextResponse.json({ session: result.session, error: null });
    }

    if (action === "update_profile") {
      const profileInput = parseUpdateClientUserProfileInput({
        ...body,
        userId,
      });
      if (!profileInput) {
        return NextResponse.json({ error: "invalid_input" }, { status: 400 });
      }

      const result = await updateClientUserProfileServer(profileInput);
      if (result.error === "not_found") return notFoundResponse();
      if (!result.user) {
        return NextResponse.json(
          { user: null, error: result.error ?? "update_profile_failed" },
          { status: result.error === "invalid_input" ? 400 : 502 }
        );
      }
      return NextResponse.json({ user: result.user, error: null });
    }

    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
