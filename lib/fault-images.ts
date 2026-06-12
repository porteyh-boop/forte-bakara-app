import type { Fault } from "./types";
import type { PilotCloudFault } from "./pilot-cloud";

export interface FaultReportImage {
  src: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  /** נטען מ-URL חיצוני (למשל Supabase Storage) */
  fromStorage?: boolean;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function clampFaultImageZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function isRemoteFaultImageSrc(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    if (segment) return decodeURIComponent(segment);
  } catch {
    /* ignore */
  }
  return "report-image.jpg";
}

function guessMimeType(src: string, fallback = "image/jpeg"): string {
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;,]+)/);
    return match?.[1] ?? fallback;
  }
  const lower = src.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return fallback;
}

function normalizeImageEntry(
  value: unknown,
  index: number
): FaultReportImage | null {
  if (typeof value === "string" && value.trim()) {
    const src = value.trim();
    return {
      src,
      name: isRemoteFaultImageSrc(src)
        ? fileNameFromUrl(src)
        : `report-image-${index + 1}.jpg`,
      mimeType: guessMimeType(src),
      fromStorage: isRemoteFaultImageSrc(src),
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const src =
      typeof record.url === "string"
        ? record.url
        : typeof record.src === "string"
          ? record.src
          : null;
    if (!src?.trim()) return null;
    const trimmed = src.trim();
    return {
      src: trimmed,
      name:
        typeof record.name === "string" && record.name.trim()
          ? record.name.trim()
          : isRemoteFaultImageSrc(trimmed)
            ? fileNameFromUrl(trimmed)
            : `report-image-${index + 1}.jpg`,
      mimeType:
        typeof record.mimeType === "string"
          ? record.mimeType
          : guessMimeType(trimmed),
      fromStorage: isRemoteFaultImageSrc(trimmed),
    };
  }

  return null;
}

function parseJsonImageList(raw: string): FaultReportImage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => normalizeImageEntry(entry, index))
      .filter((entry): entry is FaultReportImage => entry !== null);
  } catch {
    return [];
  }
}

function parseDelimitedImageUrls(raw: string): FaultReportImage[] {
  return raw
    .split(/[\n,|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((src, index) => normalizeImageEntry(src, index))
    .filter((entry): entry is FaultReportImage => entry !== null);
}

function parseImageField(raw: string | null | undefined): FaultReportImage[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const fromJson = parseJsonImageList(trimmed);
    if (fromJson.length > 0) return fromJson;
  }

  if (isRemoteFaultImageSrc(trimmed) || trimmed.startsWith("data:")) {
    return [normalizeImageEntry(trimmed, 0)!];
  }

  return parseDelimitedImageUrls(trimmed);
}

export function resolveFaultReportImages(input: {
  imageUrl?: string | null;
  imageData?: string | null;
  localImage?: Fault["image"];
}): FaultReportImage[] {
  const fromStorage = parseImageField(input.imageUrl);
  if (fromStorage.length > 0) return fromStorage;

  const fromData = parseImageField(input.imageData);
  if (fromData.length > 0) return fromData;

  if (input.localImage?.dataUrl) {
    const src = input.localImage.dataUrl;
    return [
      {
        src,
        name: input.localImage.name || "report-image.jpg",
        mimeType: input.localImage.mimeType,
        sizeBytes: input.localImage.sizeBytes,
        fromStorage: isRemoteFaultImageSrc(src),
      },
    ];
  }

  return [];
}

export function resolveFaultReportImagesFromCloud(
  fault: Pick<PilotCloudFault, "image_url" | "image_data">
): FaultReportImage[] {
  return resolveFaultReportImages({
    imageUrl: fault.image_url,
    imageData: fault.image_data,
  });
}

export function resolveFaultReportImagesFromFault(fault: Fault): FaultReportImage[] {
  return resolveFaultReportImages({ localImage: fault.image });
}

function sanitizeDownloadName(name: string): string {
  const cleaned = name.trim().replace(/[/\\?%*:|"<>]/g, "_");
  return cleaned || "report-image.jpg";
}

export async function downloadFaultReportImage(
  image: FaultReportImage
): Promise<void> {
  if (typeof document === "undefined") return;

  const fileName = sanitizeDownloadName(image.name);

  if (image.src.startsWith("data:")) {
    const anchor = document.createElement("a");
    anchor.href = image.src;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.click();
    return;
  }

  const response = await fetch(image.src);
  if (!response.ok) {
    throw new Error("הורדת התמונה נכשלה");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
