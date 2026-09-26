export const SOCIAL_PLATFORMS = ["facebook", "instagram", "both"] as const;
export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_POST_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "ready_to_publish",
  "published",
  "failed",
  "rejected",
  "publish_uncertain",
] as const;

export type SocialPostStatusId = (typeof SOCIAL_POST_STATUSES)[number];

export const SOCIAL_POST_STATUS_LABELS: Record<SocialPostStatusId, string> = {
  draft: "טיוטה",
  pending_approval: "ממתין לאישור",
  approved: "אושר",
  scheduled: "מתוזמן",
  ready_to_publish: "מוכן לפרסום",
  published: "פורסם",
  failed: "נכשל",
  rejected: "נדחה",
  publish_uncertain: "פרסום לא וודאי",
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatformId, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  both: "Facebook ו-Instagram",
};

export const SOCIAL_MARKETING_APPROVER = "יהודה";

export type SocialMarketingPostMetaPayload = {
  generatedBy?: string;
  visualPrompt?: string;
  generatedAt?: string;
  imageGenerated?: boolean;
  imageProvider?: string;
  imageModel?: string;
  imageStoragePath?: string;
};

export type SocialMarketingPostDto = {
  id: string;
  topic: string;
  targetAudience: string;
  platform: SocialPlatformId;
  bodyFacebook: string;
  bodyInstagram: string;
  publishDate: string | null;
  publishTime: string | null;
  imageUrl: string | null;
  visualPrompt: string | null;
  generatedBy: string | null;
  status: SocialPostStatusId;
  approvedAt: string | null;
  approvedBy: string | null;
  contentVersion: number;
  approvedContentVersion: number | null;
  facebookPostId: string | null;
  facebookPostUrl: string | null;
  publishedToFacebookAt: string | null;
  publishErrorCode: string | null;
  publishErrorMessage: string | null;
  facebookPublishStatus: string | null;
  instagramPublishStatus: string | null;
  instagramMediaId: string | null;
  instagramPermalink: string | null;
  instagramPublishedAt: string | null;
  instagramPublishError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialMarketingPostInput = {
  topic: string;
  targetAudience: string;
  platform: SocialPlatformId;
  bodyFacebook: string;
  bodyInstagram: string;
  publishDate: string;
  publishTime: string;
  imageUrl: string;
};

export type SocialMarketingPostAction =
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "schedule"
  | "mark_ready_to_publish"
  | "publish_facebook"
  | "publish_instagram"
  | "publish_both"
  | "mark_failed";
