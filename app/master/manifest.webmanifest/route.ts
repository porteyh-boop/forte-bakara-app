import { NextResponse } from "next/server";
import { buildMasterManifestDocument } from "@/lib/master-manifest";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildMasterManifestDocument(), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
