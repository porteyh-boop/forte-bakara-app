import { isClosedFault, isOpenFault } from "./fault-lifecycle";
import { getEffectiveElevators } from "./elevator-status";
import { hoursBetween, safePercent } from "./utils";
import type { BuildingDataContext, Fault } from "./types";

export interface FaultLifecycleStats {
  openFaults: number;
  closedFaults: number;
  avgTreatmentHours: number;
  avgDowntimeHours: number;
  availabilityPercent: number;
  closedThisMonth: number;
  resolvedWithin24hPercent: number;
}

function isThisMonth(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  );
}

export function getFaultLifecycleStats(
  ctx: BuildingDataContext,
  faults: Fault[]
): FaultLifecycleStats {
  const openFaults = faults.filter(isOpenFault);
  const closedFaults = faults.filter(isClosedFault);
  const activeFaults = faults.filter((f) => !isClosedFault(f));

  const effectiveElevators = getEffectiveElevators(
    ctx.elevators,
    activeFaults
  );
  const activeElevators = effectiveElevators.filter(
    (e) => e.status === "פעילה"
  ).length;
  const availabilityPercent = safePercent(
    activeElevators,
    ctx.building.elevatorCount
  );

  const closedWithResolution = closedFaults.filter((f) => f.resolvedAt);
  const avgTreatmentHours =
    closedWithResolution.length > 0
      ? Math.round(
          (closedWithResolution.reduce(
            (sum, f) =>
              sum +
              (f.durationHours ??
                hoursBetween(f.reportedAt, f.resolvedAt!)),
            0
          ) /
            closedWithResolution.length) *
            10
        ) / 10
      : 0;

  const downtimeFaults = closedFaults.filter(
    (f) => (f.durationHours ?? 0) > 0 || f.isDisabled
  );
  const avgDowntimeHours =
    downtimeFaults.length > 0
      ? Math.round(
          (downtimeFaults.reduce(
            (sum, f) =>
              sum +
              (f.isDisabled
                ? f.durationHours ??
                  (f.resolvedAt
                    ? hoursBetween(f.reportedAt, f.resolvedAt)
                    : 0)
                : f.downtimeHours ?? 0),
            0
          ) /
            downtimeFaults.length) *
            10
        ) / 10
      : avgTreatmentHours;

  const now = new Date();
  const closedThisMonth = closedFaults.filter(
    (f) => f.resolvedAt && isThisMonth(f.resolvedAt, now)
  ).length;

  const resolvedWithin24h =
    closedWithResolution.length > 0
      ? closedWithResolution.filter(
          (f) =>
            (f.durationHours ??
              hoursBetween(f.reportedAt, f.resolvedAt!)) <= 24
        ).length
      : 0;
  const resolvedWithin24hPercent = safePercent(
    resolvedWithin24h,
    closedWithResolution.length
  );

  return {
    openFaults: openFaults.length,
    closedFaults: closedFaults.length,
    avgTreatmentHours,
    avgDowntimeHours,
    availabilityPercent,
    closedThisMonth,
    resolvedWithin24hPercent,
  };
}
