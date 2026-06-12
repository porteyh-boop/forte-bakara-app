import { NextResponse } from "next/server";
import { runInspectorDailyNotifications } from "@/lib/inspector-daily-notifications";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPilotCloudConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const result = await runInspectorDailyNotifications();
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
