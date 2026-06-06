"use client";

import { BRAND_REPORT_TITLE } from "@/lib/brand";

export default function PrintToolbar() {
  return (
    <div className="print-toolbar sticky top-0 z-50 bg-navy text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md print:hidden">
      <span className="text-sm font-medium text-gold">{BRAND_REPORT_TITLE} — תצוגה להדפסה</span>
      <button
        type="button"
        onClick={() => window.print()}
        className="bg-gold text-navy font-bold text-sm px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
      >
        הדפס / שמור PDF
      </button>
    </div>
  );
}
