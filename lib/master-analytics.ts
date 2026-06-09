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

export interface BuildingReportDetails {
  name: string;
  city: string;
  address: string;
  elevatorCompany: string;
  elevatorCount: number;
}

export interface ElevatorAnalyticsLine {
  elevatorId: string;
  elevatorName: string;
  faultCount: number;
  openFaultCount: number;
  statusLabel: string;
}

export interface FaultTypeSummary {
  faultType: string;
  count: number;
}

export interface BuildingRankingEntry {
  buildingId: string;
  buildingName: string;
  faultCount: number;
  healthScore: number;
  healthLevel: HealthLevel;
}

export interface PortfolioAnalytics {
  buildingCount: number;
  elevatorCount: number;
  totalFaults: number;
  rankings: BuildingRankingEntry[];
  problematicBuildings: BuildingRankingEntry[];
  healthyBuildings: BuildingRankingEntry[];
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

export interface PortfolioReportDraft {
  title: string;
  periodLabel: string;
  summary: PortfolioAnalytics;
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

export function countFaultsByElevator(
  faults: PilotCloudFault[]
): ElevatorAnalyticsLine[] {
  const map = new Map<string, ElevatorAnalyticsLine>();
  for (const f of faults) {
    const existing = map.get(f.elevator_id);
    if (existing) {
      existing.faultCount += 1;
      if (isOpenFault(f)) existing.openFaultCount += 1;
    } else {
      map.set(f.elevator_id, {
        elevatorId: f.elevator_id,
        elevatorName: f.elevator_name,
        faultCount: 1,
        openFaultCount: isOpenFault(f) ? 1 : 0,
        statusLabel: "—",
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.faultCount - a.faultCount);
}

export function summarizeFaultTypes(
  faults: PilotCloudFault[],
  limit = 5
): FaultTypeSummary[] {
  const map = new Map<string, number>();
  for (const f of faults) {
    map.set(f.fault_type, (map.get(f.fault_type) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([faultType, count]) => ({ faultType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function generateAnalyticsAlerts(
  faults: PilotCloudFault[],
  kpis: BuildingKpis,
  health: BuildingHealthScore,
  recurring: RecurringFault[]
): string[] {
  const alerts: string[] = [];

  if (health.level === "red") {
    alerts.push(`ציון בריאות נמוך (${health.score}/100) — נדרש מעקב מיידי.`);
  } else if (health.level === "yellow") {
    alerts.push(`ציון בריאות בינוני (${health.score}/100) — מומלץ מעקב.`);
  }

  if (kpis.openFaults >= 3) {
    alerts.push(`${kpis.openFaults} תקלות פתוחות בבניין.`);
  }

  if (recurring.length > 0) {
    alerts.push(`זוהו ${recurring.length} דפוסי תקלה חוזרים.`);
  }

  if (faults.some((f) => f.is_disabled && isOpenFault(f))) {
    alerts.push("קיימת מעלית מושבתת עם תקלה פתוחה.");
  }

  if (kpis.doorFaultCount >= 5) {
    alerts.push(`ריבוי תקלות דלת (${kpis.doorFaultCount}).`);
  }

  return alerts;
}

export function mergeElevatorStatusFromCatalog(
  lines: ElevatorAnalyticsLine[],
  catalogElevators: { id: string; name: string; status: string }[] = []
): ElevatorAnalyticsLine[] {
  if (catalogElevators.length === 0) return lines;

  const byId = new Map(lines.map((l) => [l.elevatorId, l]));
  const merged: ElevatorAnalyticsLine[] = [];

  for (const e of catalogElevators) {
    const existing = byId.get(e.id);
    merged.push({
      elevatorId: e.id,
      elevatorName: e.name,
      faultCount: existing?.faultCount ?? 0,
      openFaultCount: existing?.openFaultCount ?? 0,
      statusLabel: e.status,
    });
    byId.delete(e.id);
  }

  for (const rest of byId.values()) {
    merged.push(rest);
  }

  return merged.sort((a, b) => b.faultCount - a.faultCount);
}

export function buildPortfolioAnalytics(
  faults: PilotCloudFault[],
  scope: Omit<MasterAnalyticsScope, "buildingId">,
  buildingIds: string[],
  resolveBuildingName: (id: string) => string,
  resolveElevatorCount: (id: string) => number
): PortfolioAnalytics {
  const dateScope: MasterAnalyticsScope = { ...scope, buildingId: "all" };
  const scoped = filterFaultsForScope(faults, dateScope);

  const ids = new Set<string>(buildingIds);
  scoped.forEach((f) => ids.add(f.building_id));

  const rankings: BuildingRankingEntry[] = Array.from(ids).map((buildingId) => {
    const buildingFaults = scoped.filter((f) => f.building_id === buildingId);
    const recurring = detectRecurringFaults(buildingFaults);
    const health = calculateBuildingHealthScore(buildingFaults, recurring);
    return {
      buildingId,
      buildingName: resolveBuildingName(buildingId),
      faultCount: buildingFaults.length,
      healthScore: health.score,
      healthLevel: health.level,
    };
  });

  rankings.sort((a, b) => b.faultCount - a.faultCount);

  const problematicBuildings = rankings.filter(
    (r) =>
      r.healthLevel !== "green" ||
      r.faultCount >= 5 ||
      scoped.some((f) => f.building_id === r.buildingId && isOpenFault(f))
  );

  const healthyBuildings = rankings.filter(
    (r) => r.healthLevel === "green" && r.faultCount <= 2
  );

  const elevatorCount = Array.from(ids).reduce(
    (sum, id) => sum + resolveElevatorCount(id),
    0
  );

  return {
    buildingCount: ids.size,
    elevatorCount,
    totalFaults: scoped.length,
    rankings,
    problematicBuildings,
    healthyBuildings,
  };
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

function formatElevatorStatusSection(lines: ElevatorAnalyticsLine[]): string {
  if (lines.length === 0) {
    return "לא נרשמו מעליות או תקלות בבניין בתקופה שנבחרה.";
  }
  return lines
    .map(
      (e) =>
        `• ${e.elevatorName} — ${e.faultCount} תקלות (${e.openFaultCount} פתוחות) · סטטוס: ${e.statusLabel}`
    )
    .join("\n");
}

function formatFaultsByElevatorSection(lines: ElevatorAnalyticsLine[]): string {
  if (lines.length === 0) {
    return "לא נרשמו תקלות לפי מעלית בתקופה שנבחרה.";
  }
  return lines
    .map(
      (e) =>
        `• ${e.elevatorName}: ${e.faultCount} תקלות (${e.openFaultCount} פתוחות)`
    )
    .join("\n");
}

function formatFaultTypesSection(types: FaultTypeSummary[]): string {
  if (types.length === 0) {
    return "לא נרשמו סוגי תקלות בתקופה שנבחרה.";
  }
  return types.map((t) => `• ${t.faultType}: ${t.count} תקלות`).join("\n");
}

export function generateClientReportDraft(params: {
  buildingLabel: string;
  periodLabel: string;
  kpis: BuildingKpis;
  health: BuildingHealthScore;
  recurring: RecurringFault[];
  insights: string[];
  details?: BuildingReportDetails;
  elevatorLines?: ElevatorAnalyticsLine[];
  faultTypes?: FaultTypeSummary[];
}): ClientReportDraft {
  const {
    buildingLabel,
    periodLabel,
    kpis,
    health,
    recurring,
    insights,
    details,
    elevatorLines = [],
    faultTypes = [],
  } = params;

  const buildingName = details?.name ?? buildingLabel;

  const executiveSummary =
    kpis.totalFaults === 0
      ? `בתקופה שנבחרה לא נרשמו דיווחי תקלות עבור ${buildingName}.`
      : `בתקופה ${periodLabel} נרשמו ${kpis.totalFaults} תקלות ב-${buildingName}, מתוכן ${kpis.openFaults} פתוחות ו-${kpis.closedFaults} סגורות. ציון בריאות הבניין: ${health.score}/100.`;

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

  const elevatorStatusSection = formatElevatorStatusSection(elevatorLines);
  const faultsByElevatorSection = formatFaultsByElevatorSection(elevatorLines);
  const faultTypesSection = formatFaultTypesSection(faultTypes);

  const recurringSection =
    recurring.length === 0
      ? "לא זוהו תקלות חוזרות (3 פעמים ומעלה לאותה מעלית וסוג תקלה)."
      : recurring
          .map(
            (r) =>
              `• ${r.elevatorName} · ${r.faultType} — ${r.occurrences} הופעות (סיכון ${r.riskLevel})`
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

  const detailsBlock = details
    ? [
        "פרטי הבניין",
        "-----------",
        `שם הבניין: ${details.name}`,
        `עיר: ${details.city || "—"}`,
        `כתובת: ${details.address || "—"}`,
        `חברת מעליות: ${details.elevatorCompany || "—"}`,
        `מספר מעליות: ${details.elevatorCount}`,
        "",
      ]
    : [];

  const fullText = [
    "דוח בקרת שירות מעליות",
    buildingName,
    periodLabel,
    "",
    ...detailsBlock,
    "א. סיכום מנהלים",
    "----------------",
    executiveSummary,
    "",
    "ב. מצב המעליות בבניין",
    "----------------------",
    elevatorStatusSection,
    "",
    "ג. ניתוח תקלות לפי מעלית",
    "-------------------------",
    faultsByElevatorSection,
    "",
    "ד. תקלות חוזרות",
    "----------------",
    recurringSection,
    "",
    "ה. סוגי תקלות עיקריים",
    "----------------------",
    faultTypesSection,
    "",
    "ו. הערכת מצב מקצועית",
    "---------------------",
    ...conclusions.map((line) => `• ${line}`),
    "",
    "ז. המלצות",
    "---------",
    ...recommendations.map((line) => `• ${line}`),
    "",
    "— טיוטה אוטומטית · פורטה בקרה · לשימוש פנימי",
  ].join("\n");

  return {
    title: "דוח בקרת שירות מעליות",
    buildingLabel: buildingName,
    periodLabel,
    executiveSummary,
    keyFindings,
    recurringSection,
    conclusions,
    recommendations,
    fullText,
  };
}

export function generatePortfolioReportDraft(params: {
  periodLabel: string;
  portfolio: PortfolioAnalytics;
}): PortfolioReportDraft {
  const { periodLabel, portfolio } = params;

  const rankingSection =
    portfolio.rankings.length === 0
      ? "לא נרשמו בניינים לדירוג."
      : portfolio.rankings
          .map(
            (r, i) =>
              `${i + 1}. ${r.buildingName} — ${r.faultCount} תקלות · ציון ${r.healthScore}/100`
          )
          .join("\n");

  const problematicSection =
    portfolio.problematicBuildings.length === 0
      ? "לא זוהו בניינים בעייתיים בתקופה שנבחרה."
      : portfolio.problematicBuildings
          .map(
            (r) =>
              `• ${r.buildingName} — ${r.faultCount} תקלות · ציון ${r.healthScore}/100`
          )
          .join("\n");

  const healthySection =
    portfolio.healthyBuildings.length === 0
      ? "לא זוהו בניינים במצב תקין מלא בתקופה שנבחרה."
      : portfolio.healthyBuildings
          .map(
            (r) =>
              `• ${r.buildingName} — ${r.faultCount} תקלות · ציון ${r.healthScore}/100`
          )
          .join("\n");

  const fullText = [
    "דוח ניהולי — כל הבניינים",
    periodLabel,
    "",
    "סיכום כללי",
    "-----------",
    `מספר בניינים: ${portfolio.buildingCount}`,
    `מספר מעליות: ${portfolio.elevatorCount}`,
    `מספר תקלות: ${portfolio.totalFaults}`,
    "",
    "דירוג בניינים לפי כמות תקלות",
    "--------------------------------",
    rankingSection,
    "",
    "בניינים בעייתיים",
    "------------------",
    problematicSection,
    "",
    "בניינים תקינים",
    "----------------",
    healthySection,
    "",
    "— טיוטה אוטומטית · פורטה בקרה · לשימוש פנימי",
  ].join("\n");

  return {
    title: "דוח ניהולי — כל הבניינים",
    periodLabel,
    summary: portfolio,
    fullText,
  };
}

export function buildMasterAnalytics(faults: PilotCloudFault[], scope: MasterAnalyticsScope) {
  const scoped = filterFaultsForScope(faults, scope);
  const recurring = detectRecurringFaults(scoped);
  const kpis = calculateBuildingKpis(scoped);
  const health = calculateBuildingHealthScore(scoped, recurring);
  const insights = generateProfessionalInsights(scoped, kpis, recurring);
  const alerts = generateAnalyticsAlerts(scoped, kpis, health, recurring);
  const elevatorLines = countFaultsByElevator(scoped);
  const faultTypes = summarizeFaultTypes(scoped);

  return {
    scopedFaults: scoped,
    kpis,
    health,
    recurring,
    insights,
    alerts,
    elevatorLines,
    faultTypes,
  };
}
