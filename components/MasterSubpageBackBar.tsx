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

function isBuildingContextPath(pathname: string): boolean {
  return (
    pathname.startsWith("/master/building/") ||
    pathname.startsWith("/master/elevator/")
  );
}

export default function MasterSubpageBackBar() {
  const pathname = usePathname();

  if (pathname === "/master" || pathname.startsWith("/master/project-v2")) {
    return null;
  }

  const showBuildingsBack = isBuildingContextPath(pathname);

  return (
    <div className="bg-gray-light border-b border-gray-200/80">
      <div className="mx-auto flex w-full max-w-lg flex-wrap gap-2 px-5 py-3 md:max-w-7xl md:px-8">
        <Link
          href="/master"
          className={backButtonClass}
          aria-label="חזרה למאסטר"
        >
          <BackIcon />
          חזרה למאסטר
        </Link>
        {showBuildingsBack && (
          <Link
            href="/master?tab=buildings"
            className={backButtonClass}
            aria-label="חזרה לניהול בניינים"
          >
            <BackIcon />
            חזרה לניהול בניינים
          </Link>
        )}
      </div>
    </div>
  );
}
