import { NextRequest, NextResponse } from "next/server";
import type { CollectionForecastMutationResult } from "@/lib/collection-forecasts-server";
import { isAllowedForteApiOrigin } from "@/lib/forte-api-origin";
import {
  requireMasterApiSession,
  serviceUnavailableResponse,
} from "@/lib/forte-master-api-auth";
import { isSupabaseServiceConfigured } from "@/lib/supabase-server";

export function originForbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
}

export function guardCollectionForecastRequest(
  request: NextRequest
): NextResponse | null {
  if (!isAllowedForteApiOrigin(request)) return originForbiddenResponse();
  const authError = requireMasterApiSession(request);
  if (authError) return authError;
  if (!isSupabaseServiceConfigured()) {
    return serviceUnavailableResponse("supabase_service_unconfigured");
  }
  return null;
}

export function mutationResponse(
  result: CollectionForecastMutationResult
): NextResponse {
  if (result.forecast && !result.error) {
    return NextResponse.json({
      forecast: result.forecast,
      error: null,
      code: null,
      openBalance: null,
      excess: null,
    });
  }

  const status =
    result.code === "not_found" || result.code === "payment_not_found"
      ? 404
      : result.code === "planned_exceeds_balance" ||
          result.code === "linked_delete_forbidden" ||
          result.code === "linked_move_forbidden" ||
          result.code === "payment_already_linked"
        ? 409
        : result.code === "unconfigured"
          ? 503
          : 400;

  return NextResponse.json(
    {
      forecast: null,
      error: result.error,
      code: result.code,
      openBalance: result.openBalance,
      excess: result.excess,
    },
    { status }
  );
}
