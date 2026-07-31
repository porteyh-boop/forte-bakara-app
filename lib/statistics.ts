import {
  getPilotSupabaseClient,
  isPilotCloudConfigured,
  PILOT_FAULTS_TABLE,
} from "./pilot-cloud";

export type StatisticsPeriod = "30d" | "90d" | "year" | "all";

export interface StatisticsFaultRow {
  created_at: string;
  fault_type: string | null;
  elevator_name: string | null;
}

export interface MonthlyFaultStat {
  month: number;
  monthLabel: string;
  count: number;
}

export interface FaultTypeStat {
  type: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ElevatorFaultStat {
  elevatorName: string;
  count: number;
}

export interface StatisticsSnapshot {
  totalFaults: number;
  monthly: MonthlyFaultStat[];
  byType: FaultTypeStat[];
  byElevator: ElevatorFaultStat[];
  meta: {
    generatedAt: string;
    buildingId: string;
    period: StatisticsPeriod;
  };
}

export const STATISTICS_PERIOD_OPTIONS: ReadonlyArray<{
  value: StatisticsPeriod;
  label: string;
}> = [
  { value: "30d", label: "30 ימים" },
  { value: "90d", label: "90 ימים" },
  { value: "year", label: "השנה" },
  { value: "all", label: "כל התקופה" },
] as const;

const HEBREW_MONTH_LABELS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

/** צבעים קבועים לפי קטגוריות — אין שימוש בצבעים אקראיים */
const FAULT_CATEGORY_COLORS = {
  doors: "#0d1b3e",
  electrical: "#152852",
  rescue: "#8b6914",
  buttons: "#2d5a8e",
  lighting: "#c9a962",
  communication: "#5c6b7a",
  other: "#94a3b8",
  unspecified: "#cbd5e1",
} as const;

const EXACT_FAULT_TYPE_COLORS: Record<string, string> = {
  "דלת לא נסגרת": FAULT_CATEGORY_COLORS.doors,
  "תאורה לא עובדת": FAULT_CATEGORY_COLORS.lighting,
  "כפתורים לא מגיבים": FAULT_CATEGORY_COLORS.buttons,
  "תקועה בין קומות": FAULT_CATEGORY_COLORS.rescue,
  "רעש חריג": FAULT_CATEGORY_COLORS.communication,
  אחר: FAULT_CATEGORY_COLORS.other,
  דלתות: FAULT_CATEGORY_COLORS.doors,
  חשמל: FAULT_CATEGORY_COLORS.electrical,
  חילוץ: FAULT_CATEGORY_COLORS.rescue,
  לחצנים: FAULT_CATEGORY_COLORS.buttons,
  תאורה: FAULT_CATEGORY_COLORS.lighting,
  תקשורת: FAULT_CATEGORY_COLORS.communication,
};

function normalizeFaultTypeLabel(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : "לא צוין";
}

function normalizeElevatorLabel(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : "לא צוין";
}

export function getFaultTypeColor(faultType: string): string {
  const label = normalizeFaultTypeLabel(faultType);
  if (EXACT_FAULT_TYPE_COLORS[label]) {
    return EXACT_FAULT_TYPE_COLORS[label];
  }

  const lower = label.toLowerCase();
  if (/דלת/.test(lower)) return FAULT_CATEGORY_COLORS.doors;
  if (/חשמל|חשמ/.test(lower)) return FAULT_CATEGORY_COLORS.electrical;
  if (/חילוץ|תקוע|כליא/.test(lower)) return FAULT_CATEGORY_COLORS.rescue;
  if (/לחצ|כפתור|פיקוד/.test(lower)) return FAULT_CATEGORY_COLORS.buttons;
  if (/תאור|מנור/.test(lower)) return FAULT_CATEGORY_COLORS.lighting;
  if (/תקשור|רעש|אינטרקום/.test(lower)) return FAULT_CATEGORY_COLORS.communication;
  if (label === "לא צוין") return FAULT_CATEGORY_COLORS.unspecified;
  if (/אחר/.test(lower)) return FAULT_CATEGORY_COLORS.other;

  return FAULT_CATEGORY_COLORS.other;
}

function parseFaultDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPeriodStart(period: StatisticsPeriod, now = new Date()): Date | null {
  switch (period) {
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "90d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case "year": {
      return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    }
    case "all":
      return null;
  }
}

export function filterFaultRowsByPeriod(
  rows: StatisticsFaultRow[],
  period: StatisticsPeriod,
  now = new Date()
): StatisticsFaultRow[] {
  const periodStart = getPeriodStart(period, now);
  if (!periodStart) return rows;

  return rows.filter((row) => {
    const createdAt = parseFaultDate(row.created_at);
    return createdAt !== null && createdAt >= periodStart;
  });
}

function buildMonthlyStats(rows: StatisticsFaultRow[]): MonthlyFaultStat[] {
  const counts = Array.from({ length: 12 }, () => 0);

  for (const row of rows) {
    const createdAt = parseFaultDate(row.created_at);
    if (!createdAt) continue;
    counts[createdAt.getMonth()] += 1;
  }

  return HEBREW_MONTH_LABELS.map((monthLabel, index) => ({
    month: index + 1,
    monthLabel,
    count: counts[index] ?? 0,
  }));
}

function buildFaultTypeStats(rows: StatisticsFaultRow[]): FaultTypeStat[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const label = normalizeFaultTypeLabel(row.fault_type);
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }

  const totalFaults = rows.length;
  const stats = Array.from(totals.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalFaults > 0 ? Math.round((count / totalFaults) * 1000) / 10 : 0,
      color: getFaultTypeColor(type),
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, "he"));

  return stats;
}

function buildElevatorStats(rows: StatisticsFaultRow[]): ElevatorFaultStat[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const label = normalizeElevatorLabel(row.elevator_name);
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }

  return Array.from(totals.entries())
    .map(([elevatorName, count]) => ({ elevatorName, count }))
    .sort((a, b) => b.count - a.count || a.elevatorName.localeCompare(b.elevatorName, "he"));
}

export function buildStatisticsSnapshot(
  rows: StatisticsFaultRow[],
  buildingId: string,
  period: StatisticsPeriod,
  now = new Date()
): StatisticsSnapshot {
  const filtered = filterFaultRowsByPeriod(rows, period, now);

  return {
    totalFaults: filtered.length,
    monthly: buildMonthlyStats(filtered),
    byType: buildFaultTypeStats(filtered),
    byElevator: buildElevatorStats(filtered),
    meta: {
      generatedAt: now.toISOString(),
      buildingId,
      period,
    },
  };
}

export type StatisticsFetchFailureReason =
  | "not_configured"
  | "missing_building"
  | "fetch_failed";

export type StatisticsFetchResult =
  | { ok: true; rows: StatisticsFaultRow[] }
  | { ok: false; reason: StatisticsFetchFailureReason };

export type BuildingStatisticsResult =
  | { ok: true; snapshot: StatisticsSnapshot }
  | { ok: false; reason: StatisticsFetchFailureReason };

/** שאילתה אחת ל-Supabase — שליפת כל התקלות של הבניין */
export async function fetchStatisticsFaultRows(
  buildingId: string
): Promise<StatisticsFetchResult> {
  if (!isPilotCloudConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  const trimmedBuildingId = buildingId.trim();
  if (!trimmedBuildingId) {
    return { ok: false, reason: "missing_building" };
  }

  const client = getPilotSupabaseClient();
  if (!client) {
    return { ok: false, reason: "not_configured" };
  }

  const { data, error } = await client
    .from(PILOT_FAULTS_TABLE)
    .select("created_at, fault_type, elevator_name")
    .eq("building_id", trimmedBuildingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[statistics] fetchStatisticsFaultRows failed:", error.message);
    return { ok: false, reason: "fetch_failed" };
  }

  return { ok: true, rows: (data ?? []) as StatisticsFaultRow[] };
}

export async function fetchBuildingStatistics(
  buildingId: string,
  period: StatisticsPeriod
): Promise<BuildingStatisticsResult> {
  const fetchResult = await fetchStatisticsFaultRows(buildingId);
  if (!fetchResult.ok) {
    return fetchResult;
  }

  return {
    ok: true,
    snapshot: buildStatisticsSnapshot(fetchResult.rows, buildingId, period),
  };
}
