import { MASTER_LETTER_LOGO_PUBLIC_PATH, MASTER_LETTER_DOCX_LOGO_MAX_WIDTH } from "./theme";

export type MasterLetterLogoImage = {
  type: "png" | "jpg";
  data: Uint8Array;
  width: number;
  height: number;
};

const LOGO_FILE_NAMES = ["forte-logo.png", "forte-logo.jpg", "forte-logo.jpeg"] as const;

function detectLogoType(fileName: string): "png" | "jpg" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  return null;
}

function readPngDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 24) return null;
  if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    return null;
  }
  const width =
    (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
  const height =
    (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function readJpegDimensions(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      const height = (data[offset + 5] << 8) | data[offset + 6];
      const width = (data[offset + 7] << 8) | data[offset + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    const segmentLength = (data[offset + 2] << 8) | data[offset + 3];
    if (segmentLength < 2) return null;
    offset += segmentLength + 2;
  }

  return null;
}

function withDimensions(
  type: "png" | "jpg",
  data: Uint8Array
): MasterLetterLogoImage | null {
  const dimensions =
    type === "png" ? readPngDimensions(data) : readJpegDimensions(data);
  if (!dimensions) {
    return {
      type,
      data,
      width: MASTER_LETTER_DOCX_LOGO_MAX_WIDTH,
      height: Math.round(MASTER_LETTER_DOCX_LOGO_MAX_WIDTH * 0.35),
    };
  }
  return { type, data, ...dimensions };
}

export function scaleLogoTransformation(logo: MasterLetterLogoImage): {
  width: number;
  height: number;
} {
  const maxWidth = MASTER_LETTER_DOCX_LOGO_MAX_WIDTH;
  if (logo.width <= maxWidth) {
    return { width: logo.width, height: logo.height };
  }
  const scale = maxWidth / logo.width;
  return {
    width: maxWidth,
    height: Math.round(logo.height * scale),
  };
}

function readLogoFromPublicDir(): MasterLetterLogoImage | null {
  if (typeof window !== "undefined") return null;

  try {
    const fs = require("node:fs") as typeof import("fs");
    const path = require("node:path") as typeof import("path");

    for (const fileName of LOGO_FILE_NAMES) {
      const filePath = path.join(process.cwd(), "public", fileName);
      if (!fs.existsSync(filePath)) continue;
      const type = detectLogoType(fileName);
      if (!type) continue;
      const data = fs.readFileSync(filePath);
      return withDimensions(type, data);
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchLogoInBrowser(): Promise<MasterLetterLogoImage | null> {
  for (const fileName of LOGO_FILE_NAMES) {
    const url = `/${fileName}`;
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (!response.ok) continue;
      const type = detectLogoType(fileName);
      if (!type) continue;
      const blob = await fetch(url).then((res) => res.blob());
      const buffer = await blob.arrayBuffer();
      const data = new Uint8Array(buffer);
      return withDimensions(type, data);
    } catch {
      continue;
    }
  }

  if (MASTER_LETTER_LOGO_PUBLIC_PATH !== "/forte-logo.png") {
    return null;
  }

  try {
    const response = await fetch(MASTER_LETTER_LOGO_PUBLIC_PATH, { method: "HEAD" });
    if (!response.ok) return null;
    const blob = await fetch(MASTER_LETTER_LOGO_PUBLIC_PATH).then((res) => res.blob());
    const buffer = await blob.arrayBuffer();
    const data = new Uint8Array(buffer);
    return withDimensions("png", data);
  } catch {
    return null;
  }
}

export async function loadMasterLetterLogo(): Promise<MasterLetterLogoImage | null> {
  if (typeof window !== "undefined") {
    return fetchLogoInBrowser();
  }
  return readLogoFromPublicDir();
}
