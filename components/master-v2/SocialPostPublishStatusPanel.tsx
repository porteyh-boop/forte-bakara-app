"use client";

import type { ReactNode } from "react";
import { ForteV2SecondaryButton } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  FACEBOOK_PUBLISH_STATUS_LABELS,
  formatActualPublishDateTimeHe,
  hebrewInstagramPublishErrorMessage,
  hebrewPublishErrorMessage,
  INSTAGRAM_PUBLISH_STATUS_LABELS,
  resolveFacebookPublishStatusFromRow,
  resolveInstagramPublishStatusFromRow,
  targetsFacebook,
  targetsInstagram,
} from "@/lib/social-marketing/social-marketing-publish-status";
import type { SocialMarketingPostDto } from "@/lib/social-marketing/social-marketing-types";

function NetworkLine({
  network,
  statusLabel,
  ok,
  failed,
  children,
}: {
  network: string;
  statusLabel: string;
  ok: boolean;
  failed: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-forte-border/70 bg-forte-background/30 px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-forte-text">
        {ok ? "✓" : failed ? "✕" : "○"} {network} — {statusLabel}
      </p>
      {children}
    </div>
  );
}

function networkStatusLabelHe(
  status: ReturnType<typeof resolveFacebookPublishStatusFromRow>,
  network: "facebook" | "instagram"
): string {
  if (status === "pending") return "מוכן לפרסום";
  if (network === "facebook") {
    return FACEBOOK_PUBLISH_STATUS_LABELS[status as keyof typeof FACEBOOK_PUBLISH_STATUS_LABELS];
  }
  return INSTAGRAM_PUBLISH_STATUS_LABELS[status];
}

export function SocialPostPublishStatusPanel({
  post,
  onRetryFacebook,
  onRetryInstagram,
  retryDisabled,
}: {
  post: SocialMarketingPostDto;
  onRetryFacebook?: () => void;
  onRetryInstagram?: () => void;
  retryDisabled?: boolean;
}) {
  const fbStatus = resolveFacebookPublishStatusFromRow({
    platform: post.platform,
    facebookPostId: post.facebookPostId,
    facebookPublishStatus: post.facebookPublishStatus,
    publishErrorCode: post.publishErrorCode,
  });
  const igStatus = resolveInstagramPublishStatusFromRow({
    platform: post.platform,
    instagramMediaId: post.instagramMediaId,
    instagramPublishStatus: post.instagramPublishStatus,
    instagramPublishError: post.instagramPublishError,
  });

  const showFb = targetsFacebook(post.platform);
  const showIg = targetsInstagram(post.platform);

  if (!showFb && !showIg) return null;

  const fbOk = fbStatus === "published";
  const fbFailed = fbStatus === "failed";
  const igOk = igStatus === "published";
  const igFailed = igStatus === "failed";

  return (
    <div className="mt-2 space-y-2 max-w-xl">
      {showFb ? (
        <NetworkLine
          network="Facebook"
          statusLabel={networkStatusLabelHe(fbStatus, "facebook")}
          ok={fbOk}
          failed={fbFailed}
        >
          {fbOk ? (
            <>
              <p className="text-forte-text-secondary">
                פורסם בפועל: {formatActualPublishDateTimeHe(post.publishedToFacebookAt)}
              </p>
              {post.facebookPostUrl ? (
                <a
                  className="text-forte-primary underline inline-block"
                  href={post.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  פתח בפייסבוק
                </a>
              ) : null}
            </>
          ) : fbFailed ? (
            <>
              <p className="text-forte-text-secondary">
                סיבה:{" "}
                {hebrewPublishErrorMessage({
                  publishErrorCode: post.publishErrorCode,
                  publishErrorMessage: post.publishErrorMessage,
                })}
              </p>
              {onRetryFacebook ? (
                <ForteV2SecondaryButton size="sm" disabled={retryDisabled} onClick={onRetryFacebook}>
                  נסה שוב (פייסבוק)
                </ForteV2SecondaryButton>
              ) : null}
            </>
          ) : null}
        </NetworkLine>
      ) : null}

      {showIg ? (
        <NetworkLine
          network="Instagram"
          statusLabel={networkStatusLabelHe(igStatus, "instagram")}
          ok={igOk}
          failed={igFailed}
        >
          {!post.imageUrl?.trim() && !igOk ? (
            <p className="text-forte-text-secondary">נדרשת תמונה לפרסום באינסטגרם.</p>
          ) : null}
          {igOk ? (
            <>
              <p className="text-forte-text-secondary">
                פורסם בפועל: {formatActualPublishDateTimeHe(post.instagramPublishedAt)}
              </p>
              {post.instagramPermalink ? (
                <a
                  className="text-forte-primary underline inline-block"
                  href={post.instagramPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  פתח באינסטגרם
                </a>
              ) : null}
            </>
          ) : igFailed ? (
            <>
              <p className="text-forte-text-secondary">
                סיבה: {hebrewInstagramPublishErrorMessage({ instagramPublishError: post.instagramPublishError })}
              </p>
              {onRetryInstagram ? (
                <ForteV2SecondaryButton size="sm" disabled={retryDisabled} onClick={onRetryInstagram}>
                  נסה שוב (אינסטגרם)
                </ForteV2SecondaryButton>
              ) : null}
            </>
          ) : null}
        </NetworkLine>
      ) : null}
    </div>
  );
}
