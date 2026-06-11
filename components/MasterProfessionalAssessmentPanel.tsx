"use client";

import {
  generateProfessionalAssessment,
  getOperationalStatusClasses,
  getRiskLevelClasses,
  mapPilotFaultForAssessment,
  type ProfessionalAssessment,
} from "@/lib/professional-assessment";
import type { CloudElevatorRow } from "@/lib/buildings-cloud";
import type { PilotCloudFault } from "@/lib/pilot-cloud";
import { useMemo } from "react";

interface MasterProfessionalAssessmentPanelProps {
  buildingId: string;
  buildingName: string;
  faults: PilotCloudFault[];
  elevators: CloudElevatorRow[];
  liveStartedAt: string | null;
}

function BulletList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gold mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-text">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm text-navy border border-gray-100 rounded-lg px-2 py-1.5"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssessmentMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
      <p className="text-[11px] text-gray-text">{label}</p>
      <p className="font-bold text-navy mt-0.5 text-lg">{value}</p>
    </div>
  );
}

function AssessmentSummary({
  assessment,
}: {
  assessment: ProfessionalAssessment;
}) {
  const statusStyle = getOperationalStatusClasses(assessment.operationalStatus);
  const riskStyle = getRiskLevelClasses(assessment.riskLevel);
  const { metrics } = assessment;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div
          className={`rounded-xl border p-3 ${statusStyle.bg} ${statusStyle.border}`}
        >
          <p className="text-xs font-semibold text-gray-text">מצב תפעולי</p>
          <p className={`text-lg font-bold mt-0.5 ${statusStyle.text}`}>
            {assessment.operationalStatus}
          </p>
        </div>
        <div
          className={`rounded-xl border p-3 ${riskStyle.bg} ${riskStyle.border}`}
        >
          <p className="text-xs font-semibold text-gray-text">רמת סיכון</p>
          <p className={`text-lg font-bold mt-0.5 ${riskStyle.text}`}>
            {assessment.riskLevel}
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gold mb-2">מדדים מרכזיים</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AssessmentMetric
            label="תקלות פתוחות"
            value={metrics.openFaults}
          />
          <AssessmentMetric
            label="תקלות חוזרות"
            value={metrics.recurringFaults}
          />
          <AssessmentMetric label="תקלות דלת" value={metrics.doorFaults} />
          <AssessmentMetric
            label="תקלות פיקוד"
            value={metrics.controlFaults}
          />
          {metrics.availability != null && (
            <AssessmentMetric
              label="זמינות"
              value={`${metrics.availability}%`}
            />
          )}
          <AssessmentMetric
            label='סה"כ תקלות'
            value={metrics.totalFaults}
          />
          <AssessmentMetric
            label="אירועי חילוץ"
            value={metrics.rescueEvents}
          />
          <AssessmentMetric
            label="אירועי השבתה"
            value={metrics.shutdownEvents}
          />
        </div>
      </div>

      <BulletList
        title="ממצאים"
        items={assessment.findings}
        emptyText="אין ממצאים."
      />

      <BulletList
        title="מסקנות מקצועיות"
        items={assessment.conclusions}
        emptyText="אין מסקנות."
      />

      <BulletList
        title="המלצות"
        items={assessment.recommendations}
        emptyText="אין המלצות."
      />
    </div>
  );
}

export default function MasterProfessionalAssessmentPanel({
  buildingId,
  buildingName,
  faults,
  elevators,
  liveStartedAt,
}: MasterProfessionalAssessmentPanelProps) {
  const assessment = useMemo(() => {
    const buildingFaults = faults.filter((f) => f.building_id === buildingId);
    return generateProfessionalAssessment({
      building: { id: buildingId, name: buildingName },
      elevators: elevators.map((e) => ({
        id: e.elevator_id,
        name: e.elevator_name,
        status: e.status,
      })),
      faults: buildingFaults.map(mapPilotFaultForAssessment),
      liveStartedAt,
    });
  }, [buildingId, buildingName, faults, elevators, liveStartedAt]);

  return (
    <div className="bg-white rounded-2xl border border-navy/20 p-4 space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-gold uppercase tracking-wide">
          מומחה בלבד
        </p>
        <h3 className="text-sm font-bold text-navy mt-0.5">
          הערכת מצב מקצועית — {buildingName}
        </h3>
        <p className="text-xs text-gray-text mt-0.5">
          מודיעין מקצועי — לא מוצג ללקוח, ועד או חברת ניהול
        </p>
      </div>

      <AssessmentSummary assessment={assessment} />
    </div>
  );
}
