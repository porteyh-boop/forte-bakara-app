import { filterFaultsForLiveStart, isAfterLiveStart } from "./building-live";
import type { Fault } from "./types";
import type { PilotCloudFault } from "./pilot-cloud";

export type RiskLevel = "נמוכה" | "בינונית" | "גבוהה";

export type OperationalStatus =
  | "תקין"
  | "תקין עם מעקב"
  | "דורש בדיקה"
  | "חריג";

export interface ProfessionalAssessment {
  buildingId: string;
  buildingName: string;
  operationalStatus: OperationalStatus;
  riskLevel: RiskLevel;
  findings: string[];
  conclusions: string[];
  recommendations: string[];
  metrics: {
    totalFaults: number;
    openFaults: number;
    closedFaults: number;
    recurringFaults: number;
    doorFaults: number;
    controlFaults: number;
    driveFaults: number;
    shutdownEvents: number;
    rescueEvents: number;
    availability?: number;
  };
}

export interface AssessmentFault {
  elevatorId: string;
  faultType: string;
  description: string;
  status: string;
  reportedAt: string;
  closedAt?: string | null;
  isDisabled?: boolean;
}

const OPEN_STATUSES = new Set(["פתוחה", "בטיפול", "מושבתת", "פעילה"]);
const DOOR_MARKERS = ["דלת"];
const CONTROL_MARKERS = ["פיקוד", "בקר", "כפתור", "תקשורת", "כרטיס", "ספק"];
const DRIVE_MARKERS = ["הינע", "מנוע", "מערכת הינע"];
const RESCUE_MARKERS = ["חילוץ", "תקועה בין קומות"];
const SHUTDOWN_MARKERS = ["השבת", "מושבת"];

const STATUS_SEVERITY: Record<OperationalStatus, number> = {
  תקין: 0,
  "תקין עם מעקב": 1,
  "דורש בדיקה": 2,
  חריג: 3,
};

const RISK_SEVERITY: Record<RiskLevel, number> = {
  נמוכה: 0,
  בינונית: 1,
  גבוהה: 2,
};

function isOpenFault(fault: AssessmentFault): boolean {
  return OPEN_STATUSES.has(fault.status);
}

function isClosedFault(fault: AssessmentFault): boolean {
  return fault.status === "סגורה" || fault.status === "טופלה";
}

function matchesMarkers(text: string, markers: string[]): boolean {
  const normalized = text.toLowerCase();
  return markers.some((m) => normalized.includes(m.toLowerCase()));
}

function isDoorFault(fault: AssessmentFault): boolean {
  return matchesMarkers(fault.faultType, DOOR_MARKERS);
}

function isControlFault(fault: AssessmentFault): boolean {
  return (
    matchesMarkers(fault.faultType, CONTROL_MARKERS) ||
    matchesMarkers(fault.description, CONTROL_MARKERS)
  );
}

function isDriveFault(fault: AssessmentFault): boolean {
  return (
    matchesMarkers(fault.faultType, DRIVE_MARKERS) ||
    matchesMarkers(fault.description, DRIVE_MARKERS)
  );
}

function isRescueEvent(fault: AssessmentFault): boolean {
  return (
    matchesMarkers(fault.faultType, RESCUE_MARKERS) ||
    matchesMarkers(fault.description, RESCUE_MARKERS)
  );
}

function isShutdownEvent(fault: AssessmentFault): boolean {
  if (fault.isDisabled && isOpenFault(fault)) return true;
  if (fault.status === "מושבתת") return true;
  return (
    matchesMarkers(fault.faultType, SHUTDOWN_MARKERS) ||
    matchesMarkers(fault.description, SHUTDOWN_MARKERS)
  );
}

function faultTimestamp(fault: AssessmentFault): number {
  return new Date(fault.reportedAt).getTime();
}

function faultsInWindow(
  faults: AssessmentFault[],
  days: number,
  now: Date
): AssessmentFault[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return faults.filter((f) => faultTimestamp(f) >= cutoff);
}

function countRecurringPatterns(faults: AssessmentFault[]): number {
  const groups = new Map<string, number>();
  for (const f of faults) {
    const key = `${f.elevatorId}|${f.faultType}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Array.from(groups.values()).filter((c) => c >= 3).length;
}

function hasRecurringPattern(faults: AssessmentFault[]): boolean {
  return countRecurringPatterns(faults) > 0;
}

function pickHigherStatus(
  current: OperationalStatus,
  next: OperationalStatus
): OperationalStatus {
  return STATUS_SEVERITY[next] > STATUS_SEVERITY[current] ? next : current;
}

function pickHigherRisk(current: RiskLevel, next: RiskLevel): RiskLevel {
  return RISK_SEVERITY[next] > RISK_SEVERITY[current] ? next : current;
}

function computeAvailability(
  elevators: { id: string; status?: string }[],
  faults: AssessmentFault[]
): number | undefined {
  if (elevators.length === 0) return undefined;

  const disabledByFault = new Set(
    faults
      .filter((f) => f.isDisabled && isOpenFault(f))
      .map((f) => f.elevatorId)
  );

  const activeCount = elevators.filter((e) => {
    if (disabledByFault.has(e.id)) return false;
    if (e.status === "מושבתת") return false;
    return true;
  }).length;

  return Math.round((activeCount / elevators.length) * 1000) / 10;
}

function detectTrend(
  faults: AssessmentFault[],
  now: Date
): "worsening" | "improving" | "stable" {
  const last30 = faultsInWindow(faults, 30, now).length;
  const prev30Start = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const prev30End = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const prev30 = faults.filter((f) => {
    const t = faultTimestamp(f);
    return t >= prev30Start && t < prev30End;
  }).length;

  if (last30 > prev30 && last30 > 0) return "worsening";
  if (last30 < prev30 && prev30 > 0) return "improving";
  return "stable";
}

function normalizeFaultInput(fault: AssessmentFault): AssessmentFault {
  return {
    ...fault,
    reportedAt: fault.reportedAt,
  };
}

function mergeFaultInputs(
  faults: AssessmentFault[],
  reports: AssessmentFault[]
): AssessmentFault[] {
  if (reports.length === 0) return faults.map(normalizeFaultInput);
  const seen = new Set(
    faults.map(
      (f) =>
        `${f.elevatorId}|${f.faultType}|${f.reportedAt}|${f.description}`
    )
  );
  const merged = faults.map(normalizeFaultInput);
  for (const report of reports) {
    const key = `${report.elevatorId}|${report.faultType}|${report.reportedAt}|${report.description}`;
    if (!seen.has(key)) {
      merged.push(normalizeFaultInput(report));
      seen.add(key);
    }
  }
  return merged;
}

function filterByLiveStart(
  faults: AssessmentFault[],
  liveStartedAt: string | null | undefined
): AssessmentFault[] {
  if (!liveStartedAt) return faults;
  return faults.filter((f) => isAfterLiveStart(f.reportedAt, liveStartedAt));
}

export function mapPilotFaultForAssessment(
  fault: PilotCloudFault
): AssessmentFault {
  return {
    elevatorId: fault.elevator_id,
    faultType: fault.fault_type,
    description: fault.description,
    status: fault.status,
    reportedAt: fault.created_at,
    closedAt: fault.closed_at,
    isDisabled: fault.is_disabled,
  };
}

export function mapClientFaultForAssessment(fault: Fault): AssessmentFault {
  return {
    elevatorId: fault.elevatorId,
    faultType: fault.type,
    description: fault.description,
    status: fault.status,
    reportedAt: fault.reportedAt,
    closedAt: fault.resolvedAt ?? null,
    isDisabled: fault.isDisabled,
  };
}

export function generateProfessionalAssessment(params: {
  building: { id?: string; buildingCode?: string; name: string };
  elevators: { id: string; name: string; status?: string }[];
  faults: AssessmentFault[];
  reports?: AssessmentFault[];
  liveStartedAt?: string | null;
  now?: Date;
}): ProfessionalAssessment {
  const {
    building,
    elevators,
    faults: rawFaults,
    reports = [],
    liveStartedAt = null,
    now = new Date(),
  } = params;

  const buildingId =
    building.id ?? building.buildingCode ?? building.name;
  const buildingName = building.name;

  const merged = mergeFaultInputs(rawFaults, reports);
  const filtered = filterByLiveStart(merged, liveStartedAt);

  const openFaults = filtered.filter(isOpenFault);
  const closedFaults = filtered.filter(isClosedFault);
  const doorFaults = filtered.filter(isDoorFault);
  const controlFaults = filtered.filter(isControlFault);
  const driveFaults = filtered.filter(isDriveFault);
  const rescueEvents = filtered.filter(isRescueEvent);
  const shutdownEvents = filtered.filter(isShutdownEvent);
  const recurringFaults = countRecurringPatterns(filtered);
  const availability = computeAvailability(elevators, filtered);
  const trend = detectTrend(filtered, now);
  const faults30 = faultsInWindow(filtered, 30, now).length;
  const faults90 = faultsInWindow(filtered, 90, now).length;

  const findings: string[] = [];
  const conclusions: string[] = [];
  const recommendations: string[] = [];

  let operationalStatus: OperationalStatus = "תקין";
  let riskLevel: RiskLevel = "נמוכה";

  if (filtered.length === 0) {
    operationalStatus = "תקין";
    riskLevel = "נמוכה";
    findings.push("לא נרשמו תקלות בתקופת הבקרה.");
    conclusions.push("לא זוהו אירועים חריגים בתקופת הבקרה.");
    recommendations.push("המשך מעקב שוטף.");
  } else if (openFaults.length === 1 && recurringFaults === 0) {
    operationalStatus = "תקין עם מעקב";
    riskLevel = "נמוכה";
    findings.push("קיימת תקלה פתוחה אחת.");
    findings.push("לא זוהו תקלות חוזרות.");
    conclusions.push("לא זוהתה אינדיקציה לכשל מערכתי.");
    recommendations.push("לוודא סגירת התקלה הפתוחה.");
  } else {
    if (openFaults.length > 0) {
      findings.push(
        openFaults.length === 1
          ? "קיימת תקלה פתוחה אחת."
          : `קיימות ${openFaults.length} תקלות פתוחות.`
      );
    }
    if (recurringFaults === 0) {
      findings.push("לא זוהו תקלות חוזרות.");
    }
  }

  if (trend === "worsening") {
    findings.push("זוהתה מגמת החמרה בנפח התקלות.");
  } else if (trend === "improving") {
    findings.push("זוהתה מגמת שיפור בנפח התקלות.");
  } else if (filtered.length > 0) {
    findings.push("לא זוהתה מגמת החמרה.");
  }

  if (faults30 > 0) {
    findings.push(`נרשמו ${faults30} תקלות ב-30 הימים האחרונים.`);
  }
  if (faults90 > faults30) {
    findings.push(`סה"כ ${faults90} תקלות ב-90 הימים האחרונים.`);
  }

  if (hasRecurringPattern(filtered)) {
    operationalStatus = pickHigherStatus(operationalStatus, "דורש בדיקה");
    riskLevel = pickHigherRisk(riskLevel, "בינונית");
    findings.push("זוהתה חזרתיות בתקלות — אותו סוג באותה מעלית.");
    conclusions.push("זוהתה חזרתיות בתקלות.");
    recommendations.push("לדרוש מחברת השירות:");
    recommendations.push("• דוח תחקור");
    recommendations.push("• ניתוח שורש תקלה");
    recommendations.push("• תוכנית מניעה");
  }

  if (doorFaults.length >= 3) {
    conclusions.push(
      "קיימת אינדיקציה אפשרית לשחיקה או כיוון לקוי במערכת הדלתות."
    );
    recommendations.push("בדיקת:");
    recommendations.push("• מפעיל דלת");
    recommendations.push("• גלגלים");
    recommendations.push("• מסילות");
    recommendations.push("• מנגנוני נעילה");
    recommendations.push("• כיוון דלתות");
  }

  if (controlFaults.length >= 3) {
    conclusions.push("קיימת אינדיקציה לחוסר יציבות במערכת הפיקוד.");
    recommendations.push("בדיקת:");
    recommendations.push("• בקר");
    recommendations.push("• תקשורת");
    recommendations.push("• כרטיסים אלקטרוניים");
    recommendations.push("• ספקי כוח");
  }

  if (driveFaults.length >= 3) {
    findings.push(`נרשמו ${driveFaults.length} תקלות במערכת ההינע.`);
  }

  if (rescueEvents.length >= 1) {
    operationalStatus = pickHigherStatus(operationalStatus, "חריג");
    riskLevel = pickHigherRisk(riskLevel, "גבוהה");
    findings.push("נרשם אירוע חילוץ נוסעים.");
    conclusions.push("נרשם אירוע חילוץ נוסעים.");
    recommendations.push("לדרוש דוח אירוע מפורט מחברת המעליות.");
  }

  if (shutdownEvents.length >= 2) {
    operationalStatus = pickHigherStatus(operationalStatus, "חריג");
    riskLevel = pickHigherRisk(riskLevel, "גבוהה");
    findings.push(`נרשמו ${shutdownEvents.length} אירועי השבתה.`);
    conclusions.push("רמת השירות נפגעה באופן משמעותי.");
    recommendations.push("לבצע בדיקה מערכתית מלאה.");
  }

  if (
    filtered.length > 0 &&
    conclusions.length === 0 &&
    openFaults.length !== 1
  ) {
    conclusions.push(
      "בהתבסס על הנתונים שנאספו, נדרש מעקב מתמשך על מצב המעליות."
    );
  }

  if (
    filtered.length > 0 &&
    recommendations.length === 0 &&
    openFaults.length !== 1
  ) {
    recommendations.push("המשך מעקב שוטף.");
  }

  return {
    buildingId,
    buildingName,
    operationalStatus,
    riskLevel,
    findings: [...new Set(findings)],
    conclusions: [...new Set(conclusions)],
    recommendations: [...new Set(recommendations)],
    metrics: {
      totalFaults: filtered.length,
      openFaults: openFaults.length,
      closedFaults: closedFaults.length,
      recurringFaults,
      doorFaults: doorFaults.length,
      controlFaults: controlFaults.length,
      driveFaults: driveFaults.length,
      shutdownEvents: shutdownEvents.length,
      rescueEvents: rescueEvents.length,
      availability,
    },
  };
}

/** סינון תקלות לקוח לפי live_started_at לפני הערכה */
export function filterClientFaultsForAssessment(
  faults: Fault[],
  liveStartedAt: string | null | undefined
): Fault[] {
  return filterFaultsForLiveStart(faults, liveStartedAt);
}

export function getOperationalStatusClasses(status: OperationalStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "תקין":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
      };
    case "תקין עם מעקב":
      return {
        bg: "bg-sky-50",
        text: "text-sky-800",
        border: "border-sky-200",
      };
    case "דורש בדיקה":
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        border: "border-amber-200",
      };
    case "חריג":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
      };
  }
}

export function getRiskLevelClasses(level: RiskLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case "נמוכה":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
      };
    case "בינונית":
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        border: "border-amber-200",
      };
    case "גבוהה":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
      };
  }
}
