import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ExpertPrintPageContent from "@/components/ExpertPrintPageContent";
import { BRAND_EDITOR_FULL, BRAND_REPORT_TITLE } from "@/lib/brand";
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

  return <ExpertPrintPageContent />;
}
