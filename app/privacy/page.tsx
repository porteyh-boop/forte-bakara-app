import type { Metadata } from "next";
import Link from "next/link";
import ForteLegalTermsDocument from "@/components/public/ForteLegalTermsDocument";
import { PUBLIC_SALES_LEAD_FORM_PATH } from "@/lib/sales-lead-public-form";

export const metadata: Metadata = {
  title: "תנאי שימוש ומדיניות פרטיות",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#eef2f7] px-4 py-8" dir="rtl">
      <main className="mx-auto w-full max-w-md space-y-5 md:max-w-3xl">
        <ForteLegalTermsDocument />
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
