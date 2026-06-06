import Link from "next/link";
import { BRAND_REPORT_TITLE } from "@/lib/brand";
import { isExpert } from "@/lib/roles";

export default function ExpertPrintLink() {
  if (!isExpert()) return null;

  return (
    <Link
      href="/expert/print"
      target="_blank"
      rel="noopener noreferrer"
      className="w-full flex items-center justify-center gap-2 bg-navy text-white font-semibold text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-navy/25 hover:shadow-navy/35 transition-all mb-5"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="w-5 h-5 text-gold"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
        />
      </svg>
      הצג {BRAND_REPORT_TITLE} להדפסה
    </Link>
  );
}
