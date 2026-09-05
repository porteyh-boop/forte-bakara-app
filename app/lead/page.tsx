import type { Metadata } from "next";
import PublicSalesLeadForm from "@/components/public/PublicSalesLeadForm";
import { BRAND_APP, BRAND_FORTE } from "@/lib/brand";

export const metadata: Metadata = {
  title: "השארת פרטים",
  robots: { index: false, follow: false },
};

export default function PublicSalesLeadPage() {
  return (
    <div className="min-h-screen bg-[#eef2f7] px-4 py-8">
      <main className="mx-auto w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0d1b3e] text-xl font-black text-white shadow-lg">
            F
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#0d1b3e]">
            {BRAND_FORTE}
          </h1>
          <p className="mt-1 text-sm text-[#5b6b82]">{BRAND_APP}</p>
          <p className="mt-3 text-base font-semibold text-[#0d1b3e]">
            השארת פרטים ליצירת קשר
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#5b6b82]">
            מלאו את הפרטים ונחזור אליכם בהקדם.
          </p>
        </header>
        <PublicSalesLeadForm />
      </main>
    </div>
  );
}
