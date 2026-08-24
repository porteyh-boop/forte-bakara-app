"use client";

import { useEffect, useMemo, useState } from "react";
import ElevatorChart from "@/components/statistics/ElevatorChart";
import FaultTypeChart from "@/components/statistics/FaultTypeChart";
import MonthlyChart from "@/components/statistics/MonthlyChart";
import PeriodFilter from "@/components/statistics/PeriodFilter";
import {
  buildStatisticsSnapshot,
  fetchStatisticsFaultRows,
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
  /** Hide the building name line (embedded dashboard sections). */
  showBuildingLabel?: boolean;
  /** Hide the total-faults summary card (charts only). */
  showSummaryCard?: boolean;
}

export default function StatisticsContent({
  buildingId,
  buildingName,
  filterRows,
  loadRows,
  showBuildingLabel = true,
  showSummaryCard = true,
}: StatisticsContentProps) {
  const [period, setPeriod] = useState<StatisticsPeriod>("30d");
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

  const snapshot = useMemo(() => {
    if (!rows) return null;
    return buildStatisticsSnapshot(rows, buildingId, period);
  }, [rows, buildingId, period]);

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

  if (error || !snapshot) {
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

  return (
    <div className="flex flex-col gap-4">
      {showBuildingLabel ? (
        <p className="text-xs text-gray-text">בניין: {buildingName}</p>
      ) : null}
      <PeriodFilter value={period} onChange={setPeriod} />
      {showSummaryCard ? <SummaryCard totalFaults={snapshot.totalFaults} /> : null}
      <MonthlyChart data={snapshot.monthly} />
      <FaultTypeChart data={snapshot.byType} />
      <ElevatorChart data={snapshot.byElevator} />
    </div>
  );
}
