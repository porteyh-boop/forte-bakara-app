"use client";

import Link from "next/link";
import type { InspectorFollowUpLetterAlert } from "@/lib/inspector-follow-up-letters";
import { buildMasterProjectV2LetterPrefillPath } from "@/lib/master-project-v2-routes";

interface InspectorFollowUpAlertBannerProps {
  buildingId: string;
  alert: InspectorFollowUpLetterAlert;
  compact?: boolean;
  /** When set, closes popup first then navigates — used inside entry dialog only */
  onPrepareClick?: (letterPath: string) => void;
}

export default function InspectorFollowUpAlertBanner({
  buildingId,
  alert,
  compact = false,
  onPrepareClick,
}: InspectorFollowUpAlertBannerProps) {
  const documentId = alert.report.document_id ?? alert.report.id;
  const letterPath = buildMasterProjectV2LetterPrefillPath({
    buildingId,
    inspectorDocId: documentId,
    letterStage: alert.stage,
  });

  return (
    <div
      className={`rounded-md border p-3 space-y-2 ${
        alert.urgent
          ? "border-red-300 bg-red-50"
          : "border-amber-300 bg-amber-50"
      }`}
    >
      <p
        className={`text-sm font-bold ${
          alert.urgent ? "text-red-900" : "text-amber-950"
        }`}
      >
        {alert.title}
      </p>
      <p
        className={`text-xs ${
          alert.urgent ? "text-red-800/90" : "text-amber-900/90"
        }`}
      >
        {alert.subtitle}
      </p>
      {!compact && (
        <>
          <p className="text-[11px] text-forte-text/80">
            מועד אחרון לטיפול: {alert.deadlineLabel}
          </p>
          <p className="text-[11px] font-semibold text-forte-text/90">
            {alert.daysRemainingLabel}
          </p>
        </>
      )}
      {onPrepareClick ? (
        <button
          type="button"
          onClick={() => onPrepareClick(letterPath)}
          className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            alert.urgent
              ? "bg-red-700 hover:bg-red-800"
              : "bg-forte-primary hover:bg-forte-primary-hover"
          }`}
        >
          {alert.prepareButtonLabel}
        </button>
      ) : (
        <Link
          href={letterPath}
          className={`inline-flex rounded-md px-3 py-1.5 text-xs font-semibold text-white ${
            alert.urgent
              ? "bg-red-700 hover:bg-red-800"
              : "bg-forte-primary hover:bg-forte-primary-hover"
          }`}
        >
          {alert.prepareButtonLabel}
        </Link>
      )}
    </div>
  );
}
