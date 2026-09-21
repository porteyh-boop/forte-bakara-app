import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import type { OpenAiMarketingPostDraft } from "@/lib/llm/openai-marketing-schema";
import {
  SOCIAL_MARKETING_APPROVER,
  SOCIAL_PLATFORMS,
  SOCIAL_POST_STATUSES,
  type SocialMarketingPostAction,
  type SocialMarketingPostDto,
  type SocialMarketingPostInput,
  type SocialMarketingPostMetaPayload,
  type SocialPlatformId,
  type SocialPostStatusId,
} from "@/lib/social-marketing/social-marketing-types";
import { publishSocialPostToFacebookServer } from "@/lib/social-marketing/meta-facebook-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const POSTS_TABLE = "social_marketing_posts";

export type SocialMarketingServerError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "not_found"
  | "save_failed"
  | "approval_required"
  | "approval_via_dashboard"
  | "invalid_status"
  | "marketing_agent_missing"
  | "not_connected"
  | "approval_stale"
  | "publish_in_progress"
  | "already_published"
  | "facebook_not_applicable"
  | "publish_timeout"
  | "meta_api_error"
  | "token_invalid";

const SOCIAL_POST_APPROVAL_ACTION = "send_social_post";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function isPlatform(value: string): value is SocialPlatformId {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

function isStatus(value: string): value is SocialPostStatusId {
  return (SOCIAL_POST_STATUSES as readonly string[]).includes(value);
}

function parseMetaPayload(row: Record<string, unknown>): SocialMarketingPostMetaPayload {
  const raw = row.meta_payload;
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  return {
    generatedBy: asString(rec.generatedBy).trim() || undefined,
    visualPrompt: asString(rec.visualPrompt).trim() || undefined,
    generatedAt: asString(rec.generatedAt).trim() || undefined,
  };
}

function mapPost(row: Record<string, unknown>): SocialMarketingPostDto {
  const meta = parseMetaPayload(row);
  const platformRaw = asString(row.platform);
  const statusRaw = asString(row.status);
  return {
    id: asString(row.id),
    topic: asString(row.topic),
    targetAudience: asString(row.target_audience),
    platform: isPlatform(platformRaw) ? platformRaw : "facebook",
    bodyFacebook: asString(row.body_facebook),
    bodyInstagram: asString(row.body_instagram),
    publishDate: asString(row.publish_date) || null,
    publishTime: asString(row.publish_time).slice(0, 5) || null,
    imageUrl: asString(row.image_url) || null,
    visualPrompt: meta.visualPrompt ?? null,
    generatedBy: meta.generatedBy ?? null,
    status: isStatus(statusRaw) ? statusRaw : "draft",
    approvedAt: asString(row.approved_at) || null,
    approvedBy: asString(row.approved_by) || null,
    contentVersion: Number(row.content_version) || 1,
    approvedContentVersion:
      row.approved_content_version == null ? null : Number(row.approved_content_version),
    facebookPostId: asString(row.facebook_post_id) || null,
    facebookPostUrl: asString(row.facebook_post_url) || null,
    publishedToFacebookAt: asString(row.published_to_facebook_at) || null,
    publishErrorCode: asString(row.publish_error_code) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function isApprovedRow(row: Record<string, unknown>): boolean {
  return Boolean(asString(row.approved_at).trim() && asString(row.approved_by).trim());
}

const CONTENT_FIELDS = [
  "topic",
  "target_audience",
  "platform",
  "body_facebook",
  "body_instagram",
  "publish_date",
  "publish_time",
  "image_url",
] as const;

function contentFieldChanged(
  row: Record<string, unknown>,
  patch: Record<string, unknown>
): boolean {
  for (const key of CONTENT_FIELDS) {
    if (key in patch && asString(patch[key]) !== asString(row[key])) {
      return true;
    }
  }
  return false;
}

const STATUSES_RESET_ON_EDIT: SocialPostStatusId[] = [
  "approved",
  "scheduled",
  "ready_to_publish",
];

function parseInput(body: unknown): SocialMarketingPostInput | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const platform = asString(raw.platform).trim();
  if (!isPlatform(platform)) return null;
  const topic = asString(raw.topic).trim();
  if (!topic) return null;
  return {
    topic,
    targetAudience: asString(raw.targetAudience ?? raw.target_audience).trim(),
    platform,
    bodyFacebook: asString(raw.bodyFacebook ?? raw.body_facebook).trim(),
    bodyInstagram: asString(raw.bodyInstagram ?? raw.body_instagram).trim(),
    publishDate: asString(raw.publishDate ?? raw.publish_date).trim(),
    publishTime: asString(raw.publishTime ?? raw.publish_time).trim(),
    imageUrl: asString(raw.imageUrl ?? raw.image_url).trim(),
  };
}

function inputToRow(input: SocialMarketingPostInput): Record<string, unknown> {
  return {
    topic: input.topic,
    target_audience: input.targetAudience,
    platform: input.platform,
    body_facebook: input.bodyFacebook,
    body_instagram: input.bodyInstagram,
    publish_date: input.publishDate || null,
    publish_time: input.publishTime ? `${input.publishTime.slice(0, 5)}:00` : null,
    image_url: input.imageUrl || null,
    updated_at: new Date().toISOString(),
  };
}

function validateBodies(input: SocialMarketingPostInput): boolean {
  if (input.platform === "facebook") return input.bodyFacebook.length > 0;
  if (input.platform === "instagram") return input.bodyInstagram.length > 0;
  return input.bodyFacebook.length > 0 || input.bodyInstagram.length > 0;
}

export async function listSocialMarketingPostsServer(): Promise<{
  posts: SocialMarketingPostDto[];
  error: SocialMarketingServerError | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { posts: [], error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { posts: [], error: "supabase_service_unconfigured" };

  const { data, error } = await sb
    .from(POSTS_TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) return { posts: [], error: "save_failed" };
  return {
    posts: (data ?? []).map((r) => mapPost(r as Record<string, unknown>)),
    error: null,
  };
}

export async function createSocialMarketingPostServer(body: unknown): Promise<{
  post: SocialMarketingPostDto | null;
  error: SocialMarketingServerError | null;
}> {
  const input = parseInput(body);
  if (!input || !validateBodies(input)) {
    return { post: null, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { post: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const row = {
    ...inputToRow(input),
    status: "draft",
    approved_at: null,
    approved_by: null,
  };

  const { data, error } = await sb.from(POSTS_TABLE).insert(row).select("*").maybeSingle();
  if (error || !data) return { post: null, error: "save_failed" };

  const post = mapPost(data as Record<string, unknown>);
  await recordAiActionServer({
    agentKey: "marketing",
    actionType: "social_post_draft_created",
    summary: `טיוטת פוסט — ${post.topic}`,
    details: { postId: post.id },
  });

  return { post, error: null };
}

export async function updateSocialMarketingPostServer(
  postIdRaw: string,
  body: unknown
): Promise<{ post: SocialMarketingPostDto | null; error: SocialMarketingServerError | null }> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };

  const input = parseInput(body);
  if (!input || !validateBodies(input)) {
    return { post: null, error: "invalid_input" };
  }

  if (!isSupabaseServiceConfigured()) {
    return { post: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const { data: existing } = await sb
    .from(POSTS_TABLE)
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (!existing) return { post: null, error: "not_found" };

  const patch = inputToRow(input);
  const status = asString((existing as Record<string, unknown>).status);
  if (contentFieldChanged(existing as Record<string, unknown>, patch)) {
    patch.content_version = (Number((existing as Record<string, unknown>).content_version) || 1) + 1;
    if (isStatus(status) && STATUSES_RESET_ON_EDIT.includes(status)) {
      patch.status = "pending_approval";
      patch.approved_at = null;
      patch.approved_by = null;
      patch.approved_content_version = null;
    }
  }

  const { data, error } = await sb
    .from(POSTS_TABLE)
    .update(patch)
    .eq("id", postId)
    .select("*")
    .maybeSingle();

  if (error || !data) return { post: null, error: "save_failed" };
  return { post: mapPost(data as Record<string, unknown>), error: null };
}

async function loadRow(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  postId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await sb.from(POSTS_TABLE).select("*").eq("id", postId).maybeSingle();
  return data ? (data as Record<string, unknown>) : null;
}

function requireApproval(row: Record<string, unknown>): SocialMarketingServerError | null {
  if (!isApprovedRow(row)) return "approval_required";
  return null;
}

export async function registerSocialPostPendingApprovalServer(
  postId: string,
  topic: string
): Promise<void> {
  await recordAiActionServer({
    agentKey: "marketing",
    actionType: SOCIAL_POST_APPROVAL_ACTION,
    summary: `פוסט ממתין לאישור — ${topic}`,
    details: { postId },
  });
}

async function applySocialPostJudahDecisionInternal(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  postId: string,
  decision: "approved" | "rejected"
): Promise<{ post: SocialMarketingPostDto | null; error: SocialMarketingServerError | null }> {
  const row = await loadRow(sb, postId);
  if (!row) return { post: null, error: "not_found" };

  const status = asString(row.status);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (decision === "approved") {
    if (status !== "pending_approval") return { post: null, error: "invalid_status" };
    patch.status = "approved";
    patch.approved_at = new Date().toISOString();
    patch.approved_by = SOCIAL_MARKETING_APPROVER;
    patch.approved_content_version = Number(row.content_version) || 1;
  } else {
    if (status !== "pending_approval" && status !== "approved") {
      return { post: null, error: "invalid_status" };
    }
    patch.status = "rejected";
    patch.approved_at = null;
    patch.approved_by = null;
    patch.approved_content_version = null;
  }

  const { data, error } = await sb
    .from(POSTS_TABLE)
    .update(patch)
    .eq("id", postId)
    .select("*")
    .maybeSingle();

  if (error || !data) return { post: null, error: "save_failed" };
  return { post: mapPost(data as Record<string, unknown>), error: null };
}

/** Sync social post when יהודה approves/rejects from dashboard (send_social_post). */
export async function applyJudahDecisionToSocialPostServer(
  postIdRaw: string,
  decision: "approved" | "rejected"
): Promise<{ post: SocialMarketingPostDto | null; error: SocialMarketingServerError | null }> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { post: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };
  return applySocialPostJudahDecisionInternal(sb, postId, decision);
}

function draftToRow(draft: OpenAiMarketingPostDraft, generatedAt: string): Record<string, unknown> {
  return {
    topic: draft.topic.trim(),
    target_audience: draft.target_audience.trim(),
    platform: draft.platform,
    body_facebook: draft.body_facebook.trim(),
    body_instagram: draft.body_instagram.trim(),
    publish_date: draft.publish_date.trim(),
    publish_time: `${draft.publish_time.trim().slice(0, 5)}:00`,
    image_url: null,
    status: "pending_approval",
    approved_at: null,
    approved_by: null,
    meta_payload: {
      generatedBy: "marketing_agent_v1",
      visualPrompt: draft.visual_prompt.trim(),
      generatedAt,
    },
    updated_at: generatedAt,
  };
}

export async function persistAiMarketingBatchServer(
  drafts: OpenAiMarketingPostDraft[]
): Promise<{ posts: SocialMarketingPostDto[]; error: SocialMarketingServerError | null }> {
  if (drafts.length !== 3) return { posts: [], error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { posts: [], error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { posts: [], error: "supabase_service_unconfigured" };

  const generatedAt = new Date().toISOString();
  const insertedIds: string[] = [];
  const savedPosts: SocialMarketingPostDto[] = [];

  try {
    for (const draft of drafts) {
      const { data, error } = await sb
        .from(POSTS_TABLE)
        .insert(draftToRow(draft, generatedAt))
        .select("*")
        .maybeSingle();
      if (error || !data) throw new Error("insert_failed");
      const post = mapPost(data as Record<string, unknown>);
      insertedIds.push(post.id);
      savedPosts.push(post);
    }

    for (const post of savedPosts) {
      const reg = await recordAiActionServer({
        agentKey: "marketing",
        actionType: SOCIAL_POST_APPROVAL_ACTION,
        summary: `פוסט ממתין לאישור — ${post.topic}`,
        details: { postId: post.id },
      });
      if (reg.error) throw new Error("approval_register_failed");
    }

    return { posts: savedPosts, error: null };
  } catch {
    if (insertedIds.length > 0) {
      await sb.from(POSTS_TABLE).delete().in("id", insertedIds);
    }
    return { posts: [], error: "save_failed" };
  }
}

export async function runSocialMarketingPostActionServer(
  postIdRaw: string,
  actionRaw: unknown
): Promise<{ post: SocialMarketingPostDto | null; error: SocialMarketingServerError | null }> {
  const postId = asString(postIdRaw).trim();
  const action = asString(actionRaw).trim() as SocialMarketingPostAction;
  const allowed: SocialMarketingPostAction[] = [
    "submit_for_approval",
    "approve",
    "reject",
    "schedule",
    "mark_ready_to_publish",
    "publish_facebook",
    "mark_failed",
  ];
  if (!postId || !allowed.includes(action)) {
    return { post: null, error: "invalid_input" };
  }

  if (action === "publish_facebook") {
    const published = await publishSocialPostToFacebookServer(postId);
    if (published.error || !published.post) {
      return { post: null, error: (published.error ?? "save_failed") as SocialMarketingServerError };
    }
    return { post: mapPost(published.post), error: null };
  }

  if (!isSupabaseServiceConfigured()) {
    return { post: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const row = await loadRow(sb, postId);
  if (!row) return { post: null, error: "not_found" };

  const status = asString(row.status);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (action === "submit_for_approval") {
    if (status !== "draft" && status !== "rejected") {
      return { post: null, error: "invalid_status" };
    }
    patch.status = "pending_approval";
    patch.approved_at = null;
    patch.approved_by = null;
    patch.approved_content_version = null;
  } else if (action === "approve" || action === "reject") {
    return { post: null, error: "approval_via_dashboard" };
  } else if (action === "schedule") {
    const block = requireApproval(row);
    if (block) return { post: null, error: block };
    if (status !== "approved") return { post: null, error: "invalid_status" };
    if (!asString(row.publish_date).trim() || !asString(row.publish_time).trim()) {
      return { post: null, error: "invalid_input" };
    }
    patch.status = "scheduled";
  } else if (action === "mark_ready_to_publish") {
    const block = requireApproval(row);
    if (block) return { post: null, error: block };
    if (status !== "scheduled") return { post: null, error: "invalid_status" };
    patch.status = "ready_to_publish";
  } else if (action === "mark_failed") {
    patch.status = "failed";
  }

  const { data, error } = await sb
    .from(POSTS_TABLE)
    .update(patch)
    .eq("id", postId)
    .select("*")
    .maybeSingle();

  if (error || !data) return { post: null, error: "save_failed" };

  const post = mapPost(data as Record<string, unknown>);

  if (action === "submit_for_approval") {
    await registerSocialPostPendingApprovalServer(post.id, post.topic);
  } else {
    await recordAiActionServer({
      agentKey: "marketing",
      actionType: `social_post_${action}`,
      summary: `${post.topic} — ${action}`,
      details: { postId: post.id, status: post.status },
    });
  }

  return { post, error: null };
}

export async function duplicateSocialMarketingPostServer(postIdRaw: string): Promise<{
  post: SocialMarketingPostDto | null;
  error: SocialMarketingServerError | null;
}> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { post: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { post: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { post: null, error: "supabase_service_unconfigured" };

  const row = await loadRow(sb, postId);
  if (!row) return { post: null, error: "not_found" };

  const copy = {
    topic: `${asString(row.topic)} (עותק)`,
    target_audience: asString(row.target_audience),
    platform: asString(row.platform),
    body_facebook: asString(row.body_facebook),
    body_instagram: asString(row.body_instagram),
    publish_date: row.publish_date ?? null,
    publish_time: row.publish_time ?? null,
    image_url: asString(row.image_url) || null,
    status: "draft",
    approved_at: null,
    approved_by: null,
  };

  const { data, error } = await sb.from(POSTS_TABLE).insert(copy).select("*").maybeSingle();
  if (error || !data) return { post: null, error: "save_failed" };
  return { post: mapPost(data as Record<string, unknown>), error: null };
}

export async function deleteSocialMarketingPostServer(postIdRaw: string): Promise<{
  deleted: boolean;
  error: SocialMarketingServerError | null;
}> {
  const postId = asString(postIdRaw).trim();
  if (!postId) return { deleted: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { deleted: false, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: false, error: "supabase_service_unconfigured" };

  const row = await loadRow(sb, postId);
  if (!row) return { deleted: false, error: "not_found" };

  const { error } = await sb.from(POSTS_TABLE).delete().eq("id", postId);
  if (error) return { deleted: false, error: "save_failed" };

  await recordAiActionServer({
    agentKey: "marketing",
    actionType: "social_post_deleted",
    summary: `פוסט נמחק — ${asString(row.topic)}`,
    details: { postId },
  });

  return { deleted: true, error: null };
}

/** QA / tests */
export function socialPostHasApproval(row: {
  approvedAt: string | null;
  approvedBy: string | null;
}): boolean {
  return Boolean(row.approvedAt?.trim() && row.approvedBy?.trim());
}

export { isApprovedRow, requireApproval, mapPost };
