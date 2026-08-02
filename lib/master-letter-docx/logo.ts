import { MASTER_LETTER_LOGO_PUBLIC_PATH } from "./theme";

export type MasterLetterLogoImage = {
  type: "png" | "jpg";
  data: Uint8Array;
};

const LOGO_FILE_NAMES = ["forte-logo.png", "forte-logo.jpg", "forte-logo.jpeg"] as const;

function detectLogoType(fileName: string): "png" | "jpg" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  return null;
}

function readLogoFromPublicDir(): MasterLetterLogoImage | null {
  if (typeof window !== "undefined") return null;

  try {
    // Node-only — avoids bundling fs in the browser.
    const fs = require("node:fs") as typeof import("fs");
    const path = require("node:path") as typeof import("path");

    for (const fileName of LOGO_FILE_NAMES) {
      const filePath = path.join(process.cwd(), "public", fileName);
      if (!fs.existsSync(filePath)) continue;
      const type = detectLogoType(fileName);
      if (!type) continue;
      return { type, data: fs.readFileSync(filePath) };
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
      return { type, data: new Uint8Array(buffer) };
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
    return { type: "png", data: new Uint8Array(buffer) };
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
