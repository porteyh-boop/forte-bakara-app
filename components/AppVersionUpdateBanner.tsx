"use client";

import {
  VERSION_UPDATE_BANNER_TEXT,
  VERSION_UPDATE_BANNER_TITLE,
  VERSION_UPDATE_DISMISS_BUTTON,
  VERSION_UPDATE_RELOAD_BUTTON,
  VERSION_UPDATE_RELOAD_WARNING,
} from "@/lib/app-version-messages";

type AppVersionUpdateBannerProps = {
  onReload: () => void;
  onDismiss: () => void;
};

export default function AppVersionUpdateBanner({
  onReload,
  onDismiss,
}: AppVersionUpdateBannerProps) {
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-3 shadow-md"
      role="alertdialog"
      aria-labelledby="app-version-banner-title"
      aria-describedby="app-version-banner-text"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        <div>
          <p
            id="app-version-banner-title"
            className="text-sm font-bold text-amber-950"
          >
            {VERSION_UPDATE_BANNER_TITLE}
          </p>
          <p id="app-version-banner-text" className="mt-1 text-sm text-amber-900/90">
            {VERSION_UPDATE_BANNER_TEXT}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" onClick={onReload} className="btn-primary sm:flex-1">
            {VERSION_UPDATE_RELOAD_BUTTON}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100/60 sm:flex-1"
          >
            {VERSION_UPDATE_DISMISS_BUTTON}
          </button>
        </div>
        <p className="text-[11px] text-amber-900/80">{VERSION_UPDATE_RELOAD_WARNING}</p>
      </div>
    </div>
  );
}
