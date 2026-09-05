import type { Metadata } from "next";
import MasterSubpageBackBar from "@/components/MasterSubpageBackBar";
import MasterManifestBinder from "@/components/master-v2/MasterManifestBinder";
import { BRAND_FORTE } from "@/lib/brand";
import { MASTER_MANIFEST_PATH } from "@/lib/master-manifest";

export const metadata: Metadata = {
  title: BRAND_FORTE,
  robots: { index: false, follow: false },
  manifest: MASTER_MANIFEST_PATH,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: BRAND_FORTE,
  },
};

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MasterManifestBinder />
      <MasterSubpageBackBar />
      {children}
    </>
  );
}
