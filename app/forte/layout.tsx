import type { Metadata } from "next";
import ForteSubpageBackBar from "@/components/forte/ForteSubpageBackBar";

export const metadata: Metadata = {
  title: "FORTE — תיק בניין",
  robots: { index: false, follow: false },
};

export default function ForteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ForteSubpageBackBar />
      {children}
    </>
  );
}
