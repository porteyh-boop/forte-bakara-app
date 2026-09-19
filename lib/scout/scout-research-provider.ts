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

export function getScoutResearchProvider(): ScoutResearchProvider | null {
  const provider = normalizeEnvSecret(process.env.SCOUT_WEB_SEARCH_PROVIDER).toLowerCase();
  const apiKey = normalizeEnvSecret(process.env.SCOUT_WEB_SEARCH_API_KEY);
  if (!apiKey) return null;

  if (provider === "serper" || !provider) {
    return createSerperScoutResearchProvider(apiKey);
  }

  return null;
}
