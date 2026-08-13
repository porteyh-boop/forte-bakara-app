"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import InspectorFollowUpAlertBanner from "@/components/master-v2/project-v2/InspectorFollowUpAlertBanner";
import {
  listAllDocumentInspectorNotifications,
} from "@/lib/document-inspector-notifications";
import {
  computeInspectorFollowUpAlerts,
  dismissInspectorFollowUpPopup,
  isInspectorFollowUpPopupDismissed,
  type InspectorFollowUpLetterAlert,
} from "@/lib/inspector-follow-up-letters";
import { buildPreparedStagesByReportTrackingId } from "@/lib/inspector-follow-up-prepared-stages";
import { getAllDocuments } from "@/lib/document-center";
import {
  getAllInspectorReports,
  isInspectorReportTrackingConfigured,
} from "@/lib/inspector-report-tracking";
import { getAllCloudElevators } from "@/lib/buildings-cloud";

interface MasterProjectV2InspectorFollowUpPopupProps {
  buildingId: string;
}

function elevatorLabelForReport(
  elevatorId: string | null,
  elevatorNameById: Map<string, string>
): string {
  if (!elevatorId) return "כל הבניין";
  return elevatorNameById.get(elevatorId) ?? elevatorId;
}

export default function MasterProjectV2InspectorFollowUpPopup({
  buildingId,
}: MasterProjectV2InspectorFollowUpPopupProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [alerts, setAlerts] = useState<InspectorFollowUpLetterAlert[]>([]);
  const [visibleAlert, setVisibleAlert] = useState<InspectorFollowUpLetterAlert | null>(
    null
  );

  const isInspectorLetterPreparation = useMemo(() => {
    const tab = searchParams.get("tab");
    const inspectorDocId = searchParams.get("inspectorDocId")?.trim() ?? "";
    const letterStage = searchParams.get("letterStage")?.trim() ?? "";
    return tab === "letters" && Boolean(inspectorDocId) && Boolean(letterStage);
  }, [searchParams]);

  useEffect(() => {
    if (isInspectorLetterPreparation) {
      setAlerts([]);
      setVisibleAlert(null);
      return;
    }

    if (!buildingId || !isInspectorReportTrackingConfigured()) {
      setAlerts([]);
      setVisibleAlert(null);
      return;
    }

    let cancelled = false;

    void Promise.all([
      getAllInspectorReports(),
      listAllDocumentInspectorNotifications(),
      getAllCloudElevators(),
      getAllDocuments(),
    ]).then(([reports, notifications, elevators, documentsResult]) => {
      if (cancelled) return;

      const elevatorNameById = new Map<string, string>();
      for (const elevator of elevators) {
        if (elevator.building_id === buildingId) {
          elevatorNameById.set(elevator.elevator_id, elevator.elevator_name);
        }
      }

      const buildingReports = reports.filter(
        (report) => report.building_id === buildingId
      );
      const preparedByDocumentId = buildPreparedStagesByReportTrackingId({
        notifications,
        savedLetters: documentsResult.documents,
      });
      const elevatorLabelByReportId: Record<string, string> = {};
      for (const report of buildingReports) {
        elevatorLabelByReportId[report.id] = elevatorLabelForReport(
          report.elevator_id,
          elevatorNameById
        );
      }

      const nextAlerts = computeInspectorFollowUpAlerts({
        reports: buildingReports,
        preparedByDocumentId,
        elevatorLabelByReportId,
      });
      setAlerts(nextAlerts);

      const primary = nextAlerts[0] ?? null;
      if (!primary) {
        setVisibleAlert(null);
        return;
      }

      const documentId = primary.report.document_id ?? primary.report.id;
      if (
        isInspectorFollowUpPopupDismissed(buildingId, documentId, primary.stage)
      ) {
        setVisibleAlert(null);
        return;
      }

      setVisibleAlert(primary);
    });

    return () => {
      cancelled = true;
    };
  }, [buildingId, isInspectorLetterPreparation]);

  const popupKey = useMemo(() => {
    if (!visibleAlert) return null;
    const documentId =
      visibleAlert.report.document_id ?? visibleAlert.report.id;
    return `${buildingId}:${documentId}:${visibleAlert.stage}`;
  }, [buildingId, visibleAlert]);

  if (isInspectorLetterPreparation) return null;

  if (!visibleAlert || !popupKey) return null;

  function handleDismiss() {
    if (!visibleAlert) return;
    const documentId =
      visibleAlert.report.document_id ?? visibleAlert.report.id;
    dismissInspectorFollowUpPopup(buildingId, documentId, visibleAlert.stage);
    setVisibleAlert(null);
  }

  function handlePrepareLetter(letterPath: string) {
    if (!visibleAlert) return;
    const documentId =
      visibleAlert.report.document_id ?? visibleAlert.report.id;
    dismissInspectorFollowUpPopup(buildingId, documentId, visibleAlert.stage);
    setVisibleAlert(null);
    router.push(letterPath);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspector-follow-up-popup-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl border border-forte-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2
            id="inspector-follow-up-popup-title"
            className="text-sm font-bold text-forte-text"
          >
            פעולה נדרשת — מעקב הערות בודק
          </h2>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-xs font-semibold text-forte-text-secondary hover:text-forte-text"
          >
            סגור
          </button>
        </div>
        <InspectorFollowUpAlertBanner
          buildingId={buildingId}
          alert={visibleAlert}
          onPrepareClick={handlePrepareLetter}
        />
        <p className="text-[11px] text-forte-text-secondary">
          סגירת החלון אינה מסמנת את המכתב כטופל. ההתראה תישאר בחוצץ בדיקות עד
          הפקת המכתב או סגירת המעקב.
        </p>
        {alerts.length > 1 && (
          <p className="text-[11px] text-amber-800">
            קיימות {alerts.length} פעולות מכתב פתוחות בפרויקט זה.
          </p>
        )}
      </div>
    </div>
  );
}
