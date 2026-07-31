"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ElevatorChart from "@/components/statistics/ElevatorChart";
import FaultTypeChart from "@/components/statistics/FaultTypeChart";
import MonthlyChart from "@/components/statistics/MonthlyChart";
import PeriodFilter from "@/components/statistics/PeriodFilter";
import { useBuilding } from "@/components/BuildingProvider";
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

export default function StatisticsDashboard() {
  const { buildingId, ctx } = useBuilding();
  const [period, setPeriod] = useState<StatisticsPeriod>("30d");
  const [rows, setRows] = useState<StatisticsFaultRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      setLoading(true);
      setError(null);

      const result = await fetchStatisticsFaultRows(buildingId);
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

      setRows(result.rows);
      setLoading(false);
    }

    void loadRows();

    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  const snapshot = useMemo(() => {
    if (!rows) return null;
    return buildStatisticsSnapshot(rows, buildingId, period);
  }, [rows, buildingId, period]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-light">
        <PageHeader
          title="סטטיסטיקות"
          subtitle="טוען נתונים..."
          badge={ctx.building.name}
        />
        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-text">טוען סטטיסטיקות...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="min-h-screen bg-gray-light">
        <PageHeader
          title="סטטיסטיקות"
          subtitle="מגמות ונתונים לבניין הנבחר"
          badge={ctx.building.name}
        />
        <main className="page-content -mt-2">
          <div className="bg-white rounded-2xl border border-red-200 p-6 text-center">
            <p className="text-sm text-red-600">{error ?? "לא ניתן להציג סטטיסטיקות."}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-light">
      <PageHeader
        title="סטטיסטיקות"
        subtitle="מגמות ונתונים לבניין הנבחר"
        badge={ctx.building.name}
      />
      <main className="page-content -mt-2 flex flex-col gap-4">
        <PeriodFilter value={period} onChange={setPeriod} />
        <SummaryCard totalFaults={snapshot.totalFaults} />
        <MonthlyChart data={snapshot.monthly} />
        <FaultTypeChart data={snapshot.byType} />
        <ElevatorChart data={snapshot.byElevator} />
      </main>
    </div>
  );
}
