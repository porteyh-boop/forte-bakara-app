import { NextRequest, NextResponse } from "next/server";
import { parseForecastRecordId } from "@/lib/collection-forecasts";
import {
  linkCollectionForecastPayment,
  unlinkCollectionForecastPayment,
} from "@/lib/collection-forecasts-server";
import {
  guardCollectionForecastRequest,
  mutationResponse,
} from "@/app/forte/api/collection-forecasts/respond";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ forecastId: string }> }
) {
  const blocked = guardCollectionForecastRequest(request);
  if (blocked) return blocked;

  const { forecastId: rawId } = await context.params;
  const forecastId = parseForecastRecordId(rawId);
  if (!forecastId) {
    return NextResponse.json({ error: "invalid_forecast_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const paymentId = parseForecastRecordId(body?.paymentId);
    if (!paymentId) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    return mutationResponse(await linkCollectionForecastPayment(forecastId, paymentId));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ forecastId: string }> }
) {
  const blocked = guardCollectionForecastRequest(request);
  if (blocked) return blocked;

  const { forecastId: rawId } = await context.params;
  const forecastId = parseForecastRecordId(rawId);
  if (!forecastId) {
    return NextResponse.json({ error: "invalid_forecast_id" }, { status: 400 });
  }

  return mutationResponse(await unlinkCollectionForecastPayment(forecastId));
}
