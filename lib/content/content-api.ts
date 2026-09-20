import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { ContentChannelId, ContentDraftDto } from "@/lib/content/content-types";

const CONTENT_BASE = "/forte/api/master/ai-marketing/content";

export async function createContentOutreachDraft(input: {
  candidateId: string;
  channel: ContentChannelId;
  salesLeadId?: string | null;
}): Promise<{ draft: ContentDraftDto | null; error: string | null }> {
  const response = await masterApiFetch(`${CONTENT_BASE}/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateId: input.candidateId,
      channel: input.channel,
      salesLeadId: input.salesLeadId ?? undefined,
    }),
  });
  const body = await parseMasterApiJson<{ draft?: ContentDraftDto; error?: string }>(
    response
  );
  if (!response.ok || !body?.draft) {
    return {
      draft: null,
      error: body?.error ?? parseMasterApiError(body, response.status),
    };
  }
  return { draft: body.draft, error: null };
}
