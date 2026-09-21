import { randomBytes, timingSafeEqual } from "crypto";
import {
  buildFacebookPostPermalink,
  getMetaFacebookOAuthRedirectUri,
  isMetaFacebookConfigured,
  metaFacebookDialogOAuthUrl,
} from "@/lib/social-marketing/meta-facebook-config";
import { decryptSecret, encryptSecret, hashOpaque } from "@/lib/social-marketing/meta-facebook-crypto";
import {
  debugToken,
  exchangeCodeForUserAccessToken,
  exchangeForLongLivedUserToken,
  listManagedFacebookPages,
  MetaGraphApiError,
  publishPageFeedPost,
  type MetaGraphFetch,
} from "@/lib/social-marketing/meta-facebook-graph";
import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { SOCIAL_MARKETING_APPROVER } from "@/lib/social-marketing/social-marketing-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const OAUTH_TABLE = "social_facebook_oauth_sessions";
const CONNECTION_TABLE = "social_facebook_connection";
const POSTS_TABLE = "social_marketing_posts";
const OAUTH_TTL_MS = 15 * 60 * 1000;
const PUBLISH_TIMEOUT_MS = 25_000;

export type MetaFacebookServerError =
  | "supabase_service_unconfigured"
  | "meta_app_not_configured"
  | "invalid_state"
  | "oauth_failed"
  | "not_connected"
  | "page_not_found"
  | "page_missing_create_content"
  | "token_invalid"
  | "save_failed"
  | "not_found"
  | "approval_required"
  | "approval_stale"
  | "invalid_status"
  | "invalid_input"
  | "publish_in_progress"
  | "already_published"
  | "facebook_not_applicable"
  | "publish_timeout"
  | "meta_api_error";

export type FacebookConnectionStatusDto = {
  configured: boolean;
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  tokenValid: boolean | null;
  connectedAt: string | null;
  pendingPageSelection: boolean;
};

export type FacebookPageOptionDto = {
  id: string;
  name: string;
  canCreateContent: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function pageCanCreateContent(tasks: string[]): boolean {
  return tasks.includes("CREATE_CONTENT") || tasks.includes("MANAGE");
}

export function createOAuthStateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function verifyOAuthState(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function buildFacebookOAuthRedirectUrl(state: string): string {
  return metaFacebookDialogOAuthUrl({
    state,
    redirectUri: getMetaFacebookOAuthRedirectUri(),
  });
}

export async function beginFacebookOAuthServer(masterSessionToken: string): Promise<{
  state: string;
  redirectUrl: string;
  error: MetaFacebookServerError | null;
}> {
  if (!isMetaFacebookConfigured()) {
    return { state: "", redirectUrl: "", error: "meta_app_not_configured" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { state: "", redirectUrl: "", error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { state: "", redirectUrl: "", error: "supabase_service_unconfigured" };

  const state = createOAuthStateToken();
  const stateHash = hashOpaque(state);
  const masterHash = hashOpaque(masterSessionToken);

  await sb.from(OAUTH_TABLE).delete().eq("master_session_hash", masterHash);

  const { error } = await sb.from(OAUTH_TABLE).insert({
    state_token_hash: stateHash,
    master_session_hash: masterHash,
    encrypted_user_access_token: encryptSecret(""),
    expires_at: new Date(Date.now() + OAUTH_TTL_MS).toISOString(),
  });

  if (error) {
    return { state: "", redirectUrl: "", error: "save_failed" };
  }

  return {
    state,
    redirectUrl: buildFacebookOAuthRedirectUrl(state),
    error: null,
  };
}

export async function completeFacebookOAuthCallbackServer(input: {
  code: string;
  state: string;
  masterSessionToken: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<{ ok: boolean; error: MetaFacebookServerError | null }> {
  if (!isMetaFacebookConfigured()) return { ok: false, error: "meta_app_not_configured" };
  if (!isSupabaseServiceConfigured()) return { ok: false, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "supabase_service_unconfigured" };

  const stateHash = hashOpaque(input.state);
  const masterHash = hashOpaque(input.masterSessionToken);

  const { data: sessionRow } = await sb
    .from(OAUTH_TABLE)
    .select("*")
    .eq("state_token_hash", stateHash)
    .eq("master_session_hash", masterHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!sessionRow) return { ok: false, error: "invalid_state" };

  try {
    const redirectUri = getMetaFacebookOAuthRedirectUri();
    const short = await exchangeCodeForUserAccessToken({
      code: input.code,
      redirectUri,
      fetchImpl: input.fetchImpl,
    });
    const longLived = await exchangeForLongLivedUserToken({
      shortLivedToken: short.accessToken,
      fetchImpl: input.fetchImpl,
    });

    const { error } = await sb
      .from(OAUTH_TABLE)
      .update({
        encrypted_user_access_token: encryptSecret(longLived.accessToken),
        expires_at: new Date(Date.now() + OAUTH_TTL_MS).toISOString(),
      })
      .eq("id", asString((sessionRow as Record<string, unknown>).id));

    if (error) return { ok: false, error: "save_failed" };
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "oauth_failed" };
  }
}

async function loadPendingUserToken(masterSessionToken: string): Promise<string | null> {
  if (!isSupabaseServiceConfigured()) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const masterHash = hashOpaque(masterSessionToken);
  const { data } = await sb
    .from(OAUTH_TABLE)
    .select("encrypted_user_access_token, expires_at")
    .eq("master_session_hash", masterHash)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const enc = asString((data as Record<string, unknown>).encrypted_user_access_token);
  try {
    const plain = decryptSecret(enc).trim();
    if (!plain) return null;
    return plain;
  } catch {
    return null;
  }
}

export async function listSelectableFacebookPagesServer(
  masterSessionToken: string,
  fetchImpl?: MetaGraphFetch
): Promise<{ pages: FacebookPageOptionDto[]; error: MetaFacebookServerError | null }> {
  const token = await loadPendingUserToken(masterSessionToken);
  if (!token) return { pages: [], error: "oauth_failed" };
  try {
    const pages = await listManagedFacebookPages({ userAccessToken: token, fetchImpl });
    return {
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        canCreateContent: pageCanCreateContent(p.tasks),
      })),
      error: null,
    };
  } catch {
    return { pages: [], error: "meta_api_error" };
  }
}

export async function selectFacebookPageServer(input: {
  masterSessionToken: string;
  pageId: string;
  fetchImpl?: MetaGraphFetch;
}): Promise<{ status: FacebookConnectionStatusDto | null; error: MetaFacebookServerError | null }> {
  const pageId = input.pageId.trim();
  if (!pageId) return { status: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { status: null, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { status: null, error: "supabase_service_unconfigured" };

  const userToken = await loadPendingUserToken(input.masterSessionToken);
  if (!userToken) return { status: null, error: "oauth_failed" };

  let pages;
  try {
    pages = await listManagedFacebookPages({ userAccessToken: userToken, fetchImpl: input.fetchImpl });
  } catch {
    return { status: null, error: "meta_api_error" };
  }

  const match = pages.find((p) => p.id === pageId);
  if (!match) return { status: null, error: "page_not_found" };
  if (!pageCanCreateContent(match.tasks)) {
    return { status: null, error: "page_missing_create_content" };
  }

  const now = new Date().toISOString();
  const { error } = await sb.from(CONNECTION_TABLE).upsert(
    {
      singleton_key: "default",
      page_id: match.id,
      page_name: match.name,
      encrypted_page_access_token: encryptSecret(match.accessToken),
      token_expires_at: null,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "singleton_key" }
  );

  if (error) return { status: null, error: "save_failed" };

  await sb.from(OAUTH_TABLE).delete().eq("master_session_hash", hashOpaque(input.masterSessionToken));

  return getFacebookConnectionStatusServer(input.masterSessionToken, input.fetchImpl);
}

export async function disconnectFacebookServer(): Promise<{ error: MetaFacebookServerError | null }> {
  if (!isSupabaseServiceConfigured()) return { error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { error: "supabase_service_unconfigured" };
  const { error } = await sb.from(CONNECTION_TABLE).delete().eq("singleton_key", "default");
  if (error) return { error: "save_failed" };
  return { error: null };
}

async function loadConnectionRow(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseServiceConfigured()) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from(CONNECTION_TABLE)
    .select("*")
    .eq("singleton_key", "default")
    .maybeSingle();
  return data ? (data as Record<string, unknown>) : null;
}

export async function getFacebookConnectionStatusServer(
  masterSessionToken?: string,
  fetchImpl?: MetaGraphFetch
): Promise<{ status: FacebookConnectionStatusDto; error: null }> {
  const configured = isMetaFacebookConfigured();
  const row = await loadConnectionRow();
  const pendingPageSelection = masterSessionToken
    ? await hasPendingFacebookPageSelection(masterSessionToken)
    : false;

  if (!row) {
    return {
      status: {
        configured,
        connected: false,
        pageId: null,
        pageName: null,
        tokenValid: null,
        connectedAt: null,
        pendingPageSelection,
      },
      error: null,
    };
  }

  let tokenValid: boolean | null = null;
  try {
    const token = decryptSecret(asString(row.encrypted_page_access_token));
    const debug = await debugToken({ inputToken: token, fetchImpl });
    tokenValid = debug.isValid;
  } catch {
    tokenValid = false;
  }

  return {
    status: {
      configured,
      connected: true,
      pageId: asString(row.page_id),
      pageName: asString(row.page_name),
      tokenValid,
      connectedAt: asString(row.connected_at) || null,
      pendingPageSelection: false,
    },
    error: null,
  };
}

function isApprovedRow(row: Record<string, unknown>): boolean {
  return Boolean(asString(row.approved_at).trim() && asString(row.approved_by).trim());
}

function approvalMatchesContent(row: Record<string, unknown>): boolean {
  const version = Number(row.content_version) || 1;
  const approvedVersion = row.approved_content_version;
  if (approvedVersion == null) return false;
  return Number(approvedVersion) === version;
}

export async function publishSocialPostToFacebookServer(
  postIdRaw: string,
  fetchImpl?: MetaGraphFetch
): Promise<{
  post: Record<string, unknown> | null;
  error: MetaFacebookServerError | null;
}> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { post: null, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const connection = await loadConnectionRow();
  if (!connection) return { post: null, error: "not_connected" };

  const { data: locked } = await sb
    .from(POSTS_TABLE)
    .update({ publishing_started_at: new Date().toISOString() })
    .eq("id", postId)
    .is("facebook_post_id", null)
    .is("publishing_started_at", null)
    .select("*")
    .maybeSingle();

  if (!locked) {
    const { data: existing } = await sb.from(POSTS_TABLE).select("facebook_post_id, publishing_started_at").eq("id", postId).maybeSingle();
    if (existing && asString((existing as Record<string, unknown>).facebook_post_id)) {
      return { post: null, error: "already_published" };
    }
    return { post: null, error: "publish_in_progress" };
  }

  const row = locked as Record<string, unknown>;
  const platform = asString(row.platform);
  if (platform === "instagram") {
    await sb.from(POSTS_TABLE).update({ publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "facebook_not_applicable" };
  }

  const status = asString(row.status);
  if (!["approved", "scheduled", "ready_to_publish"].includes(status)) {
    await sb.from(POSTS_TABLE).update({ publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "invalid_status" };
  }

  if (!isApprovedRow(row) || asString(row.approved_by) !== SOCIAL_MARKETING_APPROVER) {
    await sb.from(POSTS_TABLE).update({ publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "approval_required" };
  }

  if (!approvalMatchesContent(row)) {
    await sb
      .from(POSTS_TABLE)
      .update({
        publishing_started_at: null,
        status: "pending_approval",
        approved_at: null,
        approved_by: null,
      })
      .eq("id", postId);
    return { post: null, error: "approval_stale" };
  }

  const message = asString(row.body_facebook).trim() || asString(row.topic).trim();
  if (!message) {
    await sb.from(POSTS_TABLE).update({ publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "invalid_input" };
  }

  let pageToken: string;
  try {
    pageToken = decryptSecret(asString(connection.encrypted_page_access_token));
  } catch {
    await sb.from(POSTS_TABLE).update({ publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "token_invalid" };
  }

  const pageId = asString(connection.page_id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);

  try {
    const published = await publishPageFeedPost({
      pageId,
      pageAccessToken: pageToken,
      message,
      fetchImpl,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const permalink = buildFacebookPostPermalink(published.id);
    const now = new Date().toISOString();
    const { data: updated, error } = await sb
      .from(POSTS_TABLE)
      .update({
        status: "published",
        facebook_post_id: published.id,
        facebook_post_url: permalink,
        published_to_facebook_at: now,
        publishing_started_at: null,
        publish_error_code: null,
        updated_at: now,
        meta_payload: { facebook: { id: published.id, pageId } },
      })
      .eq("id", postId)
      .select("*")
      .maybeSingle();

    if (error || !updated) return { post: null, error: "save_failed" };

    await recordAiActionServer({
      agentKey: "marketing",
      actionType: "social_post_published_facebook",
      summary: `פורסם בפייסבוק — ${asString(row.topic)}`,
      details: { postId, facebookPostId: published.id, pageId },
    });

    return { post: updated as Record<string, unknown>, error: null };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const patch = isAbort
      ? { status: "publish_uncertain", publish_error_code: "publish_timeout" }
      : {
          status: "failed",
          publish_error_code:
            err instanceof MetaGraphApiError ? "meta_api_error" : "meta_api_error",
        };
    await sb
      .from(POSTS_TABLE)
      .update({
        ...patch,
        publishing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    return { post: null, error: isAbort ? "publish_timeout" : "meta_api_error" };
  }
}

export async function hasPendingFacebookPageSelection(
  masterSessionToken: string
): Promise<boolean> {
  const token = await loadPendingUserToken(masterSessionToken);
  return Boolean(token);
}
