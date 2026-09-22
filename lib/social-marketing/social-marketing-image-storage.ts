import {
  buildDocumentPublicUrl,
  DOCUMENT_CENTER_BUCKET,
} from "@/lib/document-center";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const MARKETING_IMAGE_PREFIX = "forte-marketing/social";

export type MarketingImageUploadError =
  | "supabase_service_unconfigured"
  | "upload_failed"
  | "public_url_failed";

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildMarketingSocialImagePath(now: Date = new Date()): string {
  const datePart = now.toISOString().split("T")[0];
  return `${MARKETING_IMAGE_PREFIX}/${datePart}/${randomId()}.png`;
}

export async function uploadMarketingSocialImageServer(input: {
  pngBuffer: Buffer;
  storagePath?: string;
}): Promise<{
  storagePath: string;
  publicUrl: string;
  error: MarketingImageUploadError | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { storagePath: "", publicUrl: "", error: "supabase_service_unconfigured" };
  }
  const client = getSupabaseServiceClient();
  if (!client) {
    return { storagePath: "", publicUrl: "", error: "supabase_service_unconfigured" };
  }

  const storagePath = (input.storagePath ?? buildMarketingSocialImagePath()).trim();
  if (!storagePath.startsWith(`${MARKETING_IMAGE_PREFIX}/`)) {
    return { storagePath: "", publicUrl: "", error: "upload_failed" };
  }

  const { error: uploadError } = await client.storage
    .from(DOCUMENT_CENTER_BUCKET)
    .upload(storagePath, input.pngBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.warn("[social-marketing-image] upload_failed", {
      message: uploadError.message.slice(0, 200),
    });
    return { storagePath: "", publicUrl: "", error: "upload_failed" };
  }

  const publicUrl = buildDocumentPublicUrl(storagePath);
  if (!publicUrl) {
    await removeMarketingSocialImagesServer([storagePath]);
    return { storagePath: "", publicUrl: "", error: "public_url_failed" };
  }

  return { storagePath, publicUrl, error: null };
}

export async function removeMarketingSocialImagesServer(
  storagePaths: string[]
): Promise<void> {
  const paths = storagePaths.filter((p) => p.trim().startsWith(`${MARKETING_IMAGE_PREFIX}/`));
  if (paths.length === 0) return;
  if (!isSupabaseServiceConfigured()) return;
  const client = getSupabaseServiceClient();
  if (!client) return;

  const { error } = await client.storage.from(DOCUMENT_CENTER_BUCKET).remove(paths);
  if (error) {
    console.warn("[social-marketing-image] cleanup_failed", {
      count: paths.length,
      message: error.message.slice(0, 200),
    });
  }
}
