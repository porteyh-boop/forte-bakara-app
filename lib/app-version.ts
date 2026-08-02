export const DEVELOPMENT_VERSION = "development";

export const CURRENT_BUILD_VERSION =
  process.env.NEXT_PUBLIC_APP_BUILD_VERSION?.trim() || DEVELOPMENT_VERSION;

export function isValidVersion(version: string | null | undefined): version is string {
  if (typeof version !== "string") return false;
  const trimmed = version.trim();
  return trimmed.length > 0;
}

export function formatDisplayVersion(version: string): string {
  if (version === DEVELOPMENT_VERSION) return DEVELOPMENT_VERSION;
  return version.trim().slice(0, 7);
}

export function versionsMismatch(
  clientVersion: string,
  serverVersion: string
): boolean {
  if (!isValidVersion(clientVersion) || !isValidVersion(serverVersion)) {
    return false;
  }
  return clientVersion.trim() !== serverVersion.trim();
}

export function resolveServerBuildVersion(): string {
  if (process.env.NODE_ENV !== "production") {
    const override = process.env.APP_BUILD_VERSION_OVERRIDE?.trim();
    if (override) return override;
    return DEVELOPMENT_VERSION;
  }

  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercelSha) return vercelSha;

  const buildVersion = process.env.NEXT_PUBLIC_APP_BUILD_VERSION?.trim();
  if (isValidVersion(buildVersion) && buildVersion !== DEVELOPMENT_VERSION) {
    return buildVersion;
  }

  return "";
}

export async function fetchServerVersion(): Promise<string | null> {
  try {
    const response = await fetch("/api/version", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn("[app-version] version fetch failed:", response.status);
      return null;
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      console.warn("[app-version] invalid JSON in version response");
      return null;
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("version" in data) ||
      typeof (data as { version: unknown }).version !== "string"
    ) {
      console.warn("[app-version] unexpected version response shape");
      return null;
    }

    const version = (data as { version: string }).version;
    if (!isValidVersion(version)) {
      console.warn("[app-version] empty version in response");
      return null;
    }

    return version.trim();
  } catch (error) {
    console.warn("[app-version] version fetch error:", error);
    return null;
  }
}

export function isVersionCheckEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

export const VERSION_INITIAL_CHECK_DELAY_MS = 3_000;
export const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1_000;
