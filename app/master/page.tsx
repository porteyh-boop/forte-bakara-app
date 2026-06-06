import type { Metadata } from "next";
import MasterPageContent from "@/components/MasterPageContent";

export const metadata: Metadata = {
  title: "ניהול פיילוט",
  robots: { index: false, follow: false },
};

/** מסך ניהול פיילוט פנימי — /master */
export const dynamic = "force-static";

export default function MasterPage() {
  return <MasterPageContent />;
}
