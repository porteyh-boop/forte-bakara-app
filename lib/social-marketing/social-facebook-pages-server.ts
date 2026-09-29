import { decryptSecret } from "@/lib/social-marketing/meta-facebook-crypto";
import {
  normalizePublishTargets,
  publishTargetsToJson,
  type SocialPublishTargets,
} from "@/lib/social-marketing/social-publish-targets";
import type { SocialPlatformId } from "@/lib/social-marketing/social-marketing-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const CONNECTION_TABLE = "social_facebook_connection";
const PUBLICATIONS_TABLE = "social_marketing_facebook_publications";
const POSTS_TABLE = "social_marketing_posts";

export type FacebookPageConnectionDto = {
  id: string;
  pageId: string;
  pageName: string;
  displayLabel: string;
  connectionStatus: "connected" | "disconnected" | "token_invalid";
  tokenValid: boolean | null;
  connectedAt: string;
  lastTokenCheckedAt: string | null;
  isPrimaryForInstagram: boolean;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
};

export type FacebookPublicationDto = {
  id: string;
  connectionId: string;
  pageId: string;
  displayLabel: string;
  publishStatus: string;
  facebookPostId: string | null;
  facebookPostUrl: string | null;
  publishMode: string | null;
  publishErrorCode: string | null;
  publishErrorMessage: string | null;
  publishedAt: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function mapConnectionRow(
  row: Record<string, unknown>,
  tokenValid: boolean | null
): FacebookPageConnectionDto {
  return {
    id: asString(row.id),
    pageId: asString(row.page_id),
    pageName: asString(row.page_name),
    displayLabel: asString(row.display_label) || asString(row.page_name),
    connectionStatus:
      row.connection_status === "disconnected" || row.connection_status === "token_invalid"
        ? row.connection_status
        : "connected",
    tokenValid,
    connectedAt: asString(row.connected_at),
    lastTokenCheckedAt: asString(row.last_token_checked_at) || null,
    isPrimaryForInstagram: row.is_primary_for_instagram === true,
    instagramBusinessAccountId: asString(row.instagram_business_account_id) || null,
    instagramUsername: asString(row.instagram_username) || null,
  };
}

export async function listConnectedFacebookPageIdsServer(): Promise<string[]> {
  const rows = await listFacebookConnectionRowsServer({ connectedOnly: true });
  return rows.map((r) => asString(r.id)).filter(Boolean);
}

export async function listFacebookConnectionRowsServer(options?: {
  connectedOnly?: boolean;
}): Promise<Record<string, unknown>[]> {
  if (!isSupabaseServiceConfigured()) return [];
  const sb = getSupabaseServiceClient();
  if (!sb) return [];
  let q = sb.from(CONNECTION_TABLE).select("*").order("connected_at", { ascending: true });
  if (options?.connectedOnly) {
    q = q.eq("connection_status", "connected");
  }
  const { data } = await q;
  return (data ?? []) as Record<string, unknown>[];
}

export async function loadFacebookConnectionRowById(
  connectionId: string
): Promise<Record<string, unknown> | null> {
  if (!isSupabaseServiceConfigured()) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from(CONNECTION_TABLE)
    .select("*")
    .eq("id", connectionId.trim())
    .maybeSingle();
  return data ? (data as Record<string, unknown>) : null;
}

export async function loadPrimaryInstagramConnectionRowServer(): Promise<Record<
  string,
  unknown
> | null> {
  if (!isSupabaseServiceConfigured()) return null;
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: primary } = await sb
    .from(CONNECTION_TABLE)
    .select("*")
    .eq("is_primary_for_instagram", true)
    .eq("connection_status", "connected")
    .maybeSingle();
  if (primary) return primary as Record<string, unknown>;
  const { data: fallback } = await sb
    .from(CONNECTION_TABLE)
    .select("*")
    .eq("connection_status", "connected")
    .not("instagram_business_account_id", "is", null)
    .order("connected_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return fallback ? (fallback as Record<string, unknown>) : null;
}

/** @deprecated use loadPrimaryInstagramConnectionRowServer or loadFacebookConnectionRowById */
export async function loadFacebookConnectionRowLegacy(): Promise<Record<string, unknown> | null> {
  const rows = await listFacebookConnectionRowsServer({ connectedOnly: true });
  return rows[0] ?? null;
}

export async function resolveDefaultPublishTargetsForPostServer(
  platform: SocialPlatformId
): Promise<SocialPublishTargets> {
  const { defaultPublishTargetsForPlatform } = await import(
    "@/lib/social-marketing/social-publish-targets"
  );
  const connectedIds = await listConnectedFacebookPageIdsServer();
  const primary = await loadPrimaryInstagramConnectionRowServer();
  const igAvailable = Boolean(asString(primary?.instagram_business_account_id).trim());
  return defaultPublishTargetsForPlatform({
    platform,
    connectedFacebookConnectionIds: connectedIds,
    instagramAvailable: igAvailable,
  });
}

export async function loadFacebookPublicationsForPostIdsServer(
  postIds: string[]
): Promise<Map<string, FacebookPublicationDto[]>> {
  const map = new Map<string, FacebookPublicationDto[]>();
  if (postIds.length === 0) return map;
  if (!isSupabaseServiceConfigured()) return map;
  const sb = getSupabaseServiceClient();
  if (!sb) return map;

  const { data: pubs } = await sb.from(PUBLICATIONS_TABLE).select("*").in("post_id", postIds);
  const connectionIds = [
    ...new Set(
      (pubs ?? [])
        .map((p) => asString((p as Record<string, unknown>).connection_id))
        .filter(Boolean)
    ),
  ];
  const connById = new Map<string, Record<string, unknown>>();
  if (connectionIds.length > 0) {
    const { data: conns } = await sb
      .from(CONNECTION_TABLE)
      .select("id, page_id, display_label, page_name")
      .in("id", connectionIds);
    for (const c of conns ?? []) {
      const rec = c as Record<string, unknown>;
      connById.set(asString(rec.id), rec);
    }
  }

  for (const raw of pubs ?? []) {
    const rec = raw as Record<string, unknown>;
    const postId = asString(rec.post_id);
    const conn = connById.get(asString(rec.connection_id)) ?? null;
    const dto: FacebookPublicationDto = {
      id: asString(rec.id),
      connectionId: asString(rec.connection_id),
      pageId: asString(conn?.page_id),
      displayLabel: asString(conn?.display_label) || asString(conn?.page_name) || "Facebook",
      publishStatus: asString(rec.publish_status) || "pending",
      facebookPostId: asString(rec.facebook_post_id) || null,
      facebookPostUrl: asString(rec.facebook_post_url) || null,
      publishMode: asString(rec.publish_mode) || null,
      publishErrorCode: asString(rec.publish_error_code) || null,
      publishErrorMessage: asString(rec.publish_error_message) || null,
      publishedAt: asString(rec.published_at) || null,
    };
    const list = map.get(postId) ?? [];
    list.push(dto);
    map.set(postId, list);
  }
  return map;
}

export async function syncFacebookPublicationsForPostServer(
  postId: string,
  targets: SocialPublishTargets,
  platform: SocialPlatformId
): Promise<void> {
  if (!isSupabaseServiceConfigured()) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  const connections = await listFacebookConnectionRowsServer({ connectedOnly: true });
  const selected = new Set(targets.facebookConnectionIds);
  const now = new Date().toISOString();

  for (const conn of connections) {
    const connectionId = asString(conn.id);
    if (!connectionId) continue;

    const { data: existing } = await sb
      .from(PUBLICATIONS_TABLE)
      .select("*")
      .eq("post_id", postId)
      .eq("connection_id", connectionId)
      .maybeSingle();

    const isSelected = selected.has(connectionId) && platform !== "instagram";
    const existingStatus = asString((existing as Record<string, unknown> | null)?.publish_status);
    const hasGraphId = Boolean(
      asString((existing as Record<string, unknown> | null)?.facebook_post_id).trim()
    );

    let nextStatus = "not_selected";
    if (!isSelected) {
      nextStatus = hasGraphId ? "published" : "not_selected";
    } else if (existingStatus === "published" || hasGraphId) {
      nextStatus = "published";
    } else if (existingStatus === "failed") {
      nextStatus = "failed";
    } else {
      nextStatus = "pending";
    }

    if (existing) {
      await sb
        .from(PUBLICATIONS_TABLE)
        .update({ publish_status: nextStatus, updated_at: now })
        .eq("id", asString((existing as Record<string, unknown>).id));
    } else {
      await sb.from(PUBLICATIONS_TABLE).insert({
        post_id: postId,
        connection_id: connectionId,
        publish_status: nextStatus,
        updated_at: now,
      });
    }
  }
}

export async function applyPublishTargetsToPostRowServer(
  postId: string,
  targets: SocialPublishTargets,
  platform: SocialPlatformId
): Promise<void> {
  if (!isSupabaseServiceConfigured()) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  await sb
    .from(POSTS_TABLE)
    .update({
      publish_targets: publishTargetsToJson(targets),
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
  await syncFacebookPublicationsForPostServer(postId, targets, platform);
}

export async function ensurePostHasDefaultPublishTargetsServer(
  row: Record<string, unknown>
): Promise<SocialPublishTargets> {
  const raw = row.publish_targets;
  const parsed = normalizePublishTargets(raw);
  const hasAny =
    parsed.facebookConnectionIds.length > 0 || parsed.instagram === true;
  if (hasAny && Object.keys(raw ?? {}).length > 0) {
    return parsed;
  }
  const platform = asString(row.platform) as SocialPlatformId;
  const defaults = await resolveDefaultPublishTargetsForPostServer(platform);
  await applyPublishTargetsToPostRowServer(asString(row.id), defaults, platform);
  return defaults;
}

/** Mirror first published / aggregate into legacy columns for backward compatibility. */
export async function syncLegacyFacebookFieldsFromPublicationsServer(
  postId: string
): Promise<void> {
  if (!isSupabaseServiceConfigured()) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  const { data: pubs } = await sb
    .from(PUBLICATIONS_TABLE)
    .select("*")
    .eq("post_id", postId)
    .order("published_at", { ascending: true });

  const published = (pubs ?? []).filter(
    (p) => asString((p as Record<string, unknown>).publish_status) === "published"
  );
  const anyFailed = (pubs ?? []).some(
    (p) => asString((p as Record<string, unknown>).publish_status) === "failed"
  );
  const anyPendingSelected = (pubs ?? []).some((p) => {
    const rec = p as Record<string, unknown>;
    return asString(rec.publish_status) === "pending";
  });

  const firstPublished = published[0] as Record<string, unknown> | undefined;
  let facebookPublishStatus = "pending";
  if (published.length > 0 && !anyPendingSelected && !anyFailed) {
    facebookPublishStatus = "published";
  } else if (published.length > 0 && (anyPendingSelected || anyFailed)) {
    facebookPublishStatus = "pending";
  } else if (anyFailed && published.length === 0) {
    facebookPublishStatus = "failed";
  }

  await sb
    .from(POSTS_TABLE)
    .update({
      facebook_post_id: firstPublished ? asString(firstPublished.facebook_post_id) || null : null,
      facebook_post_url: firstPublished ? asString(firstPublished.facebook_post_url) || null : null,
      published_to_facebook_at: firstPublished ? asString(firstPublished.published_at) || null : null,
      facebook_publish_status: facebookPublishStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

export function decryptPageAccessToken(connectionRow: Record<string, unknown>): string {
  return decryptSecret(asString(connectionRow.encrypted_page_access_token));
}

/** QA / tests — exactly one primary when selectedId is set. */
export function planInstagramPrimaryFlags(
  connectionIds: string[],
  selectedId: string
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of connectionIds) {
    out[id] = id === selectedId;
  }
  return out;
}

export async function setPrimaryInstagramConnectionServer(connectionIdRaw: string): Promise<{
  ok: boolean;
  error: "invalid_input" | "not_found" | "no_instagram_on_page" | "save_failed" | null;
}> {
  const connectionId = connectionIdRaw.trim();
  if (!connectionId) return { ok: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { ok: false, error: "save_failed" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "save_failed" };

  const row = await loadFacebookConnectionRowById(connectionId);
  if (!row || asString(row.connection_status) !== "connected") {
    return { ok: false, error: "not_found" };
  }
  if (!asString(row.instagram_business_account_id).trim()) {
    return { ok: false, error: "no_instagram_on_page" };
  }

  const now = new Date().toISOString();
  const { data: connected } = await sb
    .from(CONNECTION_TABLE)
    .select("id")
    .eq("connection_status", "connected");
  const ids = (connected ?? []).map((r) => asString((r as Record<string, unknown>).id)).filter(Boolean);

  const { error: clearError } = await sb
    .from(CONNECTION_TABLE)
    .update({ is_primary_for_instagram: false, updated_at: now })
    .in("id", ids);
  if (clearError) return { ok: false, error: "save_failed" };

  const { error: setError } = await sb
    .from(CONNECTION_TABLE)
    .update({ is_primary_for_instagram: true, updated_at: now })
    .eq("id", connectionId);
  if (setError) return { ok: false, error: "save_failed" };

  return { ok: true, error: null };
}

export async function updateFacebookConnectionDisplayLabelServer(
  connectionId: string,
  displayLabel: string
): Promise<{ ok: boolean; error: "invalid_input" | "not_found" | "save_failed" | null }> {
  const label = displayLabel.trim();
  if (!label) return { ok: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) return { ok: false, error: "save_failed" };
  const sb = getSupabaseServiceClient();
  if (!sb) return { ok: false, error: "save_failed" };
  const { data, error } = await sb
    .from(CONNECTION_TABLE)
    .update({ display_label: label, updated_at: new Date().toISOString() })
    .eq("id", connectionId.trim())
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "not_found" };
  return { ok: true, error: null };
}
