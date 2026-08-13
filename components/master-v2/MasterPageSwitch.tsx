"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MasterPageContent from "@/components/MasterPageContent";
import MasterPageContentV2 from "@/components/master-v2/MasterPageContentV2";
import { isMasterUiV2Enabled } from "@/lib/master-ui-v2";

function MasterPageSwitchInner() {
  const searchParams = useSearchParams();
  const useV2 = isMasterUiV2Enabled(searchParams);

  if (useV2) {
    return <MasterPageContentV2 />;
  }

  return <MasterPageContent />;
}

export default function MasterPageSwitch() {
  return (
    <Suspense fallback={<MasterPageContent />}>
      <MasterPageSwitchInner />
    </Suspense>
  );
}
