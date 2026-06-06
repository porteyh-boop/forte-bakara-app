import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import AppFooter from "@/components/AppFooter";
import BottomNav from "@/components/BottomNav";
import {
  BRAND_APP,
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  BRAND_TAGLINE,
} from "@/lib/brand";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND_APP} – ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND_APP}`,
  },
  description: `${BRAND_EDITOR_NAME} · ${BRAND_EDITOR_TITLE}. מערכת דיגיטלית לוועדי בתים וחברות ניהול לבקרת שירות מעליות בזמן אמת.`,
  authors: [{ name: BRAND_EDITOR_NAME }],
  creator: BRAND_EDITOR_NAME,
  publisher: BRAND_EDITOR_NAME,
  keywords: [
    BRAND_APP,
    BRAND_EDITOR_NAME,
    BRAND_EDITOR_TITLE,
    "בקרת מעליות",
    "שמאות מעליות",
    "ליווי מקצועי מעליות",
  ],
  openGraph: {
    type: "website",
    locale: "he_IL",
    title: `${BRAND_APP} – ${BRAND_TAGLINE}`,
    description: `${BRAND_EDITOR_NAME} · ${BRAND_EDITOR_TITLE}`,
    siteName: BRAND_APP,
  },
  twitter: {
    card: "summary",
    title: `${BRAND_APP} – ${BRAND_TAGLINE}`,
    description: `${BRAND_EDITOR_NAME} · ${BRAND_EDITOR_TITLE}`,
  },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <AppFooter />
        <BottomNav />
      </body>
    </html>
  );
}
