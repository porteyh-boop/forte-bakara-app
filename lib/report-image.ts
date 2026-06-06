import type { Fault } from "./types";

/** גודל קובץ מקורי מקסימלי לפני דחיסה */
export const MAX_INPUT_IMAGE_BYTES = 5 * 1024 * 1024;

/** גודל מקסימלי לשמירה ב-localStorage (לאחר דחיסה) */
export const MAX_STORED_IMAGE_BYTES = 450 * 1024;

export const REPORT_IMAGE_STORAGE_NOTE =
  "התמונה נשמרת בדפדפן (localStorage) יחד עם הדיווח. בשלב הפיילוט אין שרת חיצוני — מומלץ תמונה אחת לדיווח.";

export const REPORT_IMAGE_MISSING_NOTE =
  "תמונות נשמרות כעת ב-localStorage יחד עם הדיווח. מגבלת אחסון: כ-450KB לתמונה לאחר דחיסה.";

export interface ReportImageAttachment {
  dataUrl: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

export function isValidImageMimeType(mime: string): boolean {
  return mime.startsWith("image/");
}

export function canStoreImageInLocalStorage(dataUrl: string): boolean {
  return estimateDataUrlBytes(dataUrl) <= MAX_STORED_IMAGE_BYTES;
}

export function attachImageToFault(
  fault: Fault,
  image: ReportImageAttachment | null | undefined
): Fault {
  if (!image) return fault;
  return { ...fault, image };
}

export function clearImageAttachment(): null {
  return null;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("לא ניתן לטעון את התמונה"));
    };
    img.src = url;
  });
}

async function compressToDataUrl(file: File): Promise<string> {
  if (!isBrowser()) {
    throw new Error("דחיסת תמונה זמינה רק בדפדפן");
  }

  const img = await loadImageElement(file);
  const maxDim = 1280;
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("לא ניתן לעבד את התמונה");

  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (
    estimateDataUrlBytes(dataUrl) > MAX_STORED_IMAGE_BYTES &&
    quality > 0.35
  ) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (!canStoreImageInLocalStorage(dataUrl)) {
    throw new Error(
      "התמונה גדולה מדי לשמירה בדפדפן. נסו תמונה קטנה יותר או צלמו מחדש."
    );
  }

  return dataUrl;
}

export async function processImageFile(
  file: File
): Promise<
  | { ok: true; attachment: ReportImageAttachment }
  | { ok: false; error: string }
> {
  if (!isValidImageMimeType(file.type)) {
    return { ok: false, error: "יש לבחור קובץ תמונה בלבד (JPG, PNG וכו')." };
  }

  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    return {
      ok: false,
      error: `הקובץ גדול מדי (${formatFileSize(file.size)}). המקסימום: ${formatFileSize(MAX_INPUT_IMAGE_BYTES)}.`,
    };
  }

  if (!isBrowser()) {
    return { ok: false, error: "עיבוד תמונה זמין רק בדפדפן." };
  }

  try {
    const dataUrl = await compressToDataUrl(file);
    const sizeBytes = estimateDataUrlBytes(dataUrl);
    return {
      ok: true,
      attachment: {
        dataUrl,
        name: file.name,
        sizeBytes,
        mimeType: "image/jpeg",
      },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "לא ניתן לעבד את התמונה";
    return { ok: false, error: message };
  }
}
