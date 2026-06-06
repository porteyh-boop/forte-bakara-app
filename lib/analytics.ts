import { isClosedFault, isOpenFault } from "./fault-lifecycle";
import { DEFAULT_BUILDING_ID, getBuildingDataset } from "./buildings";
import { formatHours, safePercent } from "./utils";
import type {
  AnomalyAlert,
  BuildingDataContext,
  DowntimeAnalysis,
  ElevatorAvailability,
  ExpertAnalytics,
  ExpertInsight,
  ExpertMetric,
  Fault,
  FaultType,
  FaultTypeBreakdown,
  InsufficientTreatmentAnalysis,
  ProblematicElevator,
  RecurringElevatorFault,
  RecurringTypeFault,
  ResponseTimeAnalysis,
  RiskAssessment,
  ServiceCompanyRating,
  TrendAnalysis,
  TrendDirection,
  InsightSeverity,
} from "./types";

function resolveCtx(ctxOrId?: BuildingDataContext | string): BuildingDataContext {
  if (typeof ctxOrId === "string") return getBuildingDataset(ctxOrId);
  if (ctxOrId) return ctxOrId;
  return getBuildingDataset(DEFAULT_BUILDING_ID);
}

const RESPONSE_TARGET_HOURS = 2;
const ANALYSIS_WINDOW_DAYS = 60;
const RECURRING_THRESHOLD = 2;
const DOOR_FAULT_TYPE: FaultType = "דלת לא נסגרת";

function hoursBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
}

function daysAgo(date: string): number {
  return (Date.now() - new Date(date).getTime()) / 86_400_000;
}

function isInWindow(date: string, days: number): boolean {
  return daysAgo(date) <= days;
}

function getResponseHours(fault: Fault): number {
  if (fault.resolvedAt) {
    return hoursBetween(fault.reportedAt, fault.resolvedAt);
  }
  const priorityHours: Record<Fault["priority"], number> = {
    דחופה: 1.5,
    רגילה: 4,
    נמוכה: 8,
  };
  return priorityHours[fault.priority];
}

function getDowntimeHours(fault: Fault, ctx: BuildingDataContext): number {
  if (fault.downtimeHours !== undefined) return fault.downtimeHours;
  if (fault.status === "מושבתת") return ctx.activeFaultDowntime[fault.id] ?? 6;
  if (fault.status === "בטיפול") return 2;
  return 0;
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function trendFromChange(change: number): TrendDirection {
  if (change > 5) return "החמרה";
  if (change < -5) return "שיפור";
  return "יציב";
}

export function getRecurringFaultsByElevator(
  ctx: BuildingDataContext
): RecurringElevatorFault[] {
  const total = ctx.faults.length;
  const byElevator = new Map<string, Fault[]>();

  for (const fault of ctx.faults) {
    const list = byElevator.get(fault.elevatorId) ?? [];
    list.push(fault);
    byElevator.set(fault.elevatorId, list);
  }

  return ctx.elevators.map((elevator) => {
    const elevatorFaults = byElevator.get(elevator.id) ?? [];
    const typeCounts = new Map<FaultType, number>();
    for (const f of elevatorFaults) {
      typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1);
    }
    const topTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const faultCount = elevatorFaults.length;
    const hasRecurringType = topTypes.some((t) => t.count >= RECURRING_THRESHOLD);

    return {
      elevatorId: elevator.id,
      elevatorName: elevator.name,
      faultCount,
      percentage: safePercent(faultCount, total),
      topTypes,
      isRecurring: faultCount >= RECURRING_THRESHOLD || hasRecurringType,
    };
  }).sort((a, b) => b.faultCount - a.faultCount);
}

export function getRecurringFaultsByType(
  ctx: BuildingDataContext
): RecurringTypeFault[] {
  const total = ctx.faults.length;
  const byType = new Map<FaultType, Fault[]>();

  for (const fault of ctx.faults) {
    const list = byType.get(fault.type) ?? [];
    list.push(fault);
    byType.set(fault.type, list);
  }

  return Array.from(byType.entries())
    .map(([type, typeFaults]) => ({
      type,
      count: typeFaults.length,
      percentage: safePercent(typeFaults.length, total),
      isRecurring: typeFaults.length >= RECURRING_THRESHOLD,
      elevators: [...new Set(typeFaults.map((f) => f.elevatorName))],
    }))
    .sort((a, b) => b.count - a.count);
}

export function getFaultTypeBreakdown(
  ctx: BuildingDataContext
): FaultTypeBreakdown[] {
  return getRecurringFaultsByType(ctx).map(({ type, count, percentage }) => ({
    type,
    count,
    percentage,
  }));
}

export function getAverageDowntime(ctx: BuildingDataContext): DowntimeAnalysis {
  const allDowntime = ctx.faults.map((f) => getDowntimeHours(f, ctx));
  const totalHours = allDowntime.reduce((s, h) => s + h, 0);
  const withDowntime = allDowntime.filter((h) => h > 0);
  const averageHours =
    withDowntime.length > 0
      ? Math.round((totalHours / withDowntime.length) * 10) / 10
      : 0;

  const now = new Date();
  const monthFaults = ctx.faults.filter((f) => {
    const d = new Date(f.reportedAt);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const monthHours = monthFaults.reduce(
    (s, f) => s + getDowntimeHours(f, ctx),
    0
  );

  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthFaults = ctx.faults.filter((f) => {
    const d = new Date(f.reportedAt);
    return (
      d.getMonth() === prevMonth.getMonth() &&
      d.getFullYear() === prevMonth.getFullYear()
    );
  });
  const prevMonthHours = prevMonthFaults.reduce(
    (s, f) => s + getDowntimeHours(f, ctx),
    0
  );
  const trendPercent = percentChange(monthHours, prevMonthHours);

  const longest = ctx.faults
    .map((f) => ({ fault: f, hours: getDowntimeHours(f, ctx) }))
    .sort((a, b) => b.hours - a.hours)[0];

  const longestEvent =
    longest && longest.hours > 0
      ? `${formatHours(longest.hours)} — ${longest.fault.elevatorName} (${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(longest.fault.reportedAt))})`
      : "אין נתונים";

  return {
    averageHours,
    totalHours,
    monthHours,
    trendPercent,
    trendDirection: trendFromChange(trendPercent),
    longestEvent,
  };
}

export function getAverageResponseTime(
  ctx: BuildingDataContext
): ResponseTimeAnalysis {
  const closedFaults = ctx.faults.filter((f) => isClosedFault(f));
  const responseHours = closedFaults.map(getResponseHours);
  const averageHours =
    responseHours.length > 0
      ? Math.round(
          (responseHours.reduce((s, h) => s + h, 0) / responseHours.length) * 10
        ) / 10
      : 0;

  const compliant = responseHours.filter((h) => h <= RESPONSE_TARGET_HOURS).length;
  const compliancePercent =
    responseHours.length > 0
      ? Math.round((compliant / responseHours.length) * 100)
      : 0;

  const now = new Date();
  const thisMonth = closedFaults.filter((f) => {
    const d = new Date(f.reportedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = closedFaults.filter((f) => {
    const d = new Date(f.reportedAt);
    return (
      d.getMonth() === prevMonthDate.getMonth() &&
      d.getFullYear() === prevMonthDate.getFullYear()
    );
  });

  const thisAvg =
    thisMonth.length > 0
      ? thisMonth.reduce((s, f) => s + getResponseHours(f), 0) / thisMonth.length
      : 0;
  const prevAvg =
    prevMonth.length > 0
      ? prevMonth.reduce((s, f) => s + getResponseHours(f), 0) / prevMonth.length
      : 0;
  const trendPercent = percentChange(thisAvg, prevAvg);

  const worst = closedFaults
    .map((f) => ({ fault: f, hours: getResponseHours(f) }))
    .sort((a, b) => b.hours - a.hours)[0];

  const worstCase = worst
    ? `${formatHours(worst.hours)} — ${worst.fault.elevatorName} (${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short" }).format(new Date(worst.fault.reportedAt))})`
    : "אין נתונים";

  return {
    averageHours,
    targetHours: RESPONSE_TARGET_HOURS,
    compliancePercent,
    trendPercent,
    trendDirection: trendFromChange(trendPercent),
    worstCase,
  };
}

export function getElevatorAvailability(
  ctx: BuildingDataContext
): ElevatorAvailability[] {
  const windowHours = ANALYSIS_WINDOW_DAYS * 24;

  return ctx.elevators.map((elevator) => {
    const elevatorFaults = ctx.faults.filter(
      (f) => f.elevatorId === elevator.id
    );
    const downtimeHours = elevatorFaults.reduce(
      (s, f) => s + getDowntimeHours(f, ctx),
      0
    );
    const availabilityPercent = Math.max(
      0,
      Math.round(((windowHours - downtimeHours) / windowHours) * 100)
    );

    return {
      elevatorId: elevator.id,
      elevatorName: elevator.name,
      availabilityPercent,
      downtimeHours,
      faultCount: elevatorFaults.length,
    };
  });
}

export function getMostProblematicElevator(
  ctx: BuildingDataContext
): ProblematicElevator {
  const byElevator = getRecurringFaultsByElevator(ctx);

  if (byElevator.length === 0 || ctx.faults.length === 0) {
    const fallback = ctx.elevators[0];
    return {
      elevatorId: fallback?.id ?? "",
      name: fallback?.name ?? "אין נתונים",
      faultCount: 0,
      percentage: 0,
      downtimeHours: 0,
      reason: "לא נרשמו תקלות במערכת",
    };
  }

  const top = byElevator[0];
  const availability = getElevatorAvailability(ctx).find(
    (a) => a.elevatorId === top.elevatorId
  );

  return {
    elevatorId: top.elevatorId,
    name: top.elevatorName,
    faultCount: top.faultCount,
    percentage: top.percentage,
    downtimeHours: availability?.downtimeHours ?? 0,
    reason: `ריכוז ${top.percentage}% מכלל התקלות בבניין — ${top.faultCount} אירועים ב-${ANALYSIS_WINDOW_DAYS} יום`,
  };
}

export function getServiceCompanyRating(
  ctx: BuildingDataContext
): ServiceCompanyRating {
  const response = getAverageResponseTime(ctx);
  const recurring = getRecurringFaultsByType(ctx).filter(
    (t) => t.isRecurring
  ).length;
  const downtime = getAverageDowntime(ctx);
  const breakdownLen = getFaultTypeBreakdown(ctx).length;
  const recurringRate =
    ctx.faults.length > 0 && breakdownLen > 0
      ? (recurring / breakdownLen) * 100
      : 0;

  const responseScore = Math.max(
    0,
    Math.min(100, Math.round(100 - (response.averageHours / 12) * 100))
  );
  const repairScore = Math.max(
    0,
    Math.min(100, Math.round(response.compliancePercent * 0.9))
  );
  const preventionScore = Math.max(
    0,
    Math.min(100, Math.round(100 - recurringRate * 1.5))
  );
  const communicationScore = Math.max(
    0,
    Math.min(100, 72 - Math.round(downtime.trendPercent * 0.3))
  );

  const breakdown = [
    { label: "זמן תגובה", score: responseScore },
    { label: "איכות תיקון", score: repairScore },
    { label: "מניעת חזרתיות", score: preventionScore },
    { label: "תקשורת", score: communicationScore },
  ];

  const score = Math.round(
    breakdown.reduce((s, b) => s + b.score, 0) / breakdown.length
  );

  return {
    company: ctx.building.elevatorCompany,
    score,
    breakdown,
  };
}

export function getTrendAnalysis(ctx: BuildingDataContext): TrendAnalysis {
  const now = new Date();
  const thisMonthFaults = ctx.faults.filter((f) => {
    const d = new Date(f.reportedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthFaults = ctx.faults.filter((f) => {
    const d = new Date(f.reportedAt);
    return (
      d.getMonth() === prevMonthDate.getMonth() &&
      d.getFullYear() === prevMonthDate.getFullYear()
    );
  });

  const faultCountChangePercent = percentChange(
    thisMonthFaults.length,
    prevMonthFaults.length
  );
  const thisDowntime = thisMonthFaults.reduce(
    (s, f) => s + getDowntimeHours(f, ctx),
    0
  );
  const prevDowntime = prevMonthFaults.reduce(
    (s, f) => s + getDowntimeHours(f, ctx),
    0
  );
  const downtimeChangePercent = percentChange(thisDowntime, prevDowntime);

  const direction = trendFromChange(
    (faultCountChangePercent + downtimeChangePercent) / 2
  );

  const descriptions: Record<TrendDirection, string> = {
    שיפור: `מגמת שיפור: ירידה של ${Math.abs(faultCountChangePercent)}% בתקלות לעומת חודש קודם`,
    החמרה: `מגמת החמרה: עלייה של ${faultCountChangePercent}% בתקלות ו-${downtimeChangePercent}% בזמני השבתה`,
    יציב: "מגמה יציבה — ללא שינוי משמעותי לעומת חודש קודם",
  };

  return {
    direction,
    faultCountChangePercent,
    downtimeChangePercent,
    description: descriptions[direction],
  };
}

function detectRecurringWithinDays(
  ctx: BuildingDataContext,
  elevatorId: string,
  type: FaultType,
  days: number
): number {
  const matching = ctx.faults
    .filter((f) => f.elevatorId === elevatorId && f.type === type)
    .filter((f) => isInWindow(f.reportedAt, days));
  return matching.length;
}

export function getInsufficientTreatmentAnalysis(
  ctx: BuildingDataContext
): InsufficientTreatmentAnalysis {
  let suspiciousCases = 0;
  const details: string[] = [];

  for (const elevator of ctx.elevators) {
    for (const type of [...new Set(ctx.faults.map((f) => f.type))]) {
      const count = detectRecurringWithinDays(ctx, elevator.id, type, 30);
      if (count >= 2) {
        suspiciousCases++;
        const name = ctx.elevators.find((e) => e.id === elevator.id)?.name;
        details.push(`${name}: ${type} חזרה ${count} פעמים ב-30 יום`);
      }
    }
  }

  return {
    company: ctx.building.elevatorCompany,
    suspiciousCases,
    detail:
      suspiciousCases > 0
        ? `${suspiciousCases} מקרים חשודים לטיפול לא מספק: ${details.join("; ")}`
        : "לא זוהו מקרים חשודים לטיפול לא מספק",
  };
}

export function getFailurePatterns(ctx: BuildingDataContext): string[] {
  const patterns: string[] = [];
  const byElevator = getRecurringFaultsByElevator(ctx);

  for (const elevator of byElevator) {
    if (!elevator.isRecurring) continue;
    const types = elevator.topTypes
      .filter((t) => t.count >= 2)
      .map((t) => t.type)
      .join(" + ");
    if (types) {
      patterns.push(
        `${elevator.elevatorName}: דפוס חוזר של ${types} — ${elevator.faultCount} אירועים`
      );
    }
  }

  const doorRecurring = getRecurringFaultsByType(ctx).find(
    (t) => t.type === DOOR_FAULT_TYPE && t.isRecurring
  );
  if (doorRecurring) {
    patterns.push(
      `חזרתיות גבוהה בתקלות דלת — ${doorRecurring.count} מקרים ב-${doorRecurring.elevators.join(", ")}`
    );
  }

  return patterns;
}

export function getRiskAssessment(ctx: BuildingDataContext): RiskAssessment {
  const problematic = getMostProblematicElevator(ctx);
  const openFaults = ctx.faults.filter((f) => isOpenFault(f)).length;
  const urgentOpen = ctx.faults.filter(
    (f) => isOpenFault(f) && f.priority === "דחופה"
  ).length;
  const trend = getTrendAnalysis(ctx);
  const recurringTypes = getRecurringFaultsByType(ctx).filter(
    (t) => t.isRecurring
  );

  const factors: string[] = [];
  if (problematic.percentage >= 30) {
    factors.push(`ריכוז תקלות ב-${problematic.name} (${problematic.percentage}%)`);
  }
  if (trend.direction === "החמרה") {
    factors.push("מגמת החמרה בחודש האחרון");
  }
  if (urgentOpen > 0) {
    factors.push(`${urgentOpen} תקלות דחופות פתוחות`);
  }
  if (recurringTypes.length > 0) {
    factors.push(`${recurringTypes.length} סוגי תקלות חוזרות`);
  }

  let level: InsightSeverity = "נמוך";
  if (factors.length >= 3 || urgentOpen >= 2) level = "גבוה";
  else if (factors.length >= 1) level = "בינוני";

  const prediction =
    level === "גבוה"
      ? `סבירות גבוהה לתקלה נוספת ב-${problematic.name} בתוך 14 יום`
      : level === "בינוני"
        ? "מומלץ מעקב צמוד — קיימים גורמי סיכון פעילים"
        : "רמת סיכון נמוכה — המשך ניטור שוטף";

  return { level, factors, prediction };
}

export function getAnomalyAlerts(ctx: BuildingDataContext): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const problematic = getMostProblematicElevator(ctx);
  const downtime = getAverageDowntime(ctx);
  const response = getAverageResponseTime(ctx);
  const service = getServiceCompanyRating(ctx);

  if (problematic.percentage >= 35) {
    alerts.push({
      id: "elevator-concentration",
      message: `${problematic.name} אחראית ל-${problematic.percentage}% מהתקלות — חריגה מסף 35%`,
      severity: "גבוה",
    });
  }

  if (downtime.trendPercent > 20) {
    alerts.push({
      id: "downtime-spike",
      message: `זמן ההשבתה הממוצע עלה ב-${downtime.trendPercent}% — חריגה מסף 20%`,
      severity: "גבוה",
    });
  }

  if (response.compliancePercent < 50) {
    alerts.push({
      id: "response-low",
      message: `עמידה ביעד זמן תגובה: ${response.compliancePercent}% בלבד — מתחת ל-50%`,
      severity: "בינוני",
    });
  }

  if (service.score < 65) {
    alerts.push({
      id: "service-score",
      message: `ציון שירות חברת המעליות: ${service.score}/100 — מתחת לסף 65`,
      severity: "בינוני",
    });
  }

  const doorPct = getRecurringFaultsByType(ctx).find(
    (t) => t.type === DOOR_FAULT_TYPE
  );
  if (doorPct && doorPct.percentage >= 15 && doorPct.isRecurring) {
    alerts.push({
      id: "door-recurring",
      message: `${doorPct.percentage}% מהתקלות קשורות למערכת הדלת — חזרתיות מזוהה`,
      severity: "גבוה",
    });
  }

  return alerts;
}

export function generateInsights(ctx: BuildingDataContext): ExpertInsight[] {
  const insights: ExpertInsight[] = [];
  let id = 1;

  if (ctx.faults.length === 0) {
    return [
      {
        id: "1",
        text: "אין מספיק נתונים לניתוח מקצועי",
        severity: "בינוני",
        category: "נתונים חסרים",
      },
      {
        id: "2",
        text: "לא להציג ללקוח ללא בדיקה מקצועית",
        severity: "גבוה",
        category: "הנחיית הצגה",
      },
    ];
  }

  const problematic = getMostProblematicElevator(ctx);
  if (problematic.percentage > 0) {
    insights.push({
      id: String(id++),
      text: `${problematic.name} אחראית ל-${problematic.percentage}% מהתקלות בבניין`,
      severity: problematic.percentage >= 35 ? "גבוה" : "בינוני",
      category: "ריכוז תקלות",
    });
  }

  const doorStats = getRecurringFaultsByType(ctx).find(
    (t) => t.type === DOOR_FAULT_TYPE
  );
  if (doorStats) {
    insights.push({
      id: String(id++),
      text: `${doorStats.percentage}% מהתקלות קשורות למערכת הדלת`,
      severity: doorStats.percentage >= 20 ? "גבוה" : "בינוני",
      category: "חלוקה לפי סוג",
    });
    if (doorStats.isRecurring) {
      insights.push({
        id: String(id++),
        text: "קיימת חזרתיות גבוהה בתקלות דלת",
        severity: "גבוה",
        category: "דפוסי כשל",
      });
    }
  }

  const downtime = getAverageDowntime(ctx);
  if (downtime.trendPercent !== 0) {
    const dir = downtime.trendPercent > 0 ? "עלה" : "ירד";
    insights.push({
      id: String(id++),
      text: `זמן ההשבתה הממוצע ${dir} ב-${Math.abs(downtime.trendPercent)}%`,
      severity: downtime.trendPercent > 20 ? "גבוה" : "בינוני",
      category: "מגמת השבתה",
    });
  }

  const insufficient = getInsufficientTreatmentAnalysis(ctx);
  if (insufficient.suspiciousCases > 0) {
    insights.push({
      id: String(id++),
      text: "נדרש בירור מקצועי של מקור התקלה",
      severity: "גבוה",
      category: "ניתוח שורש",
    });
    insights.push({
      id: String(id++),
      text: "ייתכן שהטיפול שבוצע עד כה אינו מטפל בגורם השורש",
      severity: "גבוה",
      category: "חשד לטיפול לא מספק",
    });
  }

  const recurringElevators = getRecurringFaultsByElevator(ctx).filter(
    (e) => e.isRecurring
  );
  for (const e of recurringElevators.slice(0, 1)) {
    const topType = e.topTypes[0];
    if (topType && topType.count >= 2) {
      insights.push({
        id: String(id++),
        text: `נראה כי קיימת חזרתיות בתקלות ${topType.type} ב${e.elevatorName}`,
        severity: "גבוה",
        category: "תקלות חוזרות",
      });
    }
  }

  insights.push({
    id: String(id++),
    text: "לא להציג ללקוח ללא בדיקה מקצועית",
    severity: "גבוה",
    category: "הנחיית הצגה",
  });

  if (insufficient.suspiciousCases > 0) {
    insights.push({
      id: String(id++),
      text: "נדרש בירור מול חברת השירות",
      severity: "בינוני",
      category: "פעולה נדרשת",
    });
    insights.push({
      id: String(id++),
      text: "מומלץ ליהודה פורטה לבחון את היסטוריית החלפת החלקים",
      severity: "בינוני",
      category: "המלצה פנימית",
    });
  }

  return insights;
}

export function generateActions(ctx: BuildingDataContext): string[] {
  if (ctx.faults.length === 0) {
    return [
      "אין תקלות רשומות — המשך ניטור שוטף",
      "לא להציג ללקוח ממצאים עד השלמת בדיקה מקצועית בשטח",
    ];
  }

  const actions: string[] = [];
  const problematic = getMostProblematicElevator(ctx);
  const insufficient = getInsufficientTreatmentAnalysis(ctx);
  const doorRecurring = getRecurringFaultsByType(ctx).find(
    (t) => t.type === DOOR_FAULT_TYPE && t.isRecurring
  );

  actions.push(
    `לבצע ביקור מקצועי ב${problematic.name} — ${problematic.faultCount} תקלות זוהו`
  );

  if (doorRecurring) {
    actions.push("לדרוש מחברת השירות דוח שורש על תקלות הדלת החוזרות");
  }

  if (insufficient.suspiciousCases >= 2) {
    actions.push("לבחון הצעת מכרז חלופי — לא לשתף עם הלקוח בשלב זה");
  }

  actions.push("לתעד כל קריאה ולעקוב אחר זמני סגירה — 30 יום");
  actions.push("לא להציג ללקוח ממצאים עד השלמת בדיקה מקצועית בשטח");

  return actions;
}

export function generateMetrics(ctx: BuildingDataContext): ExpertMetric[] {
  const response = getAverageResponseTime(ctx);
  const downtime = getAverageDowntime(ctx);
  const service = getServiceCompanyRating(ctx);
  const risk = getRiskAssessment(ctx);

  return [
    {
      label: "זמן תגובה ממוצע",
      value: `${response.averageHours} שעות`,
      trend: `${response.trendPercent > 0 ? "+" : ""}${response.trendPercent}%`,
      trendUp: response.trendPercent > 0,
    },
    {
      label: "זמן השבתה ממוצע",
      value: `${downtime.averageHours} שעות`,
      trend: `${downtime.trendPercent > 0 ? "+" : ""}${downtime.trendPercent}%`,
      trendUp: downtime.trendPercent > 0,
    },
    {
      label: "ציון שירות חברה",
      value: `${service.score}/100`,
      trend: service.score < 65 ? "מתחת לסף" : "בטווח",
      trendUp: service.score < 65,
    },
    {
      label: "הערכת סיכון עתידי",
      value: risk.level,
      trend: `↑ ${getMostProblematicElevator(ctx).name}`,
      trendUp: risk.level !== "נמוך",
    },
  ];
}

export function validateAnalyticsOutput(data: ExpertAnalytics): string[] {
  const errors: string[] = [];

  function walk(value: unknown, path: string): void {
    if (value === undefined) {
      errors.push(`${path}: undefined`);
      return;
    }
    if (value === null) return;
    if (typeof value === "number") {
      if (Number.isNaN(value) || !Number.isFinite(value)) {
        errors.push(`${path}: NaN/Infinity`);
      }
      return;
    }
    if (typeof value === "string" && value.includes("undefined")) {
      errors.push(`${path}: contains 'undefined'`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      Object.entries(value).forEach(([key, val]) =>
        walk(val, `${path}.${key}`)
      );
    }
  }

  walk(data, "analytics");
  return errors;
}

export function getExpertAnalytics(
  ctxOrId?: BuildingDataContext | string
): ExpertAnalytics {
  const ctx = resolveCtx(ctxOrId);
  return {
    insights: generateInsights(ctx),
    metrics: generateMetrics(ctx),
    recurringByElevator: getRecurringFaultsByElevator(ctx),
    recurringByType: getRecurringFaultsByType(ctx),
    faultTypeBreakdown: getFaultTypeBreakdown(ctx),
    failurePatterns: getFailurePatterns(ctx),
    problematicElevator: getMostProblematicElevator(ctx),
    insufficientTreatment: getInsufficientTreatmentAnalysis(ctx),
    responseTime: getAverageResponseTime(ctx),
    downtime: getAverageDowntime(ctx),
    elevatorAvailability: getElevatorAvailability(ctx),
    serviceRating: getServiceCompanyRating(ctx),
    trend: getTrendAnalysis(ctx),
    alerts: getAnomalyAlerts(ctx),
    riskAssessment: getRiskAssessment(ctx),
    actions: generateActions(ctx),
  };
}
