"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const backButtonClass =
  "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100";

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 shrink-0"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

export default function ForteSubpageBackBar() {
  const pathname = usePathname();

  if (!pathname.startsWith("/forte/building/")) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 bg-gray-light/95 backdrop-blur border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 py-3">
        <Link href="/master?tab=buildings" className={backButtonClass}>
          <BackIcon />
          חזרה למאסטר
        </Link>
      </div>
    </div>
  );
}
