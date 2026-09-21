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

function hebrewError(code: string): string {
  if (code === "approval_required") {
    return "לא ניתן לתזמן או לפרסם לפני אישור יהודה.";
  }
  if (code === "invalid_status") return "הפעולה אינה זמינה בסטטוס הנוכחי.";
  if (code === "not_found") return "הפוסט לא נמצא.";
  if (code === "invalid_input") return "יש למלא את השדות הנדרשים.";
  if (code === "save_failed") return "השמירה נכשלה.";
  if (code === "supabase_service_unconfigured") return "השירות אינו זמין כרגע.";
  return "שגיאה. נסו שוב.";
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
