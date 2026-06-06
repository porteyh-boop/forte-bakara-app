import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ExpertPrintReport from "@/components/expert/ExpertPrintReport";
import PrintToolbar from "@/components/expert/PrintToolbar";
import { BRAND_EDITOR_FULL, BRAND_REPORT_TITLE } from "@/lib/brand";
import { getExpertPdfData } from "@/lib/expert-pdf-data";
import { isExpert } from "@/lib/roles";
import "./print.css";

export const metadata: Metadata = {
  title: BRAND_REPORT_TITLE,
  description: `${BRAND_REPORT_TITLE} · ${BRAND_EDITOR_FULL}`,
  robots: { index: false, follow: false },
};

export default function ExpertPrintPage() {
  if (!isExpert()) {
    redirect("/");
  }

  const data = getExpertPdfData();

  return (
    <div className="print-page">
      <PrintToolbar />
      <ExpertPrintReport data={data} />
    </div>
  );
}
