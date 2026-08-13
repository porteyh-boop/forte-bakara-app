"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppVersion } from "@/components/AppVersionProvider";
import {
  BRAND_APP,
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  BRAND_FORTE,
} from "@/lib/brand";
import { isClientAccessPath } from "@/lib/client-access";
import { isMasterUiV2Enabled } from "@/lib/master-ui-v2";
import { VERSION_DISPLAY_LABEL } from "@/lib/app-version-messages";

function AppFooterInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { displayVersion } = useAppVersion();
  if (isClientAccessPath(pathname)) return null;
  if (pathname === "/master" && isMasterUiV2Enabled(searchParams)) return null;
  if (pathname.startsWith("/master/project-v2")) return null;

  return (
    <footer className="print:hidden max-w-lg mx-auto px-5 py-6 pb-28 text-center">
      <p className="text-xs font-bold text-navy">{BRAND_EDITOR_NAME}</p>
      <p className="text-[11px] text-gray-text mt-0.5">{BRAND_EDITOR_TITLE}</p>
      <p className="text-[10px] text-gold font-semibold tracking-widest mt-2">
        {BRAND_FORTE}
      </p>
      <p className="text-[10px] text-gray-text mt-1">{BRAND_APP}</p>
      <p className="text-[10px] text-gray-text/80 mt-2">
        {VERSION_DISPLAY_LABEL} {displayVersion}
      </p>
    </footer>
  );
}

export default function AppFooter() {
  return (
    <Suspense fallback={null}>
      <AppFooterInner />
    </Suspense>
  );
}
