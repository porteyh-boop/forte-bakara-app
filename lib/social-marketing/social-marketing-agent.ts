import { requestMarketingPostsBatchFromOpenAi } from "@/lib/llm/openai-marketing-client";
import type { OpenAiMarketingPostDraft } from "@/lib/llm/openai-marketing-schema";
import { isOpenAiConfigured } from "@/lib/llm/openai-config";
import type { SocialMarketingPostDto } from "@/lib/social-marketing/social-marketing-types";
import {
  acquireMarketingGenerateLock,
  releaseMarketingGenerateLock,
} from "@/lib/social-marketing/social-marketing-generate-lock";
import {
  generateMarketingImagePngServer,
  marketingImageModelLabel,
  marketingImageProviderLabel,
} from "@/lib/llm/openai-marketing-image";
import {
  uploadMarketingSocialImageServer,
} from "@/lib/social-marketing/social-marketing-image-storage";
import { marketingDraftPassesContentPolicy } from "@/lib/social-marketing/social-marketing-content-policy";
import {
  cleanupOrphanMarketingImagesServer,
  listSocialMarketingPostsServer,
  persistAiMarketingBatchServer,
  type AiMarketingPersistDraft,
} from "@/lib/social-marketing/social-marketing-server";

export type MarketingAgentGenerateError =
  | "openai_not_configured"
  | "generation_in_progress"
  | "marketing_agent_missing"
  | "llm_failed"
  | "invalid_llm_response"
  | "image_generation_failed"
  | "image_upload_failed"
  | "supabase_service_unconfigured"
  | "save_failed";

const SYSTEM_PROMPT = `אתה כותב תוכן מקצועי בעברית לפוסטים ברשתות חברתיות בנושא מעליות בבניינים משותפים.

קהל יעד — חובה (רק אלה):
- ועדי בתים
- נציגויות בתים משותפים
- בעלי דירות בבניינים משותפים
- בעלי נכסים בבניינים משותפים

אסור כרגע:
- לכתוב לחברות ניהול או לחברת ניהול.
- להשתמש במילים FORTE, Forte, forte, פורטה — בשום שדה (כולל visual_prompt).

אופי הפוסט:
- התחל או התמקד בבעיה/כאב אמיתי שמוכר לוועד הבית (תקלות חוזרות, הצעות מחיר לא ברורות, חוזה שירות, חוסר מידע אחרי טכנאי, שדרוג, בדיקת הצעות, מעקב שירות, מסירה, בדיקות מקצועיות וכד').
- אין להמציא מחירים, תקנים, חוקים, נתונים, אחוזים, חיסכון, הבטחות, אחריות או עובדות מקצועיות.
- אפשר לסיים בהנעה לפעולה טבעית ומגוונת (לא אותו משפט בכל פוסט), בלי שם מותג.

כללים טכניים:
- עברית תקינה, ברורה, מקצועית.
- שלוש ההצעות שונות בנושא או בזווית.
- target_audience: תיאור קצר של קהל מהרשימה המותרת בלבד.
- visual_prompt: תיאור בעברית לתמונה (ללא שמות מותג, ללא חברות ניהול, ללא טקסט בתמונה) — לא URL.
- Instagram יכול להיות קצר יותר עם hashtags עדינים; Facebook מעט מפורט יותר.
- publish_date YYYY-MM-DD, publish_time HH:MM (שעון ישראל).
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
    if (!marketingDraftPassesContentPolicy(draft)) return false;
  }

  return true;
}

function buildUserPrompt(recent: SocialMarketingPostDto[]): string {
  const lines: string[] = [
    "צור 3 הצעות פוסט שונות לוועדי בתים / נציגויות / בעלי דירות ונכסים בבניינים משותפים.",
    "",
    "נושאים אפשריים (בחר 3 שונים): תקלות חוזרות במעלית, מעלית מושבתת שוב ושוב, תיקון יקר שלא ברור אם נדרש, הצעת מחיר מחברת המעליות שלא ברורה, חוזה שירות לא ברור, רכיב שממליצים להחליף, קושי להבין מה גרם לתקלה, חוסר מידע אחרי ביקור טכנאי, שדרוג ומודרניזציה, בדיקת הצעות מחיר, מעקב איכות שירות, הכנת מעלית למסירה, בדיקות מקצועיות.",
    "",
    "אסור בשום שדה: FORTE, Forte, forte, פורטה, חברות ניהול, חברת ניהול.",
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

    const uploadedPaths: string[] = [];
    const persistDrafts: AiMarketingPersistDraft[] = [];
    try {
      for (const draft of llm.posts) {
        const generated = await generateMarketingImagePngServer({
          visualPromptHe: draft.visual_prompt,
        });
        if (generated.error === "openai_not_configured") {
          return { posts: [], error: "openai_not_configured" };
        }
        if (generated.error || !generated.pngBuffer) {
          throw new Error("image_generation_failed");
        }

        const uploaded = await uploadMarketingSocialImageServer({
          pngBuffer: generated.pngBuffer,
        });
        if (uploaded.error || !uploaded.publicUrl) {
          throw new Error(
            uploaded.error === "supabase_service_unconfigured"
              ? "supabase_unreachable"
              : "image_upload_failed"
          );
        }

        uploadedPaths.push(uploaded.storagePath);
        persistDrafts.push({
          ...draft,
          imagePublicUrl: uploaded.publicUrl,
          imageStoragePath: uploaded.storagePath,
          imageProvider: marketingImageProviderLabel(),
          imageModel: marketingImageModelLabel(),
        });
      }
    } catch (err) {
      await cleanupOrphanMarketingImagesServer(uploadedPaths);
      const msg = err instanceof Error ? err.message : "";
      if (msg === "supabase_unreachable") {
        return { posts: [], error: "supabase_service_unconfigured" };
      }
      if (msg === "image_upload_failed") {
        return { posts: [], error: "image_upload_failed" };
      }
      return { posts: [], error: "image_generation_failed" };
    }

    const saved = await persistAiMarketingBatchServer(persistDrafts);
    if (saved.error || saved.posts.length !== 3) {
      await cleanupOrphanMarketingImagesServer(uploadedPaths);
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
