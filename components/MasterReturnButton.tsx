"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isClientAccessPath } from "@/lib/client-access";
import { isMasterAuthenticated } from "@/lib/pilot-cloud";
import { isPublicSalesLeadFormPath } from "@/lib/sales-lead-public-form";

export default function MasterReturnButton() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (
      pathname.startsWith("/master") ||
      isClientAccessPath(pathname) ||
      isPublicSalesLeadFormPath(pathname)
    ) {
      setShow(false);
      return;
    }

    const sync = () => setShow(isMasterAuthenticated());
    sync();

    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [pathname]);

  if (!show) return null;

  return (
    <Link
      href="/master"
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy shadow-sm backdrop-blur-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
      aria-label="חזרה למאסטר"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-3.5 h-3.5 shrink-0"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 19l-7-7m0 0l7-7m-7 7h18"
        />
      </svg>
      חזרה למאסטר
    </Link>
  );
}
