import type { Metadata } from "next";
import FeedbackPageContent from "@/components/FeedbackPageContent";

export const metadata: Metadata = {
  title: "שלח משוב",
};

export default function FeedbackPage() {
  return <FeedbackPageContent />;
}
