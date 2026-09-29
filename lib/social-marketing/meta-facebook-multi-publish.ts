import {
  buildFacebookPostPermalink,
} from "@/lib/social-marketing/meta-facebook-config";
import { MetaGraphApiError, type MetaGraphFetch } from "@/lib/social-marketing/meta-facebook-graph";
import { publishApprovedFacebookPostContent } from "@/lib/social-marketing/meta-facebook-publish";
import {
  decryptPageAccessToken,
  loadFacebookConnectionRowById,
  syncLegacyFacebookFieldsFromPublicationsServer,
} from "@/lib/social-marketing/social-facebook-pages-server";
import { normalizePublishTargets } from "@/lib/social-marketing/social-publish-targets";
import {
  overallStatusAfterFacebookFailure,
  overallStatusAfterFacebookSuccess,
  targetsFacebook,
} from "@/lib/social-marketing/social-marketing-publish-status";
import {
  SOCIAL_MARKETING_APPROVER,
  type SocialPlatformId,
} from "@/lib/social-marketing/social-marketing-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const POSTS_TABLE = "social_marketing_posts";
const PUBLICATIONS_TABLE = "social_marketing_facebook_publications";
const PUBLISH_TIMEOUT_MS = 25_000;

type PublishError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "not_found"
  | "approval_required"
  | "approval_stale"
  | "invalid_status"
  | "not_connected"
  | "token_invalid"
  | "publish_in_progress"
  | "already_published"
  | "facebook_not_applicable"
  | "publish_timeout"
  | "meta_api_error";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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

async function recomputePostWorkflowAfterFacebookBatch(
  postId: string,
  platform: SocialPlatformId
): Promise<void> {
  if (!isSupabaseServiceConfigured()) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  const { data: pubs } = await sb
    .from(PUBLICATIONS_TABLE)
    .select("publish_status")
    .eq("post_id", postId);

  const statuses = (pubs ?? []).map((p) => asString((p as Record<string, unknown>).publish_status));
  const selected = statuses.filter((s) => s !== "not_selected" && s !== "skipped");
  if (selected.length === 0) return;

  const allPublished = selected.every((s) => s === "published");
  const anyFailed = selected.some((s) => s === "failed");
  const anyPending = selected.some((s) => s === "pending");

  let nextStatus: string | null = null;
  if (allPublished) {
    nextStatus = overallStatusAfterFacebookSuccess(platform);
  } else if (anyFailed && !anyPending) {
    nextStatus = overallStatusAfterFacebookFailure(platform);
  } else {
    nextStatus = platform === "both" ? "ready_to_publish" : "ready_to_publish";
  }

  if (nextStatus) {
    await sb
      .from(POSTS_TABLE)
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", postId);
  }
}

export async function publishSocialPostToFacebookPageServer(
  postIdRaw: string,
  connectionIdRaw: string,
  fetchImpl?: MetaGraphFetch
): Promise<{
  post: Record<string, unknown> | null;
  error: PublishError | null;
}> {
  const postId = asString(postIdRaw).trim();
  const connectionId = asString(connectionIdRaw).trim();
  if (!postId || !connectionId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { post: null, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const { data: postRow } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
  if (!postRow) return { post: null, error: "not_found" };
  const row = postRow as Record<string, unknown>;
  const platform = asString(row.platform) as SocialPlatformId;
  if (!targetsFacebook(platform)) return { post: null, error: "facebook_not_applicable" };

  const targets = normalizePublishTargets(row.publish_targets);
  if (!targets.facebookConnectionIds.includes(connectionId)) {
    return { post: null, error: "invalid_input" };
  }

  const status = asString(row.status);
  if (!["approved", "scheduled", "ready_to_publish", "failed"].includes(status)) {
    return { post: null, error: "invalid_status" };
  }
  if (!isApprovedRow(row) || asString(row.approved_by) !== SOCIAL_MARKETING_APPROVER) {
    return { post: null, error: "approval_required" };
  }
  if (!approvalMatchesContent(row)) {
    await sb
      .from(POSTS_TABLE)
      .update({
        status: "pending_approval",
        approved_at: null,
        approved_by: null,
        publishing_started_at: null,
      })
      .eq("id", postId);
    return { post: null, error: "approval_stale" };
  }

  const { data: locked } = await sb
    .from(PUBLICATIONS_TABLE)
    .update({ publishing_started_at: new Date().toISOString() })
    .eq("post_id", postId)
    .eq("connection_id", connectionId)
    .in("publish_status", ["pending", "failed"])
    .is("facebook_post_id", null)
    .is("publishing_started_at", null)
    .select("*")
    .maybeSingle();

  if (!locked) {
    const { data: existing } = await sb
      .from(PUBLICATIONS_TABLE)
      .select("facebook_post_id, publish_status")
      .eq("post_id", postId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    if (existing && asString((existing as Record<string, unknown>).facebook_post_id)) {
      const { data: full } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
      return { post: (full as Record<string, unknown>) ?? null, error: "already_published" };
    }
    return { post: null, error: "publish_in_progress" };
  }

  const connection = await loadFacebookConnectionRowById(connectionId);
  if (!connection || asString(connection.connection_status) !== "connected") {
    await sb
      .from(PUBLICATIONS_TABLE)
      .update({ publishing_started_at: null })
      .eq("post_id", postId)
      .eq("connection_id", connectionId);
    return { post: null, error: "not_connected" };
  }

  const message = asString(row.body_facebook).trim() || asString(row.topic).trim();
  if (!message) {
    await sb
      .from(PUBLICATIONS_TABLE)
      .update({ publishing_started_at: null })
      .eq("post_id", postId)
      .eq("connection_id", connectionId);
    return { post: null, error: "invalid_input" };
  }

  let pageToken: string;
  try {
    pageToken = decryptPageAccessToken(connection);
  } catch {
    await sb
      .from(PUBLICATIONS_TABLE)
      .update({ publishing_started_at: null })
      .eq("post_id", postId)
      .eq("connection_id", connectionId);
    return { post: null, error: "token_invalid" };
  }

  const pageId = asString(connection.page_id);
  const imageUrl = asString(row.image_url).trim() || null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);

  try {
    const published = await publishApprovedFacebookPostContent({
      pageId,
      pageAccessToken: pageToken,
      message,
      imageUrl,
      fetchImpl,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const now = new Date().toISOString();
    const permalink = buildFacebookPostPermalink(published.facebookPostId);

    await sb
      .from(PUBLICATIONS_TABLE)
      .update({
        publish_status: "published",
        facebook_post_id: published.facebookPostId,
        facebook_post_url: permalink,
        publish_mode: published.mode,
        published_at: now,
        publishing_started_at: null,
        publish_error_code: null,
        publish_error_message: null,
        updated_at: now,
      })
      .eq("post_id", postId)
      .eq("connection_id", connectionId);

    await syncLegacyFacebookFieldsFromPublicationsServer(postId);
    await recomputePostWorkflowAfterFacebookBatch(postId, platform);

    const { data: full } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
    return { post: (full as Record<string, unknown>) ?? null, error: null };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const errorCode = isAbort ? "publish_timeout" : "meta_api_error";
    const errorMessage =
      err instanceof MetaGraphApiError
        ? err.message.slice(0, 500)
        : isAbort
          ? "publish_timeout"
          : "meta_api_error";

    await sb
      .from(PUBLICATIONS_TABLE)
      .update({
        publish_status: "failed",
        publish_error_code: errorCode,
        publish_error_message: errorMessage,
        publishing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("post_id", postId)
      .eq("connection_id", connectionId);

    await syncLegacyFacebookFieldsFromPublicationsServer(postId);
    await recomputePostWorkflowAfterFacebookBatch(postId, platform);

    return { post: null, error: isAbort ? "publish_timeout" : "meta_api_error" };
  }
}

export async function publishAllSelectedFacebookPagesServer(
  postIdRaw: string,
  options?: { onlyConnectionId?: string; fetchImpl?: MetaGraphFetch }
): Promise<{
  post: Record<string, unknown> | null;
  error: PublishError | null;
}> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { post: null, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const { data: postRow } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
  if (!postRow) return { post: null, error: "not_found" };
  const targets = normalizePublishTargets((postRow as Record<string, unknown>).publish_targets);
  const ids = options?.onlyConnectionId
    ? [options.onlyConnectionId]
    : targets.facebookConnectionIds;

  if (ids.length === 0) return { post: null, error: "facebook_not_applicable" };

  let lastPost: Record<string, unknown> | null = null;
  let lastError: PublishError | null = null;

  for (const connectionId of ids) {
    const result = await publishSocialPostToFacebookPageServer(
      postId,
      connectionId,
      options?.fetchImpl
    );
    if (result.post) lastPost = result.post;
    if (result.error && result.error !== "already_published") {
      lastError = result.error;
    }
  }

  if (lastPost) return { post: lastPost, error: null };
  return { post: null, error: lastError ?? "meta_api_error" };
}
