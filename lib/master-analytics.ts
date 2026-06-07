import type { PilotCloudFault } from "./pilot-cloud";

export type HealthLevel = "green" | "yellow" | "red";
export type RiskLevel = "נמוכה" | "בינונית" | "גבוהה";

export interface MasterAnalyticsScope {
  buildingId: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface BuildingKpis {
  totalFaults: number;
  openFaults: number;
  closedFaults: number;
  topElevatorByFaults: string | null;
  mostCommonFaultType: string | null;
  doorFaultCount: number;
  recurringPatternCount: number;
}

export interface BuildingHealthScore {
  score: number;
  level: HealthLevel;
}

export interface RecurringFault {
  buildingId: string;
  buildingName: string;
  elevatorId: string;
  elevatorName: string;
  faultType: string;
  occurrences: number;
  riskLevel: RiskLevel;
}

export interface ClientReportDraft {
  title: string;
  buildingLabel: string;
  periodLabel: string;
  executiveSummary: string;
  keyFindings: string[];
  recurringSection: string;
  conclusions: string[];
  recommendations: string[];
  fullText: string;
}

const OPEN_STATUSES = new Set(["פתוחה", "בטיפול", "מושבתת"]);
const DOOR_FAULT_MARKERS = ["דלת"];

function isOpenFault(fault: PilotCloudFault): boolean {
  return OPEN_STATUSES.has(fault.status);
}

function isDoorFault(faultType: string): boolean {
  return DOOR_FAULT_MARKERS.some((m) => faultType.includes(m));
}

export function filterFaultsForScope(
  faults: PilotCloudFault[],
  scope: MasterAnalyticsScope
): PilotCloudFault[] {
  return faults.filter((f) => {
    if (scope.buildingId !== "all" && f.building_id !== scope.buildingId) {
      return false;
    }
    const d = new Date(f.created_at);
    if (scope.dateFrom && d < new Date(`${scope.dateFrom}T00:00:00`)) {
      return false;
    }
    if (scope.dateTo && d > new Date(`${scope.dateTo}T23:59:59`)) {
      return false;
    }
    return true;
  });
}

function countByKey<T extends string>(
  items: T[]
): { key: T; count: number } | null {
  if (items.length === 0) return null;
  const map = new Map<T, number>();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  let best: { key: T; count: number } | null = null;
  for (const [key, count] of map) {
    if (!best || count > best.count) best = { key, count };
  }
  return best;
}

export function detectRecurringFaults(
  faults: PilotCloudFault[]
): RecurringFault[] {
  const groups = new Map<
    string,
    {
      buildingId: string;
      buildingName: string;
      elevatorId: string;
      elevatorName: string;
      faultType: string;
      count: number;
    }
  >();

  for (const f of faults) {
    const key = `${f.building_id}|${f.elevator_id}|${f.fault_type}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, {
        buildingId: f.building_id,
        buildingName: f.building_name,
        elevatorId: f.elevator_id,
        elevatorName: f.elevator_name,
        faultType: f.fault_type,
        count: 1,
      });
    }
  }

  return Array.from(groups.values())
    .filter((g) => g.count >= 3)
    .map((g) => ({
      buildingId: g.buildingId,
      buildingName: g.buildingName,
      elevatorId: g.elevatorId,
      elevatorName: g.elevatorName,
      faultType: g.faultType,
      occurrences: g.count,
      riskLevel: (g.count >= 5 ? "גבוהה" : "בינונית") as RiskLevel,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}

export function calculateBuildingKpis(faults: PilotCloudFault[]): BuildingKpis {
  const openFaults = faults.filter(isOpenFault);
  const closedFaults = faults.filter((f) => f.status === "סגורה");
  const recurring = detectRecurringFaults(faults);

  const topElevator = countByKey(faults.map((f) => f.elevator_name));
  const topType = countByKey(faults.map((f) => f.fault_type));

  return {
    totalFaults: faults.length,
    openFaults: openFaults.length,
    closedFaults: closedFaults.length,
    topElevatorByFaults: topElevator?.key ?? null,
    mostCommonFaultType: topType?.key ?? null,
    doorFaultCount: faults.filter((f) => isDoorFault(f.fault_type)).length,
    recurringPatternCount: recurring.length,
  };
}

export function calculateBuildingHealthScore(
  faults: PilotCloudFault[],
  recurring: RecurringFault[]
): BuildingHealthScore {
  let score = 100;

  const openCount = faults.filter(isOpenFault).length;
  score -= openCount * 5;

  score -= recurring.length * 3;

  const hasDisabledElevator = faults.some(
    (f) => f.is_disabled && isOpenFault(f)
  );
  if (hasDisabledElevator) score -= 10;

  const typeCounts = new Map<string, number>();
  for (const f of faults) {
    typeCounts.set(f.fault_type, (typeCounts.get(f.fault_type) ?? 0) + 1);
  }
  const hasDominantType = Array.from(typeCounts.values()).some((c) => c >= 5);
  if (hasDominantType) score -= 5;

  const clamped = Math.max(0, score);
  let level: HealthLevel = "red";
  if (clamped >= 80) level = "green";
  else if (clamped >= 60) level = "yellow";

  return { score: clamped, level };
}

export function getHealthLevelClasses(level: HealthLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case "green":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
      };
    case "yellow":
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        border: "border-amber-200",
      };
    default:
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
      };
  }
}

export function generateProfessionalInsights(
  faults: PilotCloudFault[],
  kpis: BuildingKpis,
  recurring: RecurringFault[]
): string[] {
  const insights: string[] = [];

  if (recurring.length >= 3) {
    insights.push("זוהו תקלות חוזרות המחייבות מעקב מקצועי.");
  }

  if (kpis.doorFaultCount >= 5) {
    insights.push("קיים ריבוי תקלות דלת, מומלץ לבחון את מערכת הדלתות.");
  }

  if (kpis.openFaults >= 3) {
    insights.push("קיימות תקלות פתוחות המחייבות מעקב מול חברת השירות.");
  }

  if (recurring.length === 0) {
    insights.push("לא זוהו בשלב זה דפוסי תקלה חוזרים משמעותיים.");
  }

  if (faults.length === 0) {
    insights.push("לא נרשמו דיווחי תקלות בתקופה הנבחרת.");
  }

  return insights;
}

export function formatAnalyticsPeriodLabel(
  dateFrom?: string,
  dateTo?: string
): string {
  if (dateFrom && dateTo) return `${dateFrom} עד ${dateTo}`;
  if (dateFrom) return `מ-${dateFrom}`;
  if (dateTo) return `עד ${dateTo}`;
  return "כל התקופה";
}

export function generateClientReportDraft(params: {
  buildingLabel: string;
  periodLabel: string;
  kpis: BuildingKpis;
  health: BuildingHealthScore;
  recurring: RecurringFault[];
  insights: string[];
}): ClientReportDraft {
  const { buildingLabel, periodLabel, kpis, health, recurring, insights } =
    params;

  const executiveSummary =
    kpis.totalFaults === 0
      ? `בתקופה שנבחרה לא נרשמו דיווחי תקלות עבור ${buildingLabel}.`
      : `בתקופה ${periodLabel} נרשמו ${kpis.totalFaults} תקלות ב-${buildingLabel}, מתוכן ${kpis.openFaults} פתוחות ו-${kpis.closedFaults} סגורות. ציון בריאות הבניין: ${health.score}/100.`;

  const keyFindings: string[] = [];
  if (kpis.topElevatorByFaults) {
    keyFindings.push(
      `המעלית עם מרבית התקלות: ${kpis.topElevatorByFaults}.`
    );
  }
  if (kpis.mostCommonFaultType) {
    keyFindings.push(`סוג התקלה הנפוץ ביותר: ${kpis.mostCommonFaultType}.`);
  }
  if (kpis.doorFaultCount > 0) {
    keyFindings.push(`נרשמו ${kpis.doorFaultCount} תקלות הקשורות לדלתות.`);
  }
  if (keyFindings.length === 0) {
    keyFindings.push("לא נרשמו ממצאים מהותיים בתקופה שנבחרה.");
  }

  const recurringSection =
    recurring.length === 0
      ? "לא זוהו תקלות חוזרות (3 פעמים ומעלה לאותה מעלית וסוג תקלה)."
      : recurring
          .map(
            (r) =>
              `• ${r.buildingName} · ${r.elevatorName} · ${r.faultType} — ${r.occurrences} הופעות (סיכון ${r.riskLevel})`
          )
          .join("\n");

  const conclusions =
    insights.length > 0 ? insights : ["אין מסקנות נוספות לשלב זה."];

  const recommendations: string[] = [];
  if (kpis.openFaults > 0) {
    recommendations.push("לעקוב אחר סגירת התקלות הפתוחות מול חברת השירות.");
  }
  if (recurring.length > 0) {
    recommendations.push("לבצע בדיקה מקצועית למעליות עם תקלות חוזרות.");
  }
  if (kpis.doorFaultCount >= 5) {
    recommendations.push("לבחון מערכת הדלתות והמתקנים הנלווים.");
  }
  if (recommendations.length === 0) {
    recommendations.push("להמשיך מעקב שוטף לפי נהלי הבקרה.");
  }

  const fullText = [
    "דוח בקרת שירות מעליות",
    "========================",
    `בניין: ${buildingLabel}`,
    `תקופה: ${periodLabel}`,
    "",
    "סיכום מנהלים",
    "-------------",
    executiveSummary,
    "",
    "ממצאים עיקריים",
    "---------------",
    ...keyFindings.map((line) => `• ${line}`),
    "",
    "תקלות חוזרות",
    "--------------",
    recurringSection,
    "",
    "מסקנות",
    "--------",
    ...conclusions.map((line) => `• ${line}`),
    "",
    "המלצות ראשוניות",
    "----------------",
    ...recommendations.map((line) => `• ${line}`),
    "",
    "— טיוטה אוטומטית · פורטה בקרה · לשימוש פנימי",
  ].join("\n");

  return {
    title: "דוח בקרת שירות מעליות",
    buildingLabel,
    periodLabel,
    executiveSummary,
    keyFindings,
    recurringSection,
    conclusions,
    recommendations,
    fullText,
  };
}

export function buildMasterAnalytics(faults: PilotCloudFault[], scope: MasterAnalyticsScope) {
  const scoped = filterFaultsForScope(faults, scope);
  const recurring = detectRecurringFaults(scoped);
  const kpis = calculateBuildingKpis(scoped);
  const health = calculateBuildingHealthScore(scoped, recurring);
  const insights = generateProfessionalInsights(scoped, kpis, recurring);

  return { scopedFaults: scoped, kpis, health, recurring, insights };
}
