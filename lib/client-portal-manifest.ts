import type { MetadataRoute } from "next";
import { BRAND_APP, BRAND_FORTE, BRAND_TAGLINE } from "@/lib/brand";

export const CLIENT_PORTAL_MANIFEST_THEME = {
  theme_color: "#0d1b3e",
  background_color: "#0d1b3e",
} as const;

/** Trailing slash on scope avoids prefix collisions between tokens (e.g. abc vs abcd). */
export const CLIENT_PORTAL_SCOPE_SUFFIX = "/" as const;

export function normalizeClientPortalToken(token: string): string {
  return token.trim();
}

export function buildClientPortalAccessPath(token: string): string {
  return `/client/access/${encodeURIComponent(normalizeClientPortalToken(token))}`;
}

export function buildClientPortalManifestPath(token: string): string {
  return `${buildClientPortalAccessPath(token)}/manifest.webmanifest`;
}

export function buildClientPortalManifestIdentity(token: string): {
  id: string;
  start_url: string;
  scope: string;
} {
  const accessPath = buildClientPortalAccessPath(token);
  return {
    id: accessPath,
    start_url: accessPath,
    scope: `${accessPath}${CLIENT_PORTAL_SCOPE_SUFFIX}`,
  };
}

export type ClientPortalManifestLabels = {
  buildingName?: string | null;
};

export function buildClientPortalManifestDocument(
  token: string,
  labels: ClientPortalManifestLabels = {}
): MetadataRoute.Manifest {
  const identity = buildClientPortalManifestIdentity(token);
  const buildingName = labels.buildingName?.trim() || null;
  const shortName = buildingName
    ? `${buildingName} · ${BRAND_FORTE}`
    : BRAND_APP;
  const name = buildingName
    ? `${buildingName} · ${BRAND_APP}`
    : `${BRAND_APP} – ${BRAND_TAGLINE}`;

  return {
    id: identity.id,
    start_url: identity.start_url,
    scope: identity.scope,
    name,
    short_name: shortName,
    description: buildingName
      ? `פורטל לקוח · ${buildingName}`
      : "פורטל לקוח",
    display: "standalone",
    lang: "he",
    dir: "rtl",
    theme_color: CLIENT_PORTAL_MANIFEST_THEME.theme_color,
    background_color: CLIENT_PORTAL_MANIFEST_THEME.background_color,
  };
}

export function buildClientPortalAppleWebAppTitle(
  labels: ClientPortalManifestLabels = {}
): string {
  const buildingName = labels.buildingName?.trim();
  return buildingName ? `${buildingName} · ${BRAND_APP}` : BRAND_APP;
}
