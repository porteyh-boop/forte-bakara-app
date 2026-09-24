import type { SocialPlatformId, SocialMarketingPostDto } from "@/lib/social-marketing/social-marketing-types";

export const NETWORK_PUBLISH_STATUSES = [
  "not_applicable",
  "pending",
  "published",
  "failed",
  "unavailable",
] as const;

export type NetworkPublishStatusId = (typeof NETWORK_PUBLISH_STATUSES)[number];

export const FACEBOOK_PUBLISH_STATUS_LABELS: Record<
  Exclude<NetworkPublishStatusId, "unavailable">,
  string
> = {
  not_applicable: "לא רלוונטי",
  pending: "ממתין לפרסום",
  published: "פורסם",
  failed: "נכשל בפרסום",
};

export const INSTAGRAM_PUBLISH_STATUS_LABELS: Record<NetworkPublishStatusId, string> = {
  not_applicable: "לא רלוונטי",
  pending: "ממתין לפרסום",
  published: "פורסם",
  failed: "נכשל בפרסום",
  unavailable: "טרם נתמך במערכת",
};

export function targetsFacebook(platform: SocialPlatformId): boolean {
  return platform === "facebook" || platform === "both";
}

export function targetsInstagram(platform: SocialPlatformId): boolean {
  return platform === "instagram" || platform === "both";
}

export function normalizeNetworkPublishStatus(
  raw: string | null | undefined
): NetworkPublishStatusId | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if ((NETWORK_PUBLISH_STATUSES as readonly string[]).includes(v)) {
    return v as NetworkPublishStatusId;
  }
  return null;
}

export function resolveFacebookPublishStatusFromRow(row: {
  platform: SocialPlatformId;
  facebookPostId?: string | null;
  facebookPublishStatus?: string | null;
  publishErrorCode?: string | null;
}): NetworkPublishStatusId {
  const explicit = normalizeNetworkPublishStatus(row.facebookPublishStatus);
  if (explicit) return explicit;
  if (!targetsFacebook(row.platform)) return "not_applicable";
  if (row.facebookPostId?.trim()) return "published";
  if (row.publishErrorCode?.trim()) return "failed";
  return "pending";
}

export function resolveInstagramPublishStatusFromRow(row: {
  platform: SocialPlatformId;
  instagramPublishStatus?: string | null;
}): NetworkPublishStatusId {
  const explicit = normalizeNetworkPublishStatus(row.instagramPublishStatus);
  if (explicit) return explicit;
  if (!targetsInstagram(row.platform)) return "not_applicable";
  return "pending";
}

/** Global workflow status after successful Facebook Graph publish. */
export function overallStatusAfterFacebookSuccess(platform: SocialPlatformId): "published" | "ready_to_publish" {
  if (platform === "both") return "ready_to_publish";
  return "published";
}

/** Global workflow status after Facebook publish failure. */
export function overallStatusAfterFacebookFailure(platform: SocialPlatformId): "failed" | "ready_to_publish" {
  if (platform === "both") return "ready_to_publish";
  return "failed";
}

export function isPostFullyPublishedOnAllTargets(post: Pick<
  SocialMarketingPostDto,
  "platform" | "facebookPostId" | "facebookPublishStatus" | "instagramPublishStatus"
>): boolean {
  const fb = resolveFacebookPublishStatusFromRow({
    platform: post.platform,
    facebookPostId: post.facebookPostId,
    facebookPublishStatus: post.facebookPublishStatus ?? null,
  });
  const ig = resolveInstagramPublishStatusFromRow({
    platform: post.platform,
    instagramPublishStatus: post.instagramPublishStatus ?? null,
  });
  if (targetsFacebook(post.platform) && fb !== "published") return false;
  if (targetsInstagram(post.platform) && ig !== "published") return false;
  return true;
}

export function canPublishToFacebookNetwork(post: Pick<
  SocialMarketingPostDto,
  "platform" | "status" | "facebookPostId" | "facebookPublishStatus"
>): boolean {
  if (!targetsFacebook(post.platform)) return false;
  if (post.facebookPostId?.trim()) return false;
  const fbStatus = resolveFacebookPublishStatusFromRow({
    platform: post.platform,
    facebookPostId: post.facebookPostId,
    facebookPublishStatus: post.facebookPublishStatus ?? null,
  });
  if (fbStatus === "published") return false;
  return ["approved", "scheduled", "ready_to_publish", "failed"].includes(post.status);
}

export function formatActualPublishDateTimeHe(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function hebrewPublishErrorMessage(input: {
  publishErrorCode: string | null;
  publishErrorMessage: string | null;
}): string {
  if (input.publishErrorMessage?.trim()) return input.publishErrorMessage.trim().slice(0, 500);
  const code = input.publishErrorCode?.trim();
  if (code === "publish_timeout") return "זמן הפרסום פג — לא אושר שהפוסט עלה.";
  if (code === "meta_api_error") return "פייסבוק דחה את הבקשה או שהחיבור אינו תקין.";
  if (code) return code;
  return "שגיאה לא ידועה";
}

export function mergeSocialPostMetaPayload(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}
