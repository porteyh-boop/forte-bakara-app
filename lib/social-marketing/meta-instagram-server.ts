import { decryptSecret } from "@/lib/social-marketing/meta-facebook-crypto";
import { MetaGraphApiError, type MetaGraphFetch } from "@/lib/social-marketing/meta-facebook-graph";
import { loadFacebookConnectionRow } from "@/lib/social-marketing/meta-facebook-server";
import { publishApprovedInstagramPostContent } from "@/lib/social-marketing/meta-instagram-publish";
import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import {
  mergeSocialPostMetaPayload,
  overallStatusAfterInstagramFailure,
  overallStatusAfterInstagramSuccess,
  targetsInstagram,
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
const PUBLISH_TIMEOUT_MS = 45_000;

export type MetaInstagramServerError =
  | "supabase_service_unconfigured"
  | "not_connected"
  | "instagram_not_connected"
  | "token_invalid"
  | "not_found"
  | "approval_required"
  | "approval_stale"
  | "invalid_status"
  | "invalid_input"
  | "instagram_image_required"
  | "publish_in_progress"
  | "already_published"
  | "instagram_not_applicable"
  | "publish_timeout"
  | "meta_api_error"
  | "save_failed";

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

export async function publishSocialPostToInstagramServer(
  postIdRaw: string,
  fetchImpl?: MetaGraphFetch
): Promise<{
  post: Record<string, unknown> | null;
  error: MetaInstagramServerError | null;
}> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { post: null, error: "supabase_service_unconfigured" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const connection = await loadFacebookConnectionRow();
  if (!connection) return { post: null, error: "not_connected" };

  const igUserId = asString(connection.instagram_business_account_id).trim();
  if (!igUserId) return { post: null, error: "instagram_not_connected" };

  const { data: locked } = await sb
    .from(POSTS_TABLE)
    .update({ instagram_publishing_started_at: new Date().toISOString() })
    .eq("id", postId)
    .is("instagram_media_id", null)
    .is("instagram_publishing_started_at", null)
    .select("*")
    .maybeSingle();

  if (!locked) {
    const { data: existing } = await sb
      .from(POSTS_TABLE)
      .select("instagram_media_id, instagram_publishing_started_at")
      .eq("id", postId)
      .maybeSingle();
    if (existing && asString((existing as Record<string, unknown>).instagram_media_id)) {
      const { data: full } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
      return { post: (full as Record<string, unknown>) ?? null, error: "already_published" };
    }
    return { post: null, error: "publish_in_progress" };
  }

  const row = locked as Record<string, unknown>;
  const platform = asString(row.platform) as SocialPlatformId;
  if (!targetsInstagram(platform)) {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "instagram_not_applicable" };
  }

  const status = asString(row.status);
  if (!["approved", "scheduled", "ready_to_publish", "failed"].includes(status)) {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "invalid_status" };
  }

  if (!isApprovedRow(row) || asString(row.approved_by) !== SOCIAL_MARKETING_APPROVER) {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "approval_required" };
  }

  if (!approvalMatchesContent(row)) {
    await sb
      .from(POSTS_TABLE)
      .update({
        instagram_publishing_started_at: null,
        status: "pending_approval",
        approved_at: null,
        approved_by: null,
      })
      .eq("id", postId);
    return { post: null, error: "approval_stale" };
  }

  const imageUrl = asString(row.image_url).trim();
  if (!imageUrl) {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "instagram_image_required" };
  }

  const caption = asString(row.body_instagram).trim();
  if (!caption) {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "invalid_input" };
  }

  let pageToken: string;
  try {
    pageToken = decryptSecret(asString(connection.encrypted_page_access_token));
  } catch {
    await sb.from(POSTS_TABLE).update({ instagram_publishing_started_at: null }).eq("id", postId);
    return { post: null, error: "token_invalid" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);

  try {
    const published = await publishApprovedInstagramPostContent({
      igUserId,
      pageAccessToken: pageToken,
      imageUrl,
      caption,
      fetchImpl,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const now = new Date().toISOString();
    const safePlatform: SocialPlatformId =
      platform === "instagram" || platform === "facebook" || platform === "both" ? platform : "instagram";
    const nextStatus = overallStatusAfterInstagramSuccess(safePlatform, {
      facebookPublished: Boolean(asString(row.facebook_post_id).trim()),
    });

    const { data: updated, error } = await sb
      .from(POSTS_TABLE)
      .update({
        status: nextStatus,
        instagram_publish_status: "published",
        instagram_media_id: published.mediaId,
        instagram_permalink: published.permalink,
        instagram_published_at: now,
        instagram_publish_error: null,
        instagram_publishing_started_at: null,
        updated_at: now,
        meta_payload: mergeSocialPostMetaPayload(row.meta_payload, {
          instagram: {
            mediaId: published.mediaId,
            igUserId,
            publishedAt: now,
            permalink: published.permalink ?? undefined,
          },
        }),
      })
      .eq("id", postId)
      .select("*")
      .maybeSingle();

    if (error || !updated) return { post: null, error: "save_failed" };

    await recordAiActionServer({
      agentKey: "marketing",
      actionType: "social_post_published_instagram",
      summary: `פורסם באינסטגרם — ${asString(row.topic)}`,
      details: {
        postId,
        instagramMediaId: published.mediaId,
        igUserId,
      },
    });

    return { post: updated as Record<string, unknown>, error: null };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const safePlatform: SocialPlatformId =
      platform === "instagram" || platform === "facebook" || platform === "both" ? platform : "instagram";
    const errorCode = isAbort ? "publish_timeout" : "meta_api_error";
    const errorMessage =
      err instanceof MetaGraphApiError
        ? err.message.slice(0, 500)
        : isAbort
          ? "publish_timeout"
          : "meta_api_error";
    const workflowStatus = isAbort
      ? "publish_uncertain"
      : overallStatusAfterInstagramFailure(safePlatform, {
          facebookPublished: Boolean(asString(row.facebook_post_id).trim()),
        });
    await sb
      .from(POSTS_TABLE)
      .update({
        status: workflowStatus,
        instagram_publish_status: "failed",
        instagram_publish_error: errorMessage,
        instagram_publishing_started_at: null,
        updated_at: new Date().toISOString(),
        meta_payload: mergeSocialPostMetaPayload(row.meta_payload, {
          instagram: {
            lastError: { code: errorCode, message: errorMessage, at: new Date().toISOString() },
          },
        }),
      })
      .eq("id", postId);
    return { post: null, error: isAbort ? "publish_timeout" : "meta_api_error" };
  }
}
