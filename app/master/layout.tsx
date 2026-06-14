import type { Metadata } from "next";
import MasterSubpageBackBar from "@/components/MasterSubpageBackBar";

export const metadata: Metadata = {
  title: "ניהול פיילוט",
  robots: { index: false, follow: false },
};

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MasterSubpageBackBar />
      {children}
    </>
  );
}
