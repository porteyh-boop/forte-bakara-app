import { hoursBetween } from "./utils";
import type { Fault, FaultStatus } from "./types";

/** סטטוס מחזור חיים — תצוגה ולוגיקה */
export type FaultLifecycleStatus = "פתוחה" | "בטיפול" | "סגורה";

const OPEN_STATUSES = new Set<FaultStatus>([
  "פתוחה",
  "פעילה",
  "בטיפול",
  "מושבתת",
]);

const CLOSED_STATUSES = new Set<FaultStatus>(["סגורה", "טופלה"]);

export function isOpenFault(fault: Fault): boolean {
  return OPEN_STATUSES.has(fault.status);
}

/** תקלה פעילה (לא סגורה) שמשפיעה על סטטוס מעלית */
export function isActiveFaultForElevatorStatus(fault: Fault): boolean {
  return !isClosedFault(fault);
}

/**
 * מעלית מושבתת רק אם יש תקלה פעילה (לא סגורה) עם isDisabled === true.
 * status === "סגורה" / "טופלה" — לא משפיעים, גם אם isDisabled נשאר true.
 */
export function faultIndicatesDisabledElevator(fault: Fault): boolean {
  if (fault.status === "סגורה" || isClosedFault(fault)) return false;
  return fault.isDisabled === true;
}

export function isClosedFault(fault: Fault): boolean {
  return CLOSED_STATUSES.has(fault.status);
}

export function getLifecycleStatus(fault: Fault): FaultLifecycleStatus {
  if (isClosedFault(fault)) return "סגורה";
  if (fault.status === "בטיפול") return "בטיפול";
  return "פתוחה";
}

export function buildClosedFault(
  fault: Fault,
  closedAt: Date = new Date()
): Fault {
  const resolvedAt = closedAt.toISOString();
  const durationHours =
    Math.round(hoursBetween(fault.reportedAt, resolvedAt) * 10) / 10;

  return {
    ...fault,
    status: "סגורה",
    resolvedAt,
    durationHours,
    isDisabled: false,
  };
}

export function getFaultOpenDurationHours(fault: Fault): number | null {
  if (isClosedFault(fault) && fault.resolvedAt) {
    return (
      fault.durationHours ??
      Math.round(hoursBetween(fault.reportedAt, fault.resolvedAt) * 10) / 10
    );
  }
  if (isOpenFault(fault)) {
    return Math.round(hoursBetween(fault.reportedAt, new Date().toISOString()) * 10) / 10;
  }
  return null;
}
