"use client";

import type { ReactNode } from "react";
import { ForteV2SecondaryButton } from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  FACEBOOK_PUBLICATION_STATUS_LABELS,
  type FacebookPublicationStatusId,
} from "@/lib/social-marketing/social-publish-targets";
import {
  canRetryFacebookPublication,
  formatActualPublishDateTimeHe,
  hebrewInstagramPublishErrorMessage,
  hebrewPublishErrorMessage,
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

function fbPubLabel(status: string): string {
  if ((FACEBOOK_PUBLICATION_STATUS_LABELS as Record<string, string>)[status]) {
    return (FACEBOOK_PUBLICATION_STATUS_LABELS as Record<string, string>)[status];
  }
  return status;
}

export function SocialPostPublishStatusPanel({
  post,
  onRetryFacebookPage,
  onRetryInstagram,
  retryDisabled,
}: {
  post: SocialMarketingPostDto;
  onRetryFacebookPage?: (connectionId: string) => void;
  onRetryInstagram?: () => void;
  retryDisabled?: boolean;
}) {
  const showFb = targetsFacebook(post.platform);
  const showIg = targetsInstagram(post.platform);
  if (!showFb && !showIg) return null;

  const igSelected = post.instagramTargetSelected;
  const igStatus = resolveInstagramPublishStatusFromRow({
    platform: post.platform,
    instagramMediaId: post.instagramMediaId,
    instagramPublishStatus: post.instagramPublishStatus,
    instagramPublishError: post.instagramPublishError,
  });
  const igOk = igStatus === "published";
  const igFailed = igStatus === "failed";

  const pubs = post.facebookPublications ?? [];

  return (
    <div className="mt-2 space-y-2 max-w-xl">
      {showFb
        ? pubs.map((pub) => {
            const status = pub.publishStatus as FacebookPublicationStatusId;
            const ok = status === "published";
            const failed = status === "failed";
            const label = fbPubLabel(status);
            return (
              <NetworkLine
                key={pub.connectionId}
                network={`Facebook – ${pub.displayLabel}`}
                statusLabel={label}
                ok={ok}
                failed={failed}
              >
                {ok ? (
                  <>
                    <p className="text-forte-text-secondary">
                      פורסם בפועל: {formatActualPublishDateTimeHe(pub.publishedAt)}
                    </p>
                    {pub.facebookPostUrl ? (
                      <a
                        className="text-forte-primary underline inline-block"
                        href={pub.facebookPostUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        פתח בפייסבוק
                      </a>
                    ) : null}
                  </>
                ) : failed ? (
                  <>
                    <p className="text-forte-text-secondary">
                      סיבה:{" "}
                      {hebrewPublishErrorMessage({
                        publishErrorCode: pub.publishErrorCode,
                        publishErrorMessage: pub.publishErrorMessage,
                      })}
                    </p>
                    {onRetryFacebookPage &&
                    canRetryFacebookPublication(pub, post) ? (
                      <ForteV2SecondaryButton
                        size="sm"
                        disabled={retryDisabled}
                        onClick={() => onRetryFacebookPage(pub.connectionId)}
                      >
                        נסה שוב ({pub.displayLabel})
                      </ForteV2SecondaryButton>
                    ) : null}
                  </>
                ) : null}
              </NetworkLine>
            );
          })
        : null}

      {showIg ? (
        <NetworkLine
          network="Instagram"
          statusLabel={
            !igSelected
              ? "לא נבחר"
              : igOk
                ? "פורסם"
                : igFailed
                  ? "נכשל"
                  : igStatus === "pending"
                    ? "ממתין לפרסום"
                    : "ממתין לפרסום"
          }
          ok={igOk}
          failed={igFailed && igSelected}
        >
          {!igSelected ? (
            <p className="text-forte-text-secondary">לא נבחר לפרסום בפוסט זה.</p>
          ) : null}
          {igSelected && !post.imageUrl?.trim() && !igOk ? (
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
          ) : igFailed && igSelected ? (
            <>
              <p className="text-forte-text-secondary">
                סיבה:{" "}
                {hebrewInstagramPublishErrorMessage({
                  instagramPublishError: post.instagramPublishError,
                })}
              </p>
              {onRetryInstagram ? (
                <ForteV2SecondaryButton
                  size="sm"
                  disabled={retryDisabled}
                  onClick={onRetryInstagram}
                >
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
