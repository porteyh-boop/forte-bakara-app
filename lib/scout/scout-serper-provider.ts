import "server-only";

import type { ScoutSearchPayload } from "@/lib/scout/scout-types";
import { SCOUT_CANDIDATE_TYPE_LABELS } from "@/lib/scout/scout-types";
import type {
  ScoutResearchProvider,
  ScoutSearchHit,
} from "@/lib/scout/scout-research-provider";
import { supabaseSystemFetch } from "@/lib/supabase-system-fetch";

const SERPER_SEARCH_URL = "https://google.serper.dev/search";

function buildQuery(payload: ScoutSearchPayload): string {
  const city = payload.city.trim();
  const region = payload.region.trim();
  const typeLabel = SCOUT_CANDIDATE_TYPE_LABELS[payload.targetType];
  const location = [city, region].filter(Boolean).join(" ");
  return `${typeLabel} ${location} ישראל מעלית ועד בית`.trim();
}

export function createSerperScoutResearchProvider(
  apiKey: string
): ScoutResearchProvider {
  return {
    id: "serper",
    async search(payload: ScoutSearchPayload): Promise<ScoutSearchHit[]> {
      const maxResults = Math.min(Math.max(payload.maxResults, 1), 15);
      const response = await supabaseSystemFetch(SERPER_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          q: buildQuery(payload),
          num: maxResults,
          gl: "il",
          hl: "he",
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `serper_search_failed:${response.status}:${text.slice(0, 200)}`
        );
      }

      const data = (await response.json()) as {
        organic?: { title?: string; link?: string; snippet?: string }[];
      };

      const hits: ScoutSearchHit[] = [];
      for (const row of data.organic ?? []) {
        const url = String(row.link ?? "").trim();
        if (!url.startsWith("http")) continue;
        hits.push({
          url,
          title: String(row.title ?? "").trim(),
          snippet: String(row.snippet ?? "").trim().slice(0, 2000),
        });
        if (hits.length >= maxResults) break;
      }
      return hits;
    },
  };
}
