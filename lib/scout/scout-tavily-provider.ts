import type { ScoutSearchPayload } from "@/lib/scout/scout-types";
import { SCOUT_CANDIDATE_TYPE_LABELS } from "@/lib/scout/scout-types";
import type {
  ScoutResearchProvider,
  ScoutSearchHit,
} from "@/lib/scout/scout-research-provider";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

function buildQuery(payload: ScoutSearchPayload): string {
  const city = payload.city.trim();
  const region = payload.region.trim();
  const typeLabel = SCOUT_CANDIDATE_TYPE_LABELS[payload.targetType];
  const location = [city, region].filter(Boolean).join(" ");
  return `${typeLabel} ${location} ישראל מעלית ועד בית`.trim();
}

export function createTavilyScoutResearchProvider(
  apiKey: string
): ScoutResearchProvider {
  return {
    id: "tavily",
    async search(payload: ScoutSearchPayload): Promise<ScoutSearchHit[]> {
      const maxResults = Math.min(Math.max(payload.maxResults, 1), 15);
      const response = await fetch(TAVILY_SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: buildQuery(payload),
          max_results: maxResults,
          search_depth: "basic",
          include_answer: false,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`tavily_search_failed:${response.status}:${text.slice(0, 200)}`);
      }

      const data = (await response.json()) as {
        results?: { url?: string; title?: string; content?: string }[];
      };

      const hits: ScoutSearchHit[] = [];
      for (const row of data.results ?? []) {
        const url = String(row.url ?? "").trim();
        if (!url.startsWith("http")) continue;
        hits.push({
          url,
          title: String(row.title ?? "").trim(),
          snippet: String(row.content ?? "").trim().slice(0, 2000),
        });
        if (hits.length >= maxResults) break;
      }
      return hits;
    },
  };
}
