import type { MetadataRoute } from "next";
import { BRAND_FORTE } from "@/lib/brand";

export const MASTER_MANIFEST_PATH = "/master/manifest.webmanifest";
export const MASTER_PWA_START_URL = "/master?ui=v2";
export const MASTER_PWA_SCOPE = "/master";
export const MASTER_PWA_ID = "/master";

export function buildMasterManifestDocument(): MetadataRoute.Manifest {
  return {
    id: MASTER_PWA_ID,
    start_url: MASTER_PWA_START_URL,
    scope: MASTER_PWA_SCOPE,
    name: `${BRAND_FORTE} · מערכת ניהול הנדסי`,
    short_name: BRAND_FORTE,
    description: "מערכת ניהול הנדסי",
    display: "standalone",
    lang: "he",
    dir: "rtl",
    theme_color: "#0d1b3e",
    background_color: "#0d1b3e",
  };
}

export function isMasterStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneMq = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone
  );
  return standaloneMq || iosStandalone;
}

/** iOS home-screen apps often drop query strings; restore the V2 start URL. */
export function resolveMasterStandaloneStartUrl(
  pathname: string,
  search: string
): string | null {
  if (pathname !== "/master") return null;
  const params = new URLSearchParams(search);
  if (params.get("legacy") === "1") return null;
  if (params.get("ui") === "v2") return null;
  return MASTER_PWA_START_URL;
}
