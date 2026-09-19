import { createTavilyScoutResearchProvider } from "@/lib/scout/scout-tavily-provider";
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

export function getScoutResearchProvider(): ScoutResearchProvider | null {
  const provider = process.env.SCOUT_WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  const apiKey = process.env.SCOUT_WEB_SEARCH_API_KEY?.trim();
  if (!apiKey) return null;

  if (provider === "tavily" || !provider) {
    return createTavilyScoutResearchProvider(apiKey);
  }

  return null;
}
