import { buildClosedFault } from "./fault-lifecycle";
import { DEFAULT_BUILDING_ID } from "./buildings";
import type { ReportImageAttachment } from "./report-image";
import type { Fault, FaultType } from "./types";

export const REPORTS_STORAGE_PREFIX = "forte-submitted-reports";
export const CLOSURES_STORAGE_PREFIX = "forte-fault-closures";
/** @deprecated Use getReportsStorageKey(buildingId) */
export const REPORTS_STORAGE_KEY = `${REPORTS_STORAGE_PREFIX}-${DEFAULT_BUILDING_ID}`;

export function getReportsStorageKey(buildingId: string): string {
  return `${REPORTS_STORAGE_PREFIX}-${buildingId}`;
}

export function getClosuresStorageKey(buildingId: string): string {
  return `${CLOSURES_STORAGE_PREFIX}-${buildingId}`;
}

export interface ReportSubmissionInput {
  elevatorId: string;
  elevatorName: string;
  faultType: FaultType;
  description: string;
  isDisabled: boolean;
  image?: ReportImageAttachment | null;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function generateTicketNumber(existingCount: number): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `FB-${date}-${String(existingCount + 1).padStart(4, "0")}`;
}

export function buildFaultFromSubmission(
  input: ReportSubmissionInput,
  existingCount: number
): Fault {
  const ticketNumber = generateTicketNumber(existingCount);
  return {
    id: `user-${ticketNumber}`,
    ticketNumber,
    elevatorId: input.elevatorId,
    elevatorName: input.elevatorName,
    type: input.faultType,
    description: input.description.trim(),
    status: input.isDisabled ? "מושבתת" : "פתוחה",
    priority: input.isDisabled ? "דחופה" : "רגילה",
    reportedAt: new Date().toISOString(),
    reportedBy: "דייר / ועד בית",
    isUserSubmitted: true,
    isDisabled: input.isDisabled,
    ...(input.image ? { image: input.image } : {}),
  };
}

export function getSubmittedReports(buildingId: string): Fault[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(getReportsStorageKey(buildingId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Fault[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getFaultClosures(
  buildingId: string
): Record<string, Fault> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(getClosuresStorageKey(buildingId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Fault>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveFaultClosures(
  buildingId: string,
  closures: Record<string, Fault>
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    getClosuresStorageKey(buildingId),
    JSON.stringify(closures)
  );
}

export function saveSubmittedReports(
  buildingId: string,
  reports: Fault[]
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    getReportsStorageKey(buildingId),
    JSON.stringify(reports)
  );
}

export function saveSubmittedReport(fault: Fault, buildingId: string): void {
  if (!isBrowser()) return;
  const existing = getSubmittedReports(buildingId);
  localStorage.setItem(
    getReportsStorageKey(buildingId),
    JSON.stringify([fault, ...existing])
  );
  notifyFaultsUpdated(buildingId);
}

export function applyFaultClosures(
  faults: Fault[],
  buildingId: string,
  closuresOverride?: Record<string, Fault> | null
): Fault[] {
  if (closuresOverride === null) return faults;
  const closures = closuresOverride ?? getFaultClosures(buildingId);
  return faults.map((fault) => closures[fault.id] ?? fault);
}

export function mergeFaults(baseFaults: Fault[], submitted: Fault[]): Fault[] {
  const submittedIds = new Set(submitted.map((f) => f.id));
  const base = baseFaults.filter((f) => !submittedIds.has(f.id));
  return [...submitted, ...base];
}

export function mergeAllFaults(
  baseFaults: Fault[],
  submitted: Fault[],
  buildingId: string,
  closuresOverride?: Record<string, Fault> | null
): Fault[] {
  return applyFaultClosures(
    mergeFaults(baseFaults, submitted),
    buildingId,
    closuresOverride
  );
}

export function closeFault(fault: Fault, buildingId: string): Fault {
  const closed = buildClosedFault(fault);

  if (fault.isUserSubmitted) {
    const reports = getSubmittedReports(buildingId);
    const updated = reports.map((r) => (r.id === fault.id ? closed : r));
    saveSubmittedReports(buildingId, updated);
  } else {
    const closures = getFaultClosures(buildingId);
    closures[fault.id] = closed;
    saveFaultClosures(buildingId, closures);
  }

  notifyFaultsUpdated(buildingId);
  return closed;
}

export function notifyFaultsUpdated(buildingId?: string): void {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent("forte-reports-updated", {
      detail: buildingId ? { buildingId } : undefined,
    })
  );
}

export function isReportFormValid(
  elevatorId: string,
  faultType: string,
  description: string
): boolean {
  return Boolean(
    elevatorId && faultType && description.trim().length >= 10
  );
}
