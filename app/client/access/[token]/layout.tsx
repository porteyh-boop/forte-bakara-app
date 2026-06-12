import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "גישת לקוח",
  robots: { index: false, follow: false },
};

export default function ClientAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
