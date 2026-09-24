"use client";

import type { ReactNode } from "react";
import { ForteV2SecondaryButton } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  FACEBOOK_PUBLISH_STATUS_LABELS,
  formatActualPublishDateTimeHe,
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

export function SocialPostPublishStatusPanel({
  post,
  onRetryFacebook,
  retryDisabled,
}: {
  post: SocialMarketingPostDto;
  onRetryFacebook?: () => void;
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
    instagramPublishStatus: post.instagramPublishStatus,
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
          statusLabel={FACEBOOK_PUBLISH_STATUS_LABELS[fbStatus as keyof typeof FACEBOOK_PUBLISH_STATUS_LABELS]}
          ok={fbOk}
          failed={fbFailed}
        >
          {fbOk ? (
            <>
              <p className="text-forte-text-secondary">
                פורסם בפועל: {formatActualPublishDateTimeHe(post.publishedToFacebookAt)}
              </p>
              {post.facebookPostId ? (
                <p className="text-forte-text-secondary">מזהה פוסט: {post.facebookPostId}</p>
              ) : null}
              {post.facebookPostUrl ? (
                <a
                  className="text-forte-primary underline inline-block"
                  href={post.facebookPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  פתח את הפוסט בפייסבוק
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
                  נסה לפרסם שוב
                </ForteV2SecondaryButton>
              ) : null}
            </>
          ) : null}
        </NetworkLine>
      ) : null}

      {showIg ? (
        <NetworkLine
          network="Instagram"
          statusLabel={INSTAGRAM_PUBLISH_STATUS_LABELS[igStatus]}
          ok={igOk}
          failed={igFailed}
        >
          {igStatus === "pending" ? (
            <p className="text-forte-text-secondary">פרסום Instagram יתווסף בהמשך — טרם פורסם.</p>
          ) : null}
        </NetworkLine>
      ) : null}
    </div>
  );
}
