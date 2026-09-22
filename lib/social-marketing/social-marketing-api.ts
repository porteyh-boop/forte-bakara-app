import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type {
  SocialMarketingPostAction,
  SocialMarketingPostDto,
  SocialMarketingPostInput,
} from "@/lib/social-marketing/social-marketing-types";

const BASE = "/forte/api/master/ai-marketing/marketing/posts";

function hebrewGenerateError(code: string): string {
  if (code === "openai_not_configured") {
    return "יצירת פוסטים עם AI אינה מוגדרת בשרת. פנו למנהל המערכת.";
  }
  if (code === "generation_in_progress") {
    return "יצירת פוסטים כבר מתבצעת. המתינו מספר דקות ונסו שוב.";
  }
  if (code === "invalid_llm_response") return "המודל החזיר תשובה לא תקינה. לא נשמרו פוסטים.";
  if (code === "llm_failed") return "יצירת התוכן נכשלה. נסו שוב.";
  if (code === "image_generation_failed") {
    return "יצירת התמונה נכשלה. לא נשמרו פוסטים — נסו שוב.";
  }
  if (code === "image_upload_failed") {
    return "שמירת התמונה נכשלה. לא נשמרו פוסטים — נסו שוב.";
  }
  return hebrewError(code);
}

function hebrewError(code: string): string {
  if (code === "approval_required") {
    return "לא ניתן לתזמן או לפרסם לפני אישור יהודה.";
  }
  if (code === "invalid_status") return "הפעולה אינה זמינה בסטטוס הנוכחי.";
  if (code === "not_found") return "הפוסט לא נמצא.";
  if (code === "invalid_input") return "יש למלא את השדות הנדרשים.";
  if (code === "save_failed") return "השמירה נכשלה.";
  if (code === "supabase_service_unconfigured") return "השירות אינו זמין כרגע.";
  if (code === "not_connected") return "יש לחבר דף פייסבוק לפני פרסום.";
  if (code === "approval_stale") return "התוכן השתנה מאז האישור. יש לאשר מחדש.";
  if (code === "publish_in_progress") return "הפרסום כבר בתהליך.";
  if (code === "already_published") return "הפוסט כבר פורסם בפייסבוק.";
  if (code === "publish_timeout") {
    return "זמן הפרסום פג. בדקו בפייסבוק — לא נשלחה בקשה נוספת אוטומטית.";
  }
  if (code === "meta_api_error") return "פייסבוק דחה את הבקשה או שהחיבור אינו תקין.";
  if (code === "token_invalid") return "חיבור הפייסבוק פג תוקף. התחברו מחדש.";
  if (code === "approval_via_dashboard") {
    return "אישור ודחייה מתבצעים בלבד מ«אישורים הממתינים ליהודה».";
  }
  return "שגיאה. נסו שוב.";
}

export async function generateSocialMarketingPostsWithAi(): Promise<{
  posts: SocialMarketingPostDto[];
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(`${BASE}/generate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const payload = await parseMasterApiJson<{
      posts?: SocialMarketingPostDto[];
      error?: string;
    }>(response);
    if (!response.ok) {
      return {
        posts: [],
        error: hebrewGenerateError(parseMasterApiError(payload, response.status)),
      };
    }
    const posts = payload?.posts ?? [];
    if (posts.length !== 3) {
      return { posts: [], error: "המערכת לא קיבלה 3 פוסטים. לא נשמר batch." };
    }
    return { posts, error: null };
  } catch {
    return { posts: [], error: "יצירת הפוסטים נכשלה." };
  }
}

export async function listSocialMarketingPosts(): Promise<{
  posts: SocialMarketingPostDto[];
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(BASE, { method: "GET", cache: "no-store" });
    const payload = await parseMasterApiJson<{ posts?: SocialMarketingPostDto[]; error?: string }>(
      response
    );
    if (!response.ok) {
      return {
        posts: [],
        error: hebrewError(parseMasterApiError(payload, response.status)),
      };
    }
    return { posts: payload?.posts ?? [], error: null };
  } catch {
    return { posts: [], error: "לא ניתן לטעון פוסטים." };
  }
}

export async function createSocialMarketingPost(
  input: SocialMarketingPostInput
): Promise<{ post: SocialMarketingPostDto | null; error: string | null }> {
  try {
    const response = await masterApiFetch(BASE, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const payload = await parseMasterApiJson<{ post?: SocialMarketingPostDto; error?: string }>(
      response
    );
    if (!response.ok || !payload?.post) {
      return { post: null, error: hebrewError(payload?.error ?? "save_failed") };
    }
    return { post: payload.post, error: null };
  } catch {
    return { post: null, error: "יצירת הטיוטה נכשלה." };
  }
}

export async function updateSocialMarketingPost(
  postId: string,
  input: SocialMarketingPostInput
): Promise<{ post: SocialMarketingPostDto | null; error: string | null }> {
  try {
    const response = await masterApiFetch(`${BASE}/${encodeURIComponent(postId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    const payload = await parseMasterApiJson<{ post?: SocialMarketingPostDto; error?: string }>(
      response
    );
    if (!response.ok || !payload?.post) {
      return { post: null, error: hebrewError(payload?.error ?? "save_failed") };
    }
    return { post: payload.post, error: null };
  } catch {
    return { post: null, error: "העדכון נכשל." };
  }
}

export async function runSocialMarketingPostAction(
  postId: string,
  action: SocialMarketingPostAction
): Promise<{ post: SocialMarketingPostDto | null; error: string | null }> {
  try {
    const response = await masterApiFetch(`${BASE}/${encodeURIComponent(postId)}`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    const payload = await parseMasterApiJson<{ post?: SocialMarketingPostDto; error?: string }>(
      response
    );
    if (!response.ok || !payload?.post) {
      return { post: null, error: hebrewError(payload?.error ?? "save_failed") };
    }
    return { post: payload.post, error: null };
  } catch {
    return { post: null, error: "הפעולה נכשלה." };
  }
}

export async function duplicateSocialMarketingPost(postId: string): Promise<{
  post: SocialMarketingPostDto | null;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(
      `${BASE}/${encodeURIComponent(postId)}/duplicate`,
      { method: "POST" }
    );
    const payload = await parseMasterApiJson<{ post?: SocialMarketingPostDto; error?: string }>(
      response
    );
    if (!response.ok || !payload?.post) {
      return { post: null, error: hebrewError(payload?.error ?? "save_failed") };
    }
    return { post: payload.post, error: null };
  } catch {
    return { post: null, error: "השכפול נכשל." };
  }
}

export async function deleteSocialMarketingPost(postId: string): Promise<{
  deleted: boolean;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(`${BASE}/${encodeURIComponent(postId)}`, {
      method: "DELETE",
    });
    const payload = await parseMasterApiJson<{ deleted?: boolean; error?: string }>(response);
    if (!response.ok) {
      return { deleted: false, error: hebrewError(payload?.error ?? "save_failed") };
    }
    return { deleted: payload?.deleted === true, error: null };
  } catch {
    return { deleted: false, error: "המחיקה נכשלה." };
  }
}
