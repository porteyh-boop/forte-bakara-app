import type { Metadata } from "next";
import Link from "next/link";
import { BRAND_APP, BRAND_EDITOR_NAME, BRAND_FORTE } from "@/lib/brand";
import { PUBLIC_SALES_LEAD_FORM_PATH } from "@/lib/sales-lead-public-form";

export const metadata: Metadata = {
  title: "תנאי שימוש ומדיניות פרטיות",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#eef2f7] px-4 py-8">
      <main className="mx-auto w-full max-w-md space-y-5 text-[#0d1b3e]">
        <header className="text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d1b3e] text-xl font-black text-white shadow-lg">
            F
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{BRAND_FORTE}</h1>
          <p className="mt-1 text-sm text-[#5b6b82]">{BRAND_APP}</p>
          <p className="mt-3 text-base font-semibold">
            תנאי שימוש ומדיניות פרטיות
          </p>
        </header>
        <div className="space-y-3 rounded-2xl border border-[#d7deea] bg-white p-5 text-sm leading-relaxed text-[#0d1b3e]">
          <p>
            טופס השארת הפרטים מיועד ליצירת קשר עם {BRAND_EDITOR_NAME} בנוגע
            לפנייה שמילאתם.
          </p>
          <p>
            הפרטים שנמסרים בטופס — לרבות שם, טלפון, מייל ופרטי הבניין — נשמרים
            במערכת {BRAND_APP} כדי לפתוח פנייה במכירות ולחזור אליכם.
          </p>
          <p>
            בלחיצה על «שליחת הפרטים» אתם מאשרים שניצור עמכם קשר בנוגע לפנייה.
            לא נשתמש בפרטים למטרות אחרות, ולא נמסור אותם לצד שלישי שלא לצורך
            הטיפול בפנייה.
          </p>
        </div>
        <Link
          href={PUBLIC_SALES_LEAD_FORM_PATH}
          className="block w-full rounded-xl bg-[#0d1b3e] px-4 py-3.5 text-center text-base font-semibold text-white"
        >
          חזרה לטופס
        </Link>
      </main>
    </div>
  );
}
