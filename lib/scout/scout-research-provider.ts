import { createSerperScoutResearchProvider } from "@/lib/scout/scout-serper-provider";
import type { ScoutSearchPayload } from "@/lib/scout/scout-types";

export type ScoutSearchHit = {
  url: string;
  title: string;
  snippet: string;
};

export type ScoutResearchProvider = {
  readonly id: string;
  search(payload: ScoutSearchPayload): Promise<ScoutSearchHit[]>;
};

function normalizeEnvSecret(value: string | undefined): string {
  let v = value?.trim() ?? "";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Serper keys are hex strings; reject multiline pasted sample scripts for X-API-KEY. */
function isPlausibleSerperApiKey(value: string): boolean {
  return /^[a-f0-9]{32,64}$/i.test(value);
}

function resolveScoutWebSearchApiKey(raw: string | undefined): string | null {
  const normalized = normalizeEnvSecret(raw);
  if (!normalized) return null;
  if (isPlausibleSerperApiKey(normalized)) return normalized;

  const fromSample = normalized.match(
    /['"]X-API-KEY['"]\s*:\s*['"]([a-f0-9]{32,64})['"]/i
  )?.[1];
  if (fromSample && isPlausibleSerperApiKey(fromSample)) return fromSample;

  return null;
}

export function getScoutResearchProvider(): ScoutResearchProvider | null {
  const provider = normalizeEnvSecret(process.env.SCOUT_WEB_SEARCH_PROVIDER).toLowerCase();
  const apiKey = resolveScoutWebSearchApiKey(process.env.SCOUT_WEB_SEARCH_API_KEY);
  if (!apiKey) return null;

  if (provider === "serper" || !provider) {
    return createSerperScoutResearchProvider(apiKey);
  }

  return null;
}
