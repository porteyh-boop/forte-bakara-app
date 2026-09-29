"use client";

import { useState } from "react";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { FacebookPageConnectionDto } from "@/lib/social-marketing/social-facebook-pages-server";
import type { FacebookConnectionStatusDto } from "@/lib/social-marketing/meta-facebook-server";
import {
  disconnectFacebookPage,
  patchFacebookConnection,
} from "@/lib/social-marketing/meta-facebook-api";

function connectionStatusLabel(page: FacebookPageConnectionDto): string {
  if (page.connectionStatus === "token_invalid") return "טוקן לא תקין — התחברו מחדש";
  if (page.connectionStatus === "disconnected") return "מנותק";
  if (page.tokenValid === false) return "טוקן לא תקין — התחברו מחדש";
  if (page.tokenValid === true) return "מחובר ותקין";
  return "מחובר";
}

export function FacebookConnectedPagesManager({
  fbStatus,
  busy,
  onStatusChange,
  onError,
}: {
  fbStatus: FacebookConnectionStatusDto | null;
  busy: boolean;
  onStatusChange: (status: FacebookConnectionStatusDto) => void;
  onError: (message: string | null) => void;
}) {
  const pages = fbStatus?.pages ?? [];
  const [editTarget, setEditTarget] = useState<FacebookPageConnectionDto | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<FacebookPageConnectionDto | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  const working = busy || localBusy;

  function openEdit(page: FacebookPageConnectionDto) {
    setEditTarget(page);
    setEditLabel(page.displayLabel);
    setEditError(null);
  }

  async function saveEditLabel() {
    if (!editTarget || working) return;
    setLocalBusy(true);
    setEditError(null);
    onError(null);
    const result = await patchFacebookConnection(editTarget.id, {
      displayLabel: editLabel.trim(),
    });
    setLocalBusy(false);
    if (result.error || !result.status) {
      setEditError(result.error ?? "שמירת השם נכשלה.");
      return;
    }
    onStatusChange(result.status);
    setEditTarget(null);
  }

  async function confirmDisconnect() {
    if (!disconnectTarget || working) return;
    setLocalBusy(true);
    onError(null);
    const result = await disconnectFacebookPage(disconnectTarget.id);
    setLocalBusy(false);
    if (result.error) {
      onError(result.error);
      setDisconnectTarget(null);
      return;
    }
    setDisconnectTarget(null);
    const { fetchFacebookConnectionStatus } = await import(
      "@/lib/social-marketing/meta-facebook-api"
    );
    const refreshed = await fetchFacebookConnectionStatus();
    if (refreshed.status) onStatusChange(refreshed.status);
    if (refreshed.error) onError(refreshed.error);
  }

  async function setInstagramPrimary(page: FacebookPageConnectionDto) {
    if (working || page.isPrimaryForInstagram) return;
    if (!page.instagramBusinessAccountId) {
      onError("לדף זה אין חשבון Instagram Business מקושר ב-Meta.");
      return;
    }
    setLocalBusy(true);
    onError(null);
    const result = await patchFacebookConnection(page.id, { setPrimaryForInstagram: true });
    setLocalBusy(false);
    if (result.error || !result.status) {
      onError(result.error ?? "עדכון Primary ל-Instagram נכשל.");
      return;
    }
    onStatusChange(result.status);
  }

  if (pages.length === 0) {
    return (
      <p className="text-xs text-forte-text-secondary mt-2">אין דפי Facebook מחוברים.</p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs font-semibold text-forte-text">דפי Facebook מחוברים</p>
      <ul className="space-y-2">
        {pages.map((page) => (
          <li
            key={page.id}
            className="rounded-lg border border-forte-border/70 bg-white/80 px-3 py-2 text-xs space-y-2"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-forte-text">
                  {page.displayLabel}
                  {page.isPrimaryForInstagram ? (
                    <span className="ms-2 text-forte-primary font-normal">· Primary Instagram</span>
                  ) : null}
                </p>
                <p className="text-forte-text-secondary">
                  שם ב-Meta: {page.pageName} · מזהה {page.pageId}
                </p>
                <p className="text-forte-text-secondary">מצב: {connectionStatusLabel(page)}</p>
                {page.instagramBusinessAccountId ? (
                  <p className="text-forte-text-secondary">
                    Instagram: @{page.instagramUsername ?? page.instagramBusinessAccountId}
                  </p>
                ) : (
                  <p className="text-forte-text-secondary">Instagram: לא מקושר לדף זה</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <ForteV2SecondaryButton size="sm" disabled={working} onClick={() => openEdit(page)}>
                  ערוך שם
                </ForteV2SecondaryButton>
                {page.instagramBusinessAccountId ? (
                  <ForteV2SecondaryButton
                    size="sm"
                    disabled={working || page.isPrimaryForInstagram}
                    onClick={() => void setInstagramPrimary(page)}
                  >
                    {page.isPrimaryForInstagram ? "Primary IG" : "הגדר Primary IG"}
                  </ForteV2SecondaryButton>
                ) : null}
                <ForteV2DangerButton
                  disabled={working}
                  onClick={() => setDisconnectTarget(page)}
                >
                  נתק
                </ForteV2DangerButton>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {fbStatus?.instagramConnected ? (
        <p className="text-xs text-forte-text-secondary">
          פרסום Instagram משתמש בדף Primary: @
          {fbStatus.instagramUsername ?? fbStatus.instagramBusinessAccountId}
        </p>
      ) : (
        <p className="text-xs text-forte-text-secondary">
          פרסום Instagram: הגדירו Primary על דף עם Instagram Business מקושר.
        </p>
      )}

      {editTarget ? (
        <ForteV2DialogOverlay onClose={() => !working && setEditTarget(null)}>
          <ForteV2Dialog
            title="עריכת שם תצוגה"
            onClose={() => !working && setEditTarget(null)}
          >
            <div className="space-y-3 text-sm">
              <p className="text-forte-text-secondary text-xs">
                Meta: {editTarget.pageName} (מזהה {editTarget.pageId})
              </p>
              {editError ? <ForteV2StatusBanner tone="error">{editError}</ForteV2StatusBanner> : null}
              <label className="block space-y-1">
                <ForteV2FormLabel>שם במערכת (display_label)</ForteV2FormLabel>
                <ForteV2FormInput
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="לדוגמה: הדף העסקי / דף השמאי"
                />
              </label>
              <div className="flex justify-end gap-2">
                <ForteV2SecondaryButton disabled={working} onClick={() => setEditTarget(null)}>
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2PrimaryButton disabled={working || !editLabel.trim()} onClick={() => void saveEditLabel()}>
                  {working ? "שומר..." : "שמור"}
                </ForteV2PrimaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {disconnectTarget ? (
        <ForteV2DialogOverlay onClose={() => !working && setDisconnectTarget(null)}>
          <ForteV2Dialog title="ניתוק דף Facebook" onClose={() => !working && setDisconnectTarget(null)}>
            <div className="space-y-4 text-sm">
              <p>
                לנתק את <strong>{disconnectTarget.displayLabel}</strong> ({disconnectTarget.pageName})?
              </p>
              <p className="text-forte-text-secondary text-xs">
                פעולה זו מנתקת רק את הדף הזה. דפים אחרים יישארו מחוברים. פוסטים שכבר פורסמו לדף זה לא
                יימחקו.
              </p>
              <div className="flex justify-end gap-2">
                <ForteV2SecondaryButton disabled={working} onClick={() => setDisconnectTarget(null)}>
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2DangerButton disabled={working} onClick={() => void confirmDisconnect()}>
                  {working ? "מנתק..." : "נתק דף"}
                </ForteV2DangerButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </div>
  );
}
