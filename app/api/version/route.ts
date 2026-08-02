import { NextResponse } from "next/server";
import { resolveServerBuildVersion } from "@/lib/app-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = resolveServerBuildVersion();

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
