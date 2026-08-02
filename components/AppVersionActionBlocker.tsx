"use client";

import {
  VERSION_UPDATE_BLOCK_MESSAGE,
  VERSION_UPDATE_RELOAD_BUTTON,
  VERSION_UPDATE_RELOAD_WARNING,
} from "@/lib/app-version-messages";

type AppVersionActionBlockerProps = {
  onReload: () => void;
  onClose: () => void;
};

export default function AppVersionActionBlocker({
  onReload,
  onClose,
}: AppVersionActionBlockerProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-version-blocker-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-5 shadow-xl">
        <p
          id="app-version-blocker-title"
          className="whitespace-pre-line text-sm font-semibold text-navy"
        >
          {VERSION_UPDATE_BLOCK_MESSAGE}
        </p>
        <p className="mt-2 text-[11px] text-gray-text">{VERSION_UPDATE_RELOAD_WARNING}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onReload} className="btn-primary w-full">
            {VERSION_UPDATE_RELOAD_BUTTON}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-gray-50"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
