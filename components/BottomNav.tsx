"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isClientAccessPath } from "@/lib/client-access";
import { isExpert } from "@/lib/roles";

const NAV_ICON_CLASS = "w-[23px] h-[23px]";
const FEEDBACK_ICON_CLASS = "w-[25px] h-[25px]";

const baseNavItems = [
  {
    href: "/",
    label: "בית",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "1.8"} className={NAV_ICON_CLASS}>
        {active ? (
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
        )}
      </svg>
    ),
  },
  {
    href: "/history",
    label: "היסטוריה",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} className={NAV_ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/feedback",
    label: "משוב",
    isFeedback: true,
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} className={FEEDBACK_ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-7 6l2.5-3H18a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h1z" />
      </svg>
    ),
  },
  {
    href: "/report",
    label: "דיווח",
    isFab: true,
    icon: (_active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[27px] h-[27px]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    href: "/buildings",
    label: "בניינים",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} className={NAV_ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-16 0H3M9 7h1m-1 4h1m4-4h1m-1 4h1" />
      </svg>
    ),
  },
  {
    href: "/building",
    label: "בניין",
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} className={NAV_ICON_CLASS}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </svg>
    ),
  },
];

const expertNavItem = {
  href: "/expert",
  label: "מסך מומחה",
  icon: (active: boolean) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.2" : "1.8"} className={NAV_ICON_CLASS}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

export default function BottomNav() {
  const pathname = usePathname();
  if (isClientAccessPath(pathname)) return null;
  const showExpert = isExpert();
  const navItems = showExpert
    ? [...baseNavItems, expertNavItem]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="absolute inset-0 bg-white/90 backdrop-blur-lg border-t border-gray-200/80 shadow-[0_-8px_32px_rgba(13,27,62,0.1)]" />
      <div
        className="relative max-w-lg mx-auto flex items-end justify-around px-1 pt-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))] gap-0"
      >
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          if ("isFab" in item && item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center -mt-5 group shrink-0 min-h-[72px] justify-end"
              >
                <span className="w-[3.75rem] h-[3.75rem] rounded-2xl bg-gradient-to-br from-gold to-[#b8944f] text-navy flex items-center justify-center shadow-lg shadow-gold/40 transition-all duration-300 group-hover:scale-105 group-active:scale-95">
                  {item.icon(false)}
                </span>
                <span className="text-[12px] font-semibold text-navy mt-1.5">
                  {item.label}
                </span>
              </Link>
            );
          }

          const isFeedback = "isFeedback" in item && item.isFeedback;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 min-w-0 flex-1 px-1 min-h-[56px] transition-all duration-200 rounded-xl ${
                isFeedback
                  ? "border border-gold/35 bg-gold/5 mx-0.5"
                  : ""
              } ${
                isActive ? "text-navy" : "text-navy/40 hover:text-navy/60"
              }`}
            >
              <span
                className={`transition-transform duration-200 ${
                  isActive ? "scale-110 text-gold" : ""
                } ${item.href === "/expert" && isActive ? "text-red-600" : ""}`}
              >
                {item.icon(isActive)}
              </span>
              <span
                className={`text-[11px] leading-tight text-center ${
                  isFeedback
                    ? "font-bold text-navy/80"
                    : "font-medium"
                } ${
                  isActive ? "text-navy font-semibold" : ""
                } ${item.href === "/expert" ? "text-red-600" : ""}`}
              >
                {item.label}
              </span>
              {isActive && (
                <span
                  className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                    item.href === "/expert" ? "bg-red-600" : "bg-gold"
                  }`}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
