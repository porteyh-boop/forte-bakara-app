import { filterFaultsForLiveStart, isAfterLiveStart } from "./building-live";
import {
  evaluateProfessionalRules,
  type ActivatedProfessionalRule,
  type AssessmentMetrics,
  PROFESSIONAL_RULES,
} from "./professional-rules";
import type { Fault } from "./types";
import type { PilotCloudFault } from "./pilot-cloud";

export type { AssessmentMetrics, ActivatedProfessionalRule };
export { PROFESSIONAL_RULES, evaluateProfessionalRules };

export type RiskLevel = "נמוכה" | "בינונית" | "גבוהה";

export type OperationalStatus =
  | "תקין"
  | "תקין עם מעקב"
  | "דורש בדיקה"
  | "חריג";

export type RuleSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ProfessionalAssessment {
  buildingId: string;
  buildingName: string;
  operationalStatus: OperationalStatus;
  riskLevel: RiskLevel;
  findings: string[];
  conclusions: string[];
  recommendations: string[];
  activatedRules: ActivatedProfessionalRule[];
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
const DRIVE_MARKERS = ["הינע", "מנוע", "מערכת הינע", "רעש"];
const RESCUE_MARKERS = ["חילוץ", "תקועה בין קומות", "לכוד"];
const SHUTDOWN_MARKERS = ["השבת", "מושבת"];
const SAFETY_MARKERS = ["בטיחות", "לכוד", "עשן", "חשמל", "דימום"];
const PARTIAL_DOOR_MARKERS = ["פתיחה חלקית", "לא נסגר", "סגירה לא מלאה"];
const STUCK_DOOR_MARKERS = ["תקיע", "נתקע"];
const ALIGNMENT_MARKERS = ["כיוון"];
const WHEEL_MARKERS = ["גלגל"];

const SEVERITY_TO_STATUS: Record<RuleSeverity, OperationalStatus> = {
  info: "תקין",
  low: "תקין עם מעקב",
  medium: "דורש בדיקה",
  high: "חריג",
  critical: "חריג",
};

const SEVERITY_TO_RISK: Record<RuleSeverity, RiskLevel> = {
  info: "נמוכה",
  low: "נמוכה",
  medium: "בינונית",
  high: "גבוהה",
  critical: "גבוהה",
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

function isSafetyFault(fault: AssessmentFault): boolean {
  return (
    matchesMarkers(fault.faultType, SAFETY_MARKERS) ||
    matchesMarkers(fault.description, SAFETY_MARKERS)
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

function countRecurringPatterns(
  faults: AssessmentFault[],
  predicate: (f: AssessmentFault) => boolean = () => true
): number {
  const groups = new Map<string, number>();
  for (const f of faults.filter(predicate)) {
    const key = `${f.elevatorId}|${f.faultType}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return Array.from(groups.values()).filter((c) => c >= 3).length;
}

function detectTrend(
  faults: AssessmentFault[],
  now: Date
): AssessmentMetrics["trend"] {
  const last30 = faultsInWindow(faults, 30, now).length;
  const prev30Start = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const prev30End = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const prev30 = faults.filter((f) => {
    const t = faultTimestamp(f);
    return t >= prev30Start && t < prev30End;
  }).length;

  if (last30 > prev30 && last30 > 0 && prev30 > 0) return "worsening";
  if (last30 < prev30 && prev30 > 0) return "improving";
  return "stable";
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

function hasRepeatWithinDays(faults: AssessmentFault[], days: number): boolean {
  const byKey = new Map<string, number[]>();
  for (const f of faults) {
    const key = `${f.elevatorId}|${f.faultType}`;
    const list = byKey.get(key) ?? [];
    list.push(faultTimestamp(f));
    byKey.set(key, list);
  }

  const windowMs = days * 24 * 60 * 60 * 1000;
  for (const timestamps of byKey.values()) {
    if (timestamps.length < 2) continue;
    timestamps.sort((a, b) => a - b);
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] - timestamps[i - 1] <= windowMs) return true;
    }
  }
  return false;
}

function maxOpenFaultDays(faults: AssessmentFault[], now: Date): number {
  let maxDays = 0;
  for (const f of faults.filter(isOpenFault)) {
    const days =
      (now.getTime() - faultTimestamp(f)) / (24 * 60 * 60 * 1000);
    if (days > maxDays) maxDays = days;
  }
  return Math.floor(maxDays);
}

function countDisabledElevators(
  elevators: { id: string; status?: string }[],
  faults: AssessmentFault[]
): number {
  const disabledByFault = new Set(
    faults
      .filter((f) => f.isDisabled && isOpenFault(f))
      .map((f) => f.elevatorId)
  );
  return elevators.filter(
    (e) => disabledByFault.has(e.id) || e.status === "מושבתת"
  ).length;
}

export function buildAssessmentMetrics(params: {
  faults: AssessmentFault[];
  elevators: { id: string; name: string; status?: string }[];
  now?: Date;
}): AssessmentMetrics {
  const { faults, elevators, now = new Date() } = params;

  const openFaults = faults.filter(isOpenFault);
  const doorFaultList = faults.filter(isDoorFault);
  const controlFaultList = faults.filter(isControlFault);
  const driveFaultList = faults.filter(isDriveFault);
  const rescueList = faults.filter(isRescueEvent);
  const shutdownList = faults.filter(isShutdownEvent);
  const safetyList = faults.filter(isSafetyFault);

  const faults30 = faultsInWindow(faults, 30, now).length;
  const faults60 = faultsInWindow(faults, 60, now).length;
  const faults90 = faultsInWindow(faults, 90, now).length;

  const prev30Start = now.getTime() - 60 * 24 * 60 * 60 * 1000;
  const prev30End = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const prev60Start = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  const prev60End = now.getTime() - 60 * 24 * 60 * 60 * 1000;

  const prev30Faults = faults.filter((f) => {
    const t = faultTimestamp(f);
    return t >= prev30Start && t < prev30End;
  }).length;

  const prev60Faults = faults.filter((f) => {
    const t = faultTimestamp(f);
    return t >= prev60Start && t < prev60End;
  }).length;

  const lastFault = faults.reduce<number | null>((latest, f) => {
    const t = faultTimestamp(f);
    return latest == null || t > latest ? t : latest;
  }, null);

  const daysSinceLastFault =
    lastFault == null
      ? null
      : Math.floor((now.getTime() - lastFault) / (24 * 60 * 60 * 1000));

  const totalFaults = faults.length;
  const openCount = openFaults.length;

  return {
    totalFaults,
    openFaults: openCount,
    closedFaults: faults.filter(isClosedFault).length,
    recurringFaults: countRecurringPatterns(faults),
    doorFaults: doorFaultList.length,
    controlFaults: controlFaultList.length,
    driveFaults: driveFaultList.length,
    shutdownEvents: shutdownList.length,
    rescueEvents: rescueList.length,
    safetyFaults: safetyList.length,
    availability: computeAvailability(elevators, faults),
    faults30,
    faults60,
    faults90,
    prev30Faults,
    prev60Faults,
    trend: detectTrend(faults, now),
    daysSinceLastFault,
    elevatorCount: elevators.length,
    disabledElevators: countDisabledElevators(elevators, faults),
    doorRecurringPatterns: countRecurringPatterns(faults, isDoorFault),
    doorPartialOpenFaults: faults.filter(
      (f) =>
        isDoorFault(f) &&
        (matchesMarkers(f.description, PARTIAL_DOOR_MARKERS) ||
          matchesMarkers(f.faultType, PARTIAL_DOOR_MARKERS))
    ).length,
    doorStuckFaults: faults.filter(
      (f) =>
        isDoorFault(f) &&
        matchesMarkers(f.description + f.faultType, STUCK_DOOR_MARKERS)
    ).length,
    doorAlignmentFaults: faults.filter(
      (f) =>
        isDoorFault(f) &&
        matchesMarkers(f.description + f.faultType, ALIGNMENT_MARKERS)
    ).length,
    doorWheelFaults: faults.filter(
      (f) =>
        isDoorFault(f) &&
        matchesMarkers(f.description + f.faultType, WHEEL_MARKERS)
    ).length,
    controlRecurringPatterns: countRecurringPatterns(faults, isControlFault),
    driveRecurringPatterns: countRecurringPatterns(faults, isDriveFault),
    repeatWithin14Days: hasRepeatWithinDays(faults, 14),
    avgFaultsPerMonth: faults90 > 0 ? Math.round((faults90 / 3) * 10) / 10 : 0,
    openFaultDurationDays: maxOpenFaultDays(faults, now),
    unresolvedOpenRatio:
      totalFaults > 0 ? Math.round((openCount / totalFaults) * 100) / 100 : 0,
  };
}

function mergeFaultInputs(
  faults: AssessmentFault[],
  reports: AssessmentFault[]
): AssessmentFault[] {
  if (reports.length === 0) return faults;
  const seen = new Set(
    faults.map(
      (f) =>
        `${f.elevatorId}|${f.faultType}|${f.reportedAt}|${f.description}`
    )
  );
  const merged = [...faults];
  for (const report of reports) {
    const key = `${report.elevatorId}|${report.faultType}|${report.reportedAt}|${report.description}`;
    if (!seen.has(key)) {
      merged.push(report);
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

function appendSupplementalFindings(
  metrics: AssessmentMetrics,
  findings: string[]
): string[] {
  const next = [...findings];

  if (
    metrics.faults30 > 0 &&
    !next.some((f) => f.includes("30 הימים"))
  ) {
    next.push(`נרשמו ${metrics.faults30} תקלות ב-30 הימים האחרונים.`);
  }

  if (
    metrics.openFaults === 1 &&
    metrics.recurringFaults === 0 &&
    !next.some((f) => f.includes("לא זוהו תקלות חוזרות"))
  ) {
    next.push("לא זוהו תקלות חוזרות.");
  }

  if (
    metrics.recurringFaults === 0 &&
    metrics.totalFaults > 0 &&
    metrics.openFaults !== 1 &&
    !next.some((f) => f.includes("לא זוהו תקלות חוזרות"))
  ) {
    next.push("לא זוהו תקלות חוזרות.");
  }

  if (
    metrics.trend === "stable" &&
    metrics.totalFaults > 0 &&
    !next.some((f) => f.includes("החמרה"))
  ) {
    next.push("לא זוהתה מגמת החמרה.");
  }

  if (
    metrics.openFaults > 1 &&
    !next.some((f) => f.includes("תקלות פתוחות"))
  ) {
    next.push(`קיימות ${metrics.openFaults} תקלות פתוחות.`);
  }

  return [...new Set(next)];
}

function resolveStatusAndRisk(
  highestSeverity: RuleSeverity | null
): { operationalStatus: OperationalStatus; riskLevel: RiskLevel } {
  if (!highestSeverity) {
    return { operationalStatus: "תקין", riskLevel: "נמוכה" };
  }
  return {
    operationalStatus: SEVERITY_TO_STATUS[highestSeverity],
    riskLevel: SEVERITY_TO_RISK[highestSeverity],
  };
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

  const metrics = buildAssessmentMetrics({ faults: filtered, elevators, now });
  const evaluation = evaluateProfessionalRules(metrics);

  const findings = appendSupplementalFindings(metrics, evaluation.findings);

  let conclusions = [...evaluation.conclusions];
  let recommendations = [...evaluation.recommendations];

  if (
    filtered.length > 0 &&
    conclusions.length === 0 &&
    metrics.openFaults !== 1
  ) {
    conclusions.push(
      "בהתבסס על הנתונים שנאספו, נדרש מעקב מתמשך על מצב המעליות."
    );
  }

  if (
    filtered.length > 0 &&
    recommendations.length === 0 &&
    metrics.openFaults !== 1
  ) {
    recommendations.push("המשך מעקב שוטף.");
  }

  const { operationalStatus, riskLevel } = resolveStatusAndRisk(
    evaluation.highestSeverity
  );

  return {
    buildingId,
    buildingName,
    operationalStatus,
    riskLevel,
    findings,
    conclusions: [...new Set(conclusions)],
    recommendations: [...new Set(recommendations)],
    activatedRules: evaluation.activatedRules,
    metrics: {
      totalFaults: metrics.totalFaults,
      openFaults: metrics.openFaults,
      closedFaults: metrics.closedFaults,
      recurringFaults: metrics.recurringFaults,
      doorFaults: metrics.doorFaults,
      controlFaults: metrics.controlFaults,
      driveFaults: metrics.driveFaults,
      shutdownEvents: metrics.shutdownEvents,
      rescueEvents: metrics.rescueEvents,
      availability: metrics.availability,
    },
  };
}

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

export function getRuleSeverityClasses(severity: RuleSeverity): {
  bg: string;
  text: string;
  border: string;
} {
  switch (severity) {
    case "info":
      return {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
      };
    case "low":
      return {
        bg: "bg-sky-50",
        text: "text-sky-800",
        border: "border-sky-200",
      };
    case "medium":
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        border: "border-amber-200",
      };
    case "high":
      return {
        bg: "bg-orange-50",
        text: "text-orange-900",
        border: "border-orange-200",
      };
    case "critical":
      return {
        bg: "bg-red-50",
        text: "text-red-800",
        border: "border-red-200",
      };
  }
}
