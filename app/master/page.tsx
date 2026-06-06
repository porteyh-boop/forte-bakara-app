import type { Metadata } from "next";
import MasterPageContent from "@/components/MasterPageContent";

export const metadata: Metadata = {
  title: "ניהול פיילוט",
  robots: { index: false, follow: false },
};

export default function MasterPage() {
  return <MasterPageContent />;
}
