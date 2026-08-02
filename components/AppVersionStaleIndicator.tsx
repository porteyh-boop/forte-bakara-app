"use client";

import { VERSION_UPDATE_BANNER_TITLE } from "@/lib/app-version-messages";

type AppVersionStaleIndicatorProps = {
  onOpen: () => void;
};

export default function AppVersionStaleIndicator({
  onOpen,
}: AppVersionStaleIndicatorProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed left-4 top-4 z-[55] inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100"
      aria-label={VERSION_UPDATE_BANNER_TITLE}
      title={VERSION_UPDATE_BANNER_TITLE}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden />
      עדכון זמין
    </button>
  );
}
