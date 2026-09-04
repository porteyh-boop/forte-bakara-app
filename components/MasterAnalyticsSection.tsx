"use client";

import { useMemo, useState } from "react";
import { getBuildingDataset } from "@/lib/buildings";
import {
  buildMasterAnalytics,
  buildPortfolioAnalytics,
  formatAnalyticsPeriodLabel,
  generateClientReportDraft,
  generatePortfolioReportDraft,
  getHealthLevelClasses,
  mergeElevatorStatusFromCatalog,
} from "@/lib/master-analytics";
import type { PilotCloudFault } from "@/lib/pilot-cloud";

interface BuildingOption {
  id: string;
  label: string;
}

interface MasterAnalyticsSectionProps {
  faults: PilotCloudFault[];
  buildingOptions: BuildingOption[];
  dateFrom: string;
  dateTo: string;
  cloudReady: boolean;
}

export default function MasterAnalyticsSection({
  faults,
  buildingOptions,
  dateFrom,
  dateTo,
  cloudReady,
}: MasterAnalyticsSectionProps) {
  const [analyticsBuildingId, setAnalyticsBuildingId] = useState("all");
  const [copyDone, setCopyDone] = useState(false);

  const periodLabel = formatAnalyticsPeriodLabel(
    dateFrom || undefined,
    dateTo || undefined
  );

  const isPortfolio = analyticsBuildingId === "all";

  const buildingLabel =
    isPortfolio
      ? "כל הבניינים"
      : (buildingOptions.find((b) => b.id === analyticsBuildingId)?.label ??
        analyticsBuildingId);

  const buildingCtx = useMemo(() => {
    if (isPortfolio) return null;
    return getBuildingDataset(analyticsBuildingId);
  }, [analyticsBuildingId, isPortfolio]);

  const analytics = useMemo(
    () =>
      buildMasterAnalytics(faults, {
        buildingId: analyticsBuildingId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [faults, analyticsBuildingId, dateFrom, dateTo]
  );

  const elevatorLines = useMemo(() => {
    if (isPortfolio) return [];
    const catalogElevators =
      buildingCtx?.elevators.map((e) => ({
        id: e.id,
        name: e.name,
        status: e.status,
      })) ?? [];
    return mergeElevatorStatusFromCatalog(
      analytics.elevatorLines,
      catalogElevators
    );
  }, [analytics.elevatorLines, buildingCtx, isPortfolio]);

  const portfolio = useMemo(
    () =>
      buildPortfolioAnalytics(
        faults,
        {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        buildingOptions.map((b) => b.id),
        (id) => getBuildingDataset(id).building.name,
        (id) => getBuildingDataset(id).building.elevatorCount
      ),
    [faults, dateFrom, dateTo, buildingOptions]
  );

  const buildingReport = useMemo(() => {
    if (isPortfolio) return null;
    const b = buildingCtx?.building;
    return generateClientReportDraft({
      buildingLabel,
      periodLabel,
      kpis: analytics.kpis,
      health: analytics.health,
      recurring: analytics.recurring,
      insights: analytics.insights,
      details: b
        ? {
            name: b.name,
            city: b.city,
            address: b.address,
            elevatorCompany: b.elevatorCompany,
            elevatorCount: b.elevatorCount,
          }
        : undefined,
      elevatorLines,
      faultTypes: analytics.faultTypes,
    });
  }, [
    isPortfolio,
    buildingLabel,
    periodLabel,
    analytics,
    buildingCtx,
    elevatorLines,
  ]);

  const portfolioReport = useMemo(
    () =>
      generatePortfolioReportDraft({
        periodLabel,
        portfolio,
      }),
    [periodLabel, portfolio]
  );

  const healthStyle = getHealthLevelClasses(analytics.health.level);

  async function handleCopyBuildingReport() {
    if (!buildingReport) return;
    try {
      await navigator.clipboard.writeText(buildingReport.fullText);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2500);
    } catch {
      setCopyDone(false);
    }
  }

  async function handleCopyPortfolioReport() {
    try {
      await navigator.clipboard.writeText(portfolioReport.fullText);
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
          ניתוח פנימי בלבד · {periodLabel}
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-text block mb-1">
          בניין לניתוח
        </label>
        <select
          value={analyticsBuildingId}
          onChange={(e) => setAnalyticsBuildingId(e.target.value)}
          className="form-input text-sm"
        >
          <option value="all">כל הבניינים</option>
          {buildingOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      {isPortfolio ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <KpiCard label="מספר בניינים" value={portfolio.buildingCount} />
            <KpiCard label="מספר מעליות" value={portfolio.elevatorCount} />
            <KpiCard label="מספר תקלות" value={portfolio.totalFaults} />
          </div>

          <RankingBlock
            title="דירוג בניינים לפי כמות תקלות"
            entries={portfolio.rankings}
          />

          <RankingBlock
            title="בניינים בעייתיים"
            entries={portfolio.problematicBuildings}
            emptyText="לא זוהו בניינים בעייתיים בתקופה שנבחרה."
          />

          <RankingBlock
            title="בניינים תקינים"
            entries={portfolio.healthyBuildings}
            emptyText="לא זוהו בניינים במצב תקין מלא בתקופה שנבחרה."
          />

          <ReportBlock
            title="דוח ניהולי — כל הבניינים"
            copyLabel={copyDone ? "הועתק!" : "העתק דוח ניהולי"}
            onCopy={() => void handleCopyPortfolioReport()}
            text={portfolioReport.fullText}
          />
        </>
      ) : (
        <>
          {buildingCtx && (
            <div className="bg-gray-light rounded-xl border border-gray-200 px-3 py-2 text-sm space-y-0.5">
              <p className="font-semibold text-navy">{buildingCtx.building.name}</p>
              <p className="text-xs text-gray-text">
                {buildingCtx.building.city}
                {buildingCtx.building.address
                  ? ` · ${buildingCtx.building.address}`
                  : ""}
              </p>
              <p className="text-xs text-gray-text">
                {buildingCtx.building.elevatorCompany || "—"} ·{" "}
                {buildingCtx.building.elevatorCount} מעליות
              </p>
            </div>
          )}

          <div
            className={`rounded-xl border p-4 ${healthStyle.bg} ${healthStyle.border}`}
          >
            <p className="text-xs font-semibold text-gray-text">ציון בריאות בניין</p>
            <p className={`text-3xl font-bold mt-1 ${healthStyle.text}`}>
              {analytics.health.score}
              <span className="text-base font-semibold mr-1">/100</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2">
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

          {analytics.alerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-2">התראות</p>
              <ul className="space-y-1">
                {analytics.alerts.map((line) => (
                  <li
                    key={line}
                    className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-xl px-3 py-2"
                  >
                    • {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
                    <p className="font-semibold text-navy">{r.elevatorName}</p>
                    <p className="text-gray-text text-xs mt-0.5">
                      {r.faultType} · {r.occurrences} הופעות · סיכון {r.riskLevel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gold mb-2">
              ניתוח תקלות לפי מעלית
            </p>
            {elevatorLines.length === 0 ? (
              <p className="text-sm text-gray-text bg-gray-light rounded-xl px-3 py-2">
                לא נרשמו תקלות לפי מעלית בתקופה שנבחרה.
              </p>
            ) : (
              <ul className="space-y-1">
                {elevatorLines.map((e) => (
                  <li
                    key={e.elevatorId}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 flex justify-between gap-2"
                  >
                    <span className="font-semibold text-navy">{e.elevatorName}</span>
                    <span className="text-xs text-gray-text">
                      {e.faultCount} תקלות · {e.openFaultCount} פתוחות · {e.statusLabel}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gold mb-2">סוגי תקלות עיקריים</p>
            {analytics.faultTypes.length === 0 ? (
              <p className="text-sm text-gray-text bg-gray-light rounded-xl px-3 py-2">
                לא נרשמו סוגי תקלות בתקופה שנבחרה.
              </p>
            ) : (
              <ul className="space-y-1">
                {analytics.faultTypes.map((t) => (
                  <li
                    key={t.faultType}
                    className="text-sm text-navy/90 leading-relaxed"
                  >
                    • {t.faultType}: {t.count} תקלות
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

          {buildingReport && (
            <ReportBlock
              title={`${buildingReport.title} · ${buildingReport.buildingLabel}`}
              copyLabel={copyDone ? "הועתק!" : "הפק דוח לבניין"}
              onCopy={() => void handleCopyBuildingReport()}
              text={buildingReport.fullText}
            />
          )}
        </>
      )}
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

function RankingBlock({
  title,
  entries,
  emptyText = "אין נתונים.",
}: {
  title: string;
  entries: {
    buildingName: string;
    faultCount: number;
    healthScore: number;
  }[];
  emptyText?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gold mb-2">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-text bg-gray-light rounded-xl px-3 py-2">
          {emptyText}
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((r, i) => (
            <li
              key={`${title}-${r.buildingName}`}
              className="text-sm border border-gray-200 rounded-xl px-3 py-2 flex justify-between gap-2"
            >
              <span className="font-semibold text-navy">
                {i + 1}. {r.buildingName}
              </span>
              <span className="text-xs text-gray-text">
                {r.faultCount} תקלות · {r.healthScore}/100
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportBlock({
  title,
  copyLabel,
  onCopy,
  text,
}: {
  title: string;
  copyLabel: string;
  onCopy: () => void;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-gold">{title}</p>
        <button
          type="button"
          onClick={onCopy}
          className="text-xs font-semibold rounded-lg border border-navy text-navy px-3 py-1.5 hover:bg-gray-50"
        >
          {copyLabel}
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        rows={14}
        className="form-input text-sm leading-relaxed font-sans resize-y min-h-[12rem]"
        dir="rtl"
      />
    </div>
  );
}
