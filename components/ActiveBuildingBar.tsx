"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClientAccessPath } from "@/lib/client-access";
import { useBuilding } from "./BuildingProvider";

export default function ActiveBuildingBar() {
  const pathname = usePathname();
  const { ctx, isReady } = useBuilding();

  if (
    !isReady ||
    pathname === "/buildings" ||
    isClientAccessPath(pathname) ||
    pathname.startsWith("/master") ||
    pathname.startsWith("/forte")
  ) {
    return null;
  }

  return (
    <Link
      href="/buildings"
      className="sticky top-0 z-40 block bg-navy text-white border-b border-gold/30 shadow-sm transition-colors hover:bg-navy/95 active:bg-navy/90"
      aria-label={`בניין פעיל: ${ctx.building.name}. לחצו להחלפת בניין`}
    >
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3 min-h-[48px]">
        <div className="min-w-0 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold shrink-0 animate-pulse" />
          <p className="text-sm truncate">
            <span className="text-white/70">בניין פעיל: </span>
            <span className="font-semibold text-gold-light">
              {ctx.building.name}
            </span>
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-gold flex items-center gap-1 whitespace-nowrap">
          החלף בניין
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-3.5 h-3.5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
