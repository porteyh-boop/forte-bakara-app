import { NextRequest, NextResponse } from "next/server";
import {
  currentForecastMonth,
  formatForecastMonthLabel,
  normalizeForecastMonth,
  parseCollectionForecastCreateBody,
} from "@/lib/collection-forecasts";
import {
  createCollectionForecast,
  loadCollectionForecastScreen,
  presentCollectionForecastScreen,
} from "@/lib/collection-forecasts-server";
import {
  guardCollectionForecastRequest,
  mutationResponse,
} from "@/app/forte/api/collection-forecasts/respond";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = guardCollectionForecastRequest(request);
  if (blocked) return blocked;

  const rawMonth = request.nextUrl.searchParams.get("month");
  const month = rawMonth?.trim()
    ? normalizeForecastMonth(rawMonth)
    : currentForecastMonth();
  if (!month) {
    return NextResponse.json({ error: "invalid_month" }, { status: 400 });
  }

  const data = await loadCollectionForecastScreen(month);
  if (data.error) {
    return NextResponse.json({ screen: null, error: data.error }, { status: 502 });
  }

  const model = presentCollectionForecastScreen(data);
  return NextResponse.json(
    {
      screen: {
        month,
        monthLabel: formatForecastMonthLabel(month),
        projects: model.projects,
        forecasts: model.forecasts,
        payments: model.payments,
      },
      error: null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const blocked = guardCollectionForecastRequest(request);
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const input = parseCollectionForecastCreateBody(body);
    if (!input) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    return mutationResponse(await createCollectionForecast(input));
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
}
