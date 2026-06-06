"use client";

import { useMemo } from "react";
import ExpertPrintReport from "@/components/expert/ExpertPrintReport";
import PrintToolbar from "@/components/expert/PrintToolbar";
import { useBuildingFeedback } from "@/hooks/useBuildingFeedback";
import { useRuntimeBuildingContext } from "@/hooks/useRuntimeBuildingContext";
import { getExpertPdfData } from "@/lib/expert-pdf-data";

export default function ExpertPrintPageContent() {
  const runtimeCtx = useRuntimeBuildingContext();
  const { feedback, ready } = useBuildingFeedback();
  const data = useMemo(
    () => getExpertPdfData(runtimeCtx, ready ? feedback : []),
    [runtimeCtx, feedback, ready]
  );

  return (
    <div className="print-page">
      <PrintToolbar />
      <ExpertPrintReport data={data} />
    </div>
  );
}
