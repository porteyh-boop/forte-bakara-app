import type { Metadata, Viewport } from "next";
import ClientPortalManifestBinder from "@/components/ClientPortalManifestBinder";
import {
  buildClientPortalAppleWebAppTitle,
  buildClientPortalManifestPath,
} from "@/lib/client-portal-manifest";
import { resolveClientPortalManifestLabels } from "@/lib/client-portal-manifest-labels";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d1b3e",
};

interface ClientAccessLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export async function generateMetadata({
  params,
}: Pick<ClientAccessLayoutProps, "params">): Promise<Metadata> {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);
  const labels = await resolveClientPortalManifestLabels(token);

  return {
    title: "פורטל לקוח",
    robots: { index: false, follow: false },
    manifest: buildClientPortalManifestPath(token),
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: buildClientPortalAppleWebAppTitle(labels),
    },
  };
}

export default async function ClientAccessLayout({
  children,
  params,
}: ClientAccessLayoutProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  return (
    <>
      <ClientPortalManifestBinder token={token} />
      {children}
    </>
  );
}
