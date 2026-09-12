"use client";

import { useEffect, useMemo, useState } from "react";
import ElevatorChart from "@/components/statistics/ElevatorChart";
import FaultTypeChart from "@/components/statistics/FaultTypeChart";
import MonthlyChart from "@/components/statistics/MonthlyChart";
import PeriodFilter from "@/components/statistics/PeriodFilter";
import {
  buildStatisticsSnapshot,
  computeStatisticsPeriodFaultCounts,
  fetchStatisticsFaultRows,
  filterStatisticsRowsByElevatorName,
  type StatisticsFaultRow,
  type StatisticsPeriod,
} from "@/lib/statistics";

function SummaryCard({ totalFaults }: { totalFaults: number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-text">סה&quot;כ תקלות בתקופה</p>
      <p className="text-4xl font-bold text-navy mt-2">{totalFaults}</p>
    </div>
  );
}

function PortalTrialKpiGrid({
  elevatorCount,
  total,
  open,
  closed,
}: {
  elevatorCount: number;
  total: number;
  open: number;
  closed: number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: "מספר מעליות", value: elevatorCount },
        { label: "דיווחים בתקופה", value: total },
        { label: "פתוחים", value: open },
        { label: "סגורים", value: closed },
      ].map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
        >
          <p className="text-xs font-semibold text-gray-text">{item.label}</p>
          <p className="text-2xl font-bold text-navy mt-1">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export interface StatisticsContentProps {
  buildingId: string;
  buildingName: string;
  filterRows?: (rows: StatisticsFaultRow[]) => StatisticsFaultRow[];
  loadRows?: (
    buildingId: string
  ) => Promise<
    | { ok: true; rows: StatisticsFaultRow[] }
    | { ok: false; reason: "not_configured" | "missing_building" | "fetch_failed" }
  >;
  showBuildingLabel?: boolean;
  showSummaryCard?: boolean;
  layout?: "default" | "compact";
  /** Building-level portal: optional elevator name filter (not access lock). */
  elevatorFilterOptions?: string[];
  showElevatorFilter?: boolean;
  elevatorCount?: number;
  portalTrialMode?: boolean;
}

export default function StatisticsContent({
  buildingId,
  buildingName,
  filterRows,
  loadRows,
  showBuildingLabel = true,
  showSummaryCard = true,
  layout = "default",
  elevatorFilterOptions = [],
  showElevatorFilter = false,
  elevatorCount = 0,
  portalTrialMode = false,
}: StatisticsContentProps) {
  const [period, setPeriod] = useState<StatisticsPeriod>("30d");
  const [elevatorFilter, setElevatorFilter] = useState("");
  const [rows, setRows] = useState<StatisticsFaultRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatisticsData() {
      const trimmedBuildingId = buildingId.trim();
      if (!trimmedBuildingId) {
        setRows(null);
        setError("לא נבחר בניין פעיל.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const result = loadRows
        ? await loadRows(trimmedBuildingId)
        : await fetchStatisticsFaultRows(trimmedBuildingId);
      if (cancelled) return;

      if (!result.ok) {
        setRows(null);
        if (result.reason === "not_configured") {
          setError("חיבור לענן לא מוגדר — לא ניתן לטעון סטטיסטיקות.");
        } else if (result.reason === "missing_building") {
          setError("לא נבחר בניין פעיל.");
        } else {
          setError("שגיאה בטעינת נתוני התקלות.");
        }
        setLoading(false);
        return;
      }

      setRows(filterRows ? filterRows(result.rows) : result.rows);
      setLoading(false);
    }

    void fetchStatisticsData();

    return () => {
      cancelled = true;
    };
  }, [buildingId, filterRows, loadRows]);

  const scopedRows = useMemo(() => {
    if (!rows) return null;
    if (!showElevatorFilter || !elevatorFilter.trim()) return rows;
    return filterStatisticsRowsByElevatorName(rows, elevatorFilter);
  }, [rows, showElevatorFilter, elevatorFilter]);

  const snapshot = useMemo(() => {
    if (!scopedRows) return null;
    return buildStatisticsSnapshot(scopedRows, buildingId, period);
  }, [scopedRows, buildingId, period]);

  const periodCounts = useMemo(() => {
    if (!scopedRows) return null;
    return computeStatisticsPeriodFaultCounts(scopedRows, period);
  }, [scopedRows, period]);

  if (loading) {
    return (
      <div className="space-y-4">
        {showBuildingLabel ? (
          <p className="text-xs text-gray-text">בניין: {buildingName}</p>
        ) : null}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-text">טוען סטטיסטיקות...</p>
        </div>
      </div>
    );
  }

  if (error || !snapshot || !periodCounts) {
    return (
      <div className="space-y-4">
        {showBuildingLabel ? (
          <p className="text-xs text-gray-text">בניין: {buildingName}</p>
        ) : null}
        <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
          <p className="text-sm text-red-600">{error ?? "לא ניתן להציג סטטיסטיקות."}</p>
        </div>
      </div>
    );
  }

  const showEmptyTrial =
    portalTrialMode && snapshot.totalFaults === 0 && periodCounts.total === 0;

  return (
    <div className={`flex flex-col ${layout === "compact" ? "gap-3" : "gap-4"}`}>
      {showBuildingLabel ? (
        <p className="text-xs text-gray-text">בניין: {buildingName}</p>
      ) : null}
      {portalTrialMode ? (
        <p className="text-xs text-gray-text leading-relaxed">
          הנתונים מבוססים על דיווחי תקלות שנקלטו בפורטל הניסיון — ללא נתוני הדגמה.
        </p>
      ) : null}
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
        <PeriodFilter value={period} onChange={setPeriod} compact={layout === "compact"} />
        {showElevatorFilter && elevatorFilterOptions.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-text min-w-[10rem]">
            מעלית
            <select
              className="form-input text-sm"
              value={elevatorFilter}
              onChange={(event) => setElevatorFilter(event.target.value)}
            >
              <option value="">כל המעליות</option>
              {elevatorFilterOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {portalTrialMode ? (
        <PortalTrialKpiGrid
          elevatorCount={elevatorCount}
          total={periodCounts.total}
          open={periodCounts.open}
          closed={periodCounts.closed}
        />
      ) : showSummaryCard ? (
        <SummaryCard totalFaults={snapshot.totalFaults} />
      ) : null}
      {showEmptyTrial ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-text">
            אין עדיין דיווחים בתקופה שנבחרה. לאחר דיווח ראשון יופיעו כאן הסיכום והגרפים.
          </p>
        </div>
      ) : (
        <>
          {layout === "compact" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              <MonthlyChart data={snapshot.monthly} compact />
              <FaultTypeChart data={snapshot.byType} compact />
              <ElevatorChart data={snapshot.byElevator} compact />
            </div>
          ) : (
            <>
              <MonthlyChart data={snapshot.monthly} />
              <FaultTypeChart data={snapshot.byType} />
              <ElevatorChart data={snapshot.byElevator} />
            </>
          )}
        </>
      )}
    </div>
  );
}
