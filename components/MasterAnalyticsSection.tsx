"use client";

import { useMemo, useState } from "react";
import {
  buildMasterAnalytics,
  formatAnalyticsPeriodLabel,
  generateClientReportDraft,
  getHealthLevelClasses,
} from "@/lib/master-analytics";
import type { PilotCloudFault } from "@/lib/pilot-cloud";

interface BuildingOption {
  id: string;
  label: string;
}

interface MasterAnalyticsSectionProps {
  faults: PilotCloudFault[];
  buildingOptions: BuildingOption[];
  buildingFilter: string;
  dateFrom: string;
  dateTo: string;
  cloudReady: boolean;
}

export default function MasterAnalyticsSection({
  faults,
  buildingOptions,
  buildingFilter,
  dateFrom,
  dateTo,
  cloudReady,
}: MasterAnalyticsSectionProps) {
  const [copyDone, setCopyDone] = useState(false);

  const buildingLabel =
    buildingFilter === "all"
      ? "כל הבניינים"
      : (buildingOptions.find((b) => b.id === buildingFilter)?.label ??
        buildingFilter);

  const periodLabel = formatAnalyticsPeriodLabel(
    dateFrom || undefined,
    dateTo || undefined
  );

  const analytics = useMemo(
    () =>
      buildMasterAnalytics(faults, {
        buildingId: buildingFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [faults, buildingFilter, dateFrom, dateTo]
  );

  const report = useMemo(
    () =>
      generateClientReportDraft({
        buildingLabel,
        periodLabel,
        kpis: analytics.kpis,
        health: analytics.health,
        recurring: analytics.recurring,
        insights: analytics.insights,
      }),
    [analytics, buildingLabel, periodLabel]
  );

  const healthStyle = getHealthLevelClasses(analytics.health.level);

  async function handleCopyReport() {
    try {
      await navigator.clipboard.writeText(report.fullText);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    } catch {
      setCopyDone(false);
    }
  }

  if (!cloudReady) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-4">
        <h2 className="text-base font-bold text-navy mb-2">ניתוח מקצועי לבניין</h2>
        <p className="text-sm text-gray-text">
          ניתוח מקצועי זמין לאחר חיבור Supabase וטעינת דיווחים מהענן.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div>
        <h2 className="text-base font-bold text-navy">ניתוח מקצועי לבניין</h2>
        <p className="text-xs text-gray-text mt-1">
          ניתוח פנימי בלבד · {buildingLabel} · {periodLabel}
        </p>
      </div>

      <div
        className={`rounded-xl border p-4 ${healthStyle.bg} ${healthStyle.border}`}
      >
        <p className="text-xs font-semibold text-gray-text">ציון בריאות בניין</p>
        <p className={`text-3xl font-bold mt-1 ${healthStyle.text}`}>
          {analytics.health.score}
          <span className="text-base font-semibold mr-1">/100</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <KpiCard label="סך תקלות" value={analytics.kpis.totalFaults} />
        <KpiCard label="תקלות פתוחות" value={analytics.kpis.openFaults} />
        <KpiCard label="תקלות סגורות" value={analytics.kpis.closedFaults} />
        <KpiCard
          label="מעלית מובילה"
          value={analytics.kpis.topElevatorByFaults ?? "—"}
          small
        />
        <KpiCard
          label="סוג נפוץ"
          value={analytics.kpis.mostCommonFaultType ?? "—"}
          small
        />
        <KpiCard label="תקלות דלת" value={analytics.kpis.doorFaultCount} />
        <KpiCard
          label="דפוסים חוזרים"
          value={analytics.kpis.recurringPatternCount}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-gold mb-2">תקלות חוזרות</p>
        {analytics.recurring.length === 0 ? (
          <p className="text-sm text-gray-text bg-gray-light rounded-xl px-3 py-2">
            לא זוהו תקלות חוזרות (3+ לאותה מעלית וסוג תקלה).
          </p>
        ) : (
          <ul className="space-y-2">
            {analytics.recurring.map((r) => (
              <li
                key={`${r.buildingId}-${r.elevatorId}-${r.faultType}`}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2"
              >
                <p className="font-semibold text-navy">
                  {r.buildingName} · {r.elevatorName}
                </p>
                <p className="text-gray-text text-xs mt-0.5">
                  {r.faultType} · {r.occurrences} הופעות · סיכון {r.riskLevel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gold mb-2">מסקנות אוטומטיות</p>
        <ul className="space-y-1">
          {analytics.insights.map((line) => (
            <li key={line} className="text-sm text-navy/90 leading-relaxed">
              • {line}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-gold">טיוטת דוח ללקוח</p>
          <button
            type="button"
            onClick={() => void handleCopyReport()}
            className="text-xs font-semibold rounded-lg border border-navy text-navy px-3 py-1.5 hover:bg-gray-50"
          >
            {copyDone ? "הועתק!" : "העתק דוח"}
          </button>
        </div>
        <textarea
          readOnly
          value={report.fullText}
          rows={14}
          className="form-input text-sm leading-relaxed font-sans resize-y min-h-[12rem]"
          dir="rtl"
        />
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="bg-gray-light rounded-xl px-3 py-2 border border-gray-200">
      <p className="text-[11px] text-gray-text">{label}</p>
      <p
        className={`font-bold text-navy mt-0.5 ${small ? "text-xs" : "text-lg"}`}
      >
        {value}
      </p>
    </div>
  );
}
