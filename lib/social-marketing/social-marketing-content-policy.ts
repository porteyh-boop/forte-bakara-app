import type { OpenAiMarketingPostDraft } from "@/lib/llm/openai-marketing-schema";

const FORBIDDEN_LATIN = /\bforte\b/i;

const FORBIDDEN_HEBREW = ["פורטה", "חברות ניהול", "חברת ניהול"] as const;

export function textContainsForbiddenMarketingContent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (FORBIDDEN_LATIN.test(t)) return true;
  for (const phrase of FORBIDDEN_HEBREW) {
    if (t.includes(phrase)) return true;
  }
  return false;
}

export function targetAudienceIsAllowedForCurrentPolicy(targetAudience: string): boolean {
  const t = targetAudience.trim();
  if (!t) return false;
  if (textContainsForbiddenMarketingContent(t)) return false;
  return true;
}

export function marketingDraftPassesContentPolicy(draft: OpenAiMarketingPostDraft): boolean {
  const fields = [
    draft.topic,
    draft.target_audience,
    draft.body_facebook,
    draft.body_instagram,
    draft.visual_prompt,
  ];
  for (const value of fields) {
    if (textContainsForbiddenMarketingContent(String(value ?? ""))) return false;
  }
  if (!targetAudienceIsAllowedForCurrentPolicy(draft.target_audience ?? "")) return false;
  return true;
}
