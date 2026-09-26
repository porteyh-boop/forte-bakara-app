import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type {
  FacebookConnectionStatusDto,
  FacebookPageOptionDto,
} from "@/lib/social-marketing/meta-facebook-server";

const BASE = "/forte/api/master/ai-marketing/marketing/facebook";

function hebrewMetaError(code: string): string {
  if (code === "meta_app_not_configured") {
    return "חיבור פייסבוק אינו מוגדר בשרת. פנו למנהל המערכת.";
  }
  if (code === "meta_login_config_not_configured") {
    return "חיבור Meta OAuth אינו מוגדר: חסר META_FACEBOOK_LOGIN_CONFIG_ID בשרת. פנו למנהל המערכת.";
  }
  if (code === "not_connected") return "יש לחבר דף פייסבוק לפני פרסום.";
  if (code === "token_invalid") return "חיבור הפייסבוק פג תוקף. התחברו מחדש.";
  if (code === "approval_required") return "לא ניתן לפרסם לפני אישור יהודה.";
  if (code === "approval_stale") return "התוכן השתנה מאז האישור. יש לאשר מחדש.";
  if (code === "publish_in_progress") return "הפרסום כבר בתהליך.";
  if (code === "already_published") return "הפוסט כבר פורסם בפייסבוק.";
  if (code === "publish_timeout") {
    return "זמן הפרסום פג. בדקו בפייסבוק אם הפוסט עלה — לא נשלחה בקשה נוספת אוטומטית.";
  }
  if (code === "meta_api_error") return "פייסבוק דחה את הבקשה או שהחיבור אינו תקין.";
  if (code === "page_not_found") return "הדף שנבחר אינו זמין בחשבון המחובר.";
  if (code === "page_missing_create_content") {
    return "אין הרשאת פרסום (CREATE_CONTENT) לדף זה.";
  }
  if (code === "oauth_failed") return "החיבור לפייסבוק נכשל. נסו שוב.";
  if (code === "invalid_state") return "ההתחברות לפייסבוק פגה. התחילו מחדש.";
  return "שגיאה בחיבור פייסבוק.";
}

export function startFacebookConnectUrl(): string {
  return `${BASE}/connect`;
}

export async function fetchFacebookConnectionStatus(): Promise<{
  status: FacebookConnectionStatusDto | null;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(`${BASE}/status`, { method: "GET", cache: "no-store" });
    const payload = await parseMasterApiJson<{ status?: FacebookConnectionStatusDto; error?: string }>(
      response
    );
    if (!response.ok) {
      return { status: null, error: hebrewMetaError(parseMasterApiError(payload, response.status)) };
    }
    return { status: payload?.status ?? null, error: null };
  } catch {
    return { status: null, error: "לא ניתן לטעון את מצב החיבור." };
  }
}

export async function listFacebookPagesForSelection(): Promise<{
  pages: FacebookPageOptionDto[];
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(`${BASE}/pages`, { method: "GET", cache: "no-store" });
    const payload = await parseMasterApiJson<{ pages?: FacebookPageOptionDto[]; error?: string }>(
      response
    );
    if (!response.ok) {
      return { pages: [], error: hebrewMetaError(parseMasterApiError(payload, response.status)) };
    }
    return { pages: payload?.pages ?? [], error: null };
  } catch {
    return { pages: [], error: "לא ניתן לטעון את רשימת הדפים." };
  }
}

export async function selectFacebookPage(pageId: string): Promise<{
  status: FacebookConnectionStatusDto | null;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(`${BASE}/select-page`, {
      method: "POST",
      body: JSON.stringify({ pageId }),
    });
    const payload = await parseMasterApiJson<{ status?: FacebookConnectionStatusDto; error?: string }>(
      response
    );
    if (!response.ok || !payload?.status) {
      return { status: null, error: hebrewMetaError(payload?.error ?? "save_failed") };
    }
    return { status: payload.status, error: null };
  } catch {
    return { status: null, error: "שמירת הדף נכשלה." };
  }
}

export async function disconnectFacebookPage(): Promise<{ error: string | null }> {
  try {
    const response = await masterApiFetch(`${BASE}/disconnect`, { method: "DELETE" });
    const payload = await parseMasterApiJson<{ error?: string }>(response);
    if (!response.ok) {
      return { error: hebrewMetaError(parseMasterApiError(payload, response.status)) };
    }
    return { error: null };
  } catch {
    return { error: "ניתוק החיבור נכשל." };
  }
}

export { hebrewMetaError };
