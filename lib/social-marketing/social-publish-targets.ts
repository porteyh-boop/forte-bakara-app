import type { SocialPlatformId } from "@/lib/social-marketing/social-marketing-types";
import { targetsFacebook, targetsInstagram } from "@/lib/social-marketing/social-marketing-publish-status";

export type SocialPublishTargets = {
  facebookConnectionIds: string[];
  instagram: boolean;
};

export const FACEBOOK_PUBLICATION_STATUSES = [
  "pending",
  "published",
  "failed",
  "not_selected",
  "skipped",
] as const;

export type FacebookPublicationStatusId = (typeof FACEBOOK_PUBLICATION_STATUSES)[number];

export const FACEBOOK_PUBLICATION_STATUS_LABELS: Record<FacebookPublicationStatusId, string> = {
  pending: "ממתין לפרסום",
  published: "פורסם",
  failed: "נכשל",
  not_selected: "לא נבחר",
  skipped: "דולג",
};

export function normalizePublishTargets(raw: unknown): SocialPublishTargets {
  if (!raw || typeof raw !== "object") {
    return { facebookConnectionIds: [], instagram: false };
  }
  const rec = raw as Record<string, unknown>;
  const idsRaw = rec.facebookConnectionIds ?? rec.facebook_connection_ids;
  const ids: string[] = [];
  if (Array.isArray(idsRaw)) {
    for (const item of idsRaw) {
      const id = typeof item === "string" ? item.trim() : "";
      if (id) ids.push(id);
    }
  }
  return {
    facebookConnectionIds: [...new Set(ids)],
    instagram: rec.instagram === true,
  };
}

export function publishTargetsEqual(a: SocialPublishTargets, b: SocialPublishTargets): boolean {
  if (a.instagram !== b.instagram) return false;
  if (a.facebookConnectionIds.length !== b.facebookConnectionIds.length) return false;
  const setA = new Set(a.facebookConnectionIds);
  return b.facebookConnectionIds.every((id) => setA.has(id));
}

export function publishTargetsToJson(targets: SocialPublishTargets): Record<string, unknown> {
  return {
    facebookConnectionIds: targets.facebookConnectionIds,
    instagram: targets.instagram,
  };
}

export function defaultPublishTargetsForPlatform(input: {
  platform: SocialPlatformId;
  connectedFacebookConnectionIds: string[];
  instagramAvailable: boolean;
}): SocialPublishTargets {
  return {
    facebookConnectionIds: targetsFacebook(input.platform)
      ? [...input.connectedFacebookConnectionIds]
      : [],
    instagram: targetsInstagram(input.platform) && input.instagramAvailable,
  };
}

export function parsePublishTargetsFromBody(raw: Record<string, unknown>): SocialPublishTargets | null {
  if (!("publishTargets" in raw) && !("publish_targets" in raw)) return null;
  const nested = raw.publishTargets ?? raw.publish_targets;
  return normalizePublishTargets(nested);
}
