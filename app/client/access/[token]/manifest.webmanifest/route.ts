import { NextResponse } from "next/server";
import {
  buildClientPortalManifestDocument,
  normalizeClientPortalToken,
} from "@/lib/client-portal-manifest";
import { resolveClientPortalManifestLabels } from "@/lib/client-portal-manifest-labels";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params;
  const token = normalizeClientPortalToken(decodeURIComponent(rawToken));
  const labels = await resolveClientPortalManifestLabels(token);
  const manifest = buildClientPortalManifestDocument(token, labels);

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
