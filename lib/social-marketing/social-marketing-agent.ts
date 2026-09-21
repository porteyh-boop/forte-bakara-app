import { requestMarketingPostsBatchFromOpenAi } from "@/lib/llm/openai-marketing-client";
import type { OpenAiMarketingPostDraft } from "@/lib/llm/openai-marketing-schema";
import { isOpenAiConfigured } from "@/lib/llm/openai-config";
import type { SocialMarketingPostDto } from "@/lib/social-marketing/social-marketing-types";
import {
  acquireMarketingGenerateLock,
  releaseMarketingGenerateLock,
} from "@/lib/social-marketing/social-marketing-generate-lock";
import {
  listSocialMarketingPostsServer,
  persistAiMarketingBatchServer,
} from "@/lib/social-marketing/social-marketing-server";

export type MarketingAgentGenerateError =
  | "openai_not_configured"
  | "generation_in_progress"
  | "marketing_agent_missing"
  | "llm_failed"
  | "invalid_llm_response"
  | "supabase_service_unconfigured"
  | "save_failed";

const SYSTEM_PROMPT = `אתה כותב תוכן שיווקי מקצועי בעברית עבור FORTE — ליווי מקצועי לוועדי בתים, חברות ניהול ומנהלי נכסים בתחום המעליות.

כללים:
- עברית תקינה, ברורה, מקצועית, לא מנופחת.
- אין להמציא מחירים, תקנים, חוקים, אחוזים, סטטיסטיקות, הבטחות או "עובדות" שלא סופקו.
- אין הבטחות שיווקיות לא מבוססות.
- שלוש ההצעות חייבות להיות שונות בנושא או בזווית.
- התאם את הקהל (ועד בית, חברות ניהול, מנהלי נכסים, בעלי בניינים, יזמים/קבלנים כשמתאים).
- תוכן Instagram יכול להיות קצר יותר עם hashtags עדינים; Facebook מעט מפורט יותר.
- visual_prompt: תיאור בעברית ליצירת תמונה עתידית (לא URL).
- publish_date בפורמט YYYY-MM-DD, publish_time בפורמט HH:MM (שעון ישראל).
- החזר בדיוק 3 פוסטים במבנה JSON.`;

export type MarketingBatchGenerator = (input: {
  systemPrompt: string;
  userPrompt: string;
}) => Promise<{ posts: OpenAiMarketingPostDraft[] | null; error: string | null }>;

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, " ");
}

function isValidDate(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && !Number.isNaN(Date.parse(isoDate));
}

function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim());
}

const BANNED_PATTERNS = [
  /\d+\s*%/,
  /חיסכון של/,
  /לפי תקן/,
  /על פי חוק/,
  /מחיר\s*:/,
  /₪/,
  /\$\d/,
];

function textPassesSafety(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(t)) return false;
  }
  return true;
}

export function validateMarketingPostDrafts(
  drafts: OpenAiMarketingPostDraft[]
): boolean {
  if (drafts.length !== 3) return false;

  const topics = new Set<string>();
  for (const draft of drafts) {
    const topic = draft.topic?.trim();
    if (!topic) return false;
    const norm = normalizeTopic(topic);
    if (topics.has(norm)) return false;
    topics.add(norm);

    if (!draft.target_audience?.trim()) return false;
    if (!draft.visual_prompt?.trim()) return false;
    if (!isValidDate(draft.publish_date?.trim())) return false;
    if (!isValidTime(draft.publish_time?.trim())) return false;

    const platform = draft.platform;
    if (platform === "facebook" && !draft.body_facebook?.trim()) return false;
    if (platform === "instagram" && !draft.body_instagram?.trim()) return false;
    if (platform === "both") {
      if (!draft.body_facebook?.trim() || !draft.body_instagram?.trim()) return false;
    }

    const combined = `${draft.body_facebook} ${draft.body_instagram} ${draft.topic}`;
    if (!textPassesSafety(combined)) return false;
  }

  return true;
}

function buildUserPrompt(recent: SocialMarketingPostDto[]): string {
  const lines: string[] = [
    "צור 3 הצעות פוסט שיווקיות שונות ל-FORTE.",
    "",
    "נושאים אפשריים (בחר 3 שונים): תקלות חוזרות, בקרת שירות, חוזי שירות, בדיקת הצעות מחיר, תחזוקה, שדרוג ומודרניזציה, מסירה וקבלה, בדק בית במעליות, חוות דעת מקצועיות, טיפים לוועדים ולחברות ניהול, טעויות נפוצות, הסברים מקצועיים, שירותי FORTE.",
    "",
  ];

  if (recent.length > 0) {
    lines.push("פוסטים קודמים — אל תחזור על הנושאים והניסוחים:");
    for (const post of recent.slice(0, 24)) {
      const snippet = (post.bodyFacebook || post.bodyInstagram || "").slice(0, 120);
      lines.push(`- נושא: ${post.topic} | קהל: ${post.targetAudience} | ${snippet}`);
    }
    lines.push("");
  }

  lines.push("החזר JSON עם מערך posts בדיוק באורך 3.");
  return lines.join("\n");
}

const defaultGenerator: MarketingBatchGenerator = async ({ systemPrompt, userPrompt }) => {
  const result = await requestMarketingPostsBatchFromOpenAi({
    systemPrompt,
    userPrompt,
  });
  if (result.error || !result.batch) {
    return { posts: null, error: result.error ?? "llm_failed" };
  }
  return { posts: result.batch.posts, error: null };
};

export async function generateMarketingPostsBatchServer(options?: {
  generator?: MarketingBatchGenerator;
}): Promise<{
  posts: SocialMarketingPostDto[];
  error: MarketingAgentGenerateError | null;
}> {
  if (!isOpenAiConfigured()) {
    return { posts: [], error: "openai_not_configured" };
  }

  const lock = await acquireMarketingGenerateLock();
  if (lock.error) {
    return {
      posts: [],
      error:
        lock.error === "generation_in_progress"
          ? "generation_in_progress"
          : lock.error === "marketing_agent_missing"
            ? "marketing_agent_missing"
            : "save_failed",
    };
  }

  const taskId = lock.taskId;
  if (!taskId) {
    return { posts: [], error: "save_failed" };
  }

  let outcome: "completed" | "failed" = "failed";
  try {
    const listed = await listSocialMarketingPostsServer();
    if (listed.error) {
      return { posts: [], error: "supabase_service_unconfigured" };
    }

    const userPrompt = buildUserPrompt(listed.posts);
    const generator = options?.generator ?? defaultGenerator;
    const llm = await generator({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    if (llm.error === "openai_not_configured") {
      return { posts: [], error: "openai_not_configured" };
    }
    if (!llm.posts) {
      return {
        posts: [],
        error: llm.error === "openai_invalid_response" ? "invalid_llm_response" : "llm_failed",
      };
    }

    if (!validateMarketingPostDrafts(llm.posts)) {
      return { posts: [], error: "invalid_llm_response" };
    }

    const saved = await persistAiMarketingBatchServer(llm.posts);
    if (saved.error || saved.posts.length !== 3) {
      const err = saved.error;
      return {
        posts: [],
        error:
          err === "supabase_service_unconfigured"
            ? "supabase_service_unconfigured"
            : "save_failed",
      };
    }

    outcome = "completed";
    return { posts: saved.posts, error: null };
  } catch {
    return { posts: [], error: "save_failed" };
  } finally {
    await releaseMarketingGenerateLock(taskId, outcome);
  }
}
