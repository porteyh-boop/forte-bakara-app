import type { Metadata, Viewport } from "next";
import { BRAND_APP } from "@/lib/brand";

export const metadata: Metadata = {
  title: "פורטל לקוח",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_APP,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d1b3e",
};

export default function ClientAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
