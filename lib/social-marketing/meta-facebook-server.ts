import { randomBytes, timingSafeEqual } from "crypto";
import {
  buildFacebookPostPermalink,
  getMetaFacebookOAuthRedirectUri,
  isMetaFacebookAppConfigured,
  isMetaFacebookConfigured,
  isMetaFacebookLoginConfigured,
  metaFacebookDialogOAuthUrl,
} from "@/lib/social-marketing/meta-facebook-config";
import { decryptSecret, encryptSecret, hashOpaque } from "@/lib/social-marketing/meta-facebook-crypto";
import {
  debugToken,
  exchangeCodeForUserAccessToken,
  exchangeForLongLivedUserToken,
  fetchMeAccountsDiagnostic,
  listManagedFacebookPages,
  MetaGraphApiError,
  type MetaGraphFetch,
} from "@/lib/social-marketing/meta-facebook-graph";
import {
  publishAllSelectedFacebookPagesServer,
  publishSocialPostToFacebookPageServer,
} from "@/lib/social-marketing/meta-facebook-multi-publish";
import {
  listFacebookConnectionRowsServer,
  loadFacebookConnectionRowLegacy,
  type FacebookPageConnectionDto,
} from "@/lib/social-marketing/social-facebook-pages-server";
import { fetchInstagramBusinessAccountForPage } from "@/lib/social-marketing/meta-instagram-graph";
import {
  overallStatusAfterFacebookFailure,
  overallStatusAfterFacebookSuccess,
  targetsFacebook,
} from "@/lib/social-marketing/social-marketing-publish-status";
import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { mergeSocialPostMetaPayload } from "@/lib/social-marketing/social-marketing-publish-status";
import {
  SOCIAL_MARKETING_APPROVER,
  type SocialPlatformId,
} from "@/lib/social-marketing/social-marketing-types";
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
  | "meta_login_config_not_configured"
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
  /** All connected pages (N). */
  pages: FacebookPageConnectionDto[];
  pageId: string | null;
  pageName: string | null;
  tokenValid: boolean | null;
  connectedAt: string | null;
  pendingPageSelection: boolean;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  instagramConnected: boolean;
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
  if (!isMetaFacebookAppConfigured()) {
    return { state: "", redirectUrl: "", error: "meta_app_not_configured" };
  }
  if (!isMetaFacebookLoginConfigured()) {
    return { state: "", redirectUrl: "", error: "meta_login_config_not_configured" };
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
  if (!isMetaFacebookAppConfigured()) return { ok: false, error: "meta_app_not_configured" };
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

export async function getFacebookPagesMeAccountsDiagnosticServer(
  masterSessionToken: string,
  fetchImpl?: MetaGraphFetch
): Promise<{
  diagnostic: Awaited<ReturnType<typeof fetchMeAccountsDiagnostic>> | null;
  error: "oauth_failed" | "meta_api_error" | null;
}> {
  const token = await loadPendingUserToken(masterSessionToken);
  if (!token) return { diagnostic: null, error: "oauth_failed" };
  try {
    const diagnostic = await fetchMeAccountsDiagnostic({ userAccessToken: token, fetchImpl });
    if (!diagnostic.graphOk) {
      return { diagnostic: null, error: "meta_api_error" };
    }
    return { diagnostic, error: null };
  } catch {
    return { diagnostic: null, error: "meta_api_error" };
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
  const { data: existingByPage } = await sb
    .from(CONNECTION_TABLE)
    .select("id, display_label, is_primary_for_instagram")
    .eq("page_id", match.id)
    .maybeSingle();

  const displayLabel =
    asString((existingByPage as Record<string, unknown> | null)?.display_label).trim() ||
    match.name;

  const upsertPayload = {
    page_id: match.id,
    page_name: match.name,
    display_label: displayLabel,
    encrypted_page_access_token: encryptSecret(match.accessToken),
    token_expires_at: null,
    connection_status: "connected",
    connected_at: now,
    updated_at: now,
    singleton_key: "default",
  };

  let connectionRowId = asString((existingByPage as Record<string, unknown> | null)?.id);
  if (connectionRowId) {
    const { error } = await sb.from(CONNECTION_TABLE).update(upsertPayload).eq("id", connectionRowId);
    if (error) return { status: null, error: "save_failed" };
  } else {
    const { data: inserted, error } = await sb
      .from(CONNECTION_TABLE)
      .insert(upsertPayload)
      .select("id")
      .maybeSingle();
    if (error || !inserted) return { status: null, error: "save_failed" };
    connectionRowId = asString((inserted as Record<string, unknown>).id);
  }

  try {
    const ig = await fetchInstagramBusinessAccountForPage({
      pageId: match.id,
      pageAccessToken: match.accessToken,
      fetchImpl: input.fetchImpl,
    });
    const igPatch: Record<string, unknown> = {
      instagram_business_account_id: ig?.id ?? null,
      instagram_username: ig?.username ?? null,
      updated_at: new Date().toISOString(),
    };
    const { data: anyPrimary } = await sb
      .from(CONNECTION_TABLE)
      .select("id")
      .eq("is_primary_for_instagram", true)
      .eq("connection_status", "connected")
      .maybeSingle();
    if (ig?.id && !anyPrimary) {
      igPatch.is_primary_for_instagram = true;
    }
    await sb.from(CONNECTION_TABLE).update(igPatch).eq("id", connectionRowId);
  } catch {
    /* IG discovery is best-effort; publish will surface errors */
  }

  await sb.from(OAUTH_TABLE).delete().eq("master_session_hash", hashOpaque(input.masterSessionToken));

  return getFacebookConnectionStatusServer(input.masterSessionToken, input.fetchImpl);
}

export async function disconnectFacebookServer(connectionIdRaw?: string): Promise<{
  error: MetaFacebookServerError | null;
}> {
  if (!isSupabaseServiceConfigured()) return { error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { error: "supabase_service_unconfigured" };
  const connectionId = asString(connectionIdRaw).trim();
  const now = new Date().toISOString();
  if (connectionId) {
    const { error } = await sb
      .from(CONNECTION_TABLE)
      .update({ connection_status: "disconnected", updated_at: now })
      .eq("id", connectionId);
    if (error) return { error: "save_failed" };
    return { error: null };
  }
  const { error } = await sb
    .from(CONNECTION_TABLE)
    .update({ connection_status: "disconnected", updated_at: now })
    .eq("connection_status", "connected");
  if (error) return { error: "save_failed" };
  return { error: null };
}

/** First connected page — legacy callers. Prefer loadPrimaryInstagramConnectionRowServer for IG. */
export async function loadFacebookConnectionRow(): Promise<Record<string, unknown> | null> {
  return loadFacebookConnectionRowLegacy();
}

export { publishSocialPostToFacebookPageServer };

export async function getFacebookConnectionStatusServer(
  masterSessionToken?: string,
  fetchImpl?: MetaGraphFetch
): Promise<{ status: FacebookConnectionStatusDto; error: null }> {
  const configured = isMetaFacebookConfigured();
  const pendingPageSelection = masterSessionToken
    ? await hasPendingFacebookPageSelection(masterSessionToken)
    : false;

  const connectedRows = await listFacebookConnectionRowsServer({ connectedOnly: true });
  if (connectedRows.length === 0) {
    return {
      status: {
        configured,
        connected: false,
        pages: [],
        pageId: null,
        pageName: null,
        tokenValid: null,
        connectedAt: null,
        pendingPageSelection,
        instagramBusinessAccountId: null,
        instagramUsername: null,
        instagramConnected: false,
      },
      error: null,
    };
  }

  const pages: FacebookPageConnectionDto[] = [];
  for (const connRow of connectedRows) {
    let tokenValid: boolean | null = null;
    let pageToken: string | null = null;
    try {
      pageToken = decryptSecret(asString(connRow.encrypted_page_access_token));
      const debug = await debugToken({ inputToken: pageToken, fetchImpl });
      tokenValid = debug.isValid;
    } catch {
      tokenValid = false;
    }
    const checkedAt = new Date().toISOString();
    if (isSupabaseServiceConfigured()) {
      const sb = getSupabaseServiceClient();
      if (sb) {
        await sb
          .from(CONNECTION_TABLE)
          .update({
            last_token_checked_at: checkedAt,
            connection_status: tokenValid === false ? "token_invalid" : "connected",
            updated_at: checkedAt,
          })
          .eq("id", asString(connRow.id));
      }
    }
    pages.push({
      id: asString(connRow.id),
      pageId: asString(connRow.page_id),
      pageName: asString(connRow.page_name),
      displayLabel: asString(connRow.display_label) || asString(connRow.page_name),
      connectionStatus:
        connRow.connection_status === "token_invalid"
          ? "token_invalid"
          : connRow.connection_status === "disconnected"
            ? "disconnected"
            : "connected",
      tokenValid,
      connectedAt: asString(connRow.connected_at),
      lastTokenCheckedAt: checkedAt,
      isPrimaryForInstagram: connRow.is_primary_for_instagram === true,
      instagramBusinessAccountId: asString(connRow.instagram_business_account_id) || null,
      instagramUsername: asString(connRow.instagram_username) || null,
    });
  }

  const primary =
    pages.find((p) => p.isPrimaryForInstagram && p.instagramBusinessAccountId) ??
    pages.find((p) => p.instagramBusinessAccountId) ??
    pages[0];
  const legacy = pages[0];

  return {
    status: {
      configured,
      connected: pages.length > 0,
      pages,
      pageId: legacy?.pageId ?? null,
      pageName: legacy?.pageName ?? null,
      tokenValid: legacy?.tokenValid ?? null,
      connectedAt: legacy?.connectedAt ?? null,
      pendingPageSelection: false,
      instagramBusinessAccountId: primary?.instagramBusinessAccountId ?? null,
      instagramUsername: primary?.instagramUsername ?? null,
      instagramConnected: Boolean(primary?.instagramBusinessAccountId),
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
  fetchImpl?: MetaGraphFetch,
  options?: { onlyConnectionId?: string }
): Promise<{
  post: Record<string, unknown> | null;
  error: MetaFacebookServerError | null;
}> {
  const connected = await listFacebookConnectionRowsServer({ connectedOnly: true });
  if (connected.length === 0) return { post: null, error: "not_connected" };
  const result = await publishAllSelectedFacebookPagesServer(postIdRaw, {
    onlyConnectionId: options?.onlyConnectionId,
    fetchImpl,
  });
  return {
    post: result.post,
    error: (result.error ?? null) as MetaFacebookServerError | null,
  };
}

export async function hasPendingFacebookPageSelection(
  masterSessionToken: string
): Promise<boolean> {
  const token = await loadPendingUserToken(masterSessionToken);
  return Boolean(token);
}
