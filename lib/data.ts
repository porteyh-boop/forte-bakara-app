/**
 * פונקציות נתונים לפי בניין — נתוני דמו בלבד.
 */
import {
  DEFAULT_BUILDING_ID,
  faultTypes,
  getAllBuildingIds,
  getBuildingDataset,
} from "./buildings";
import {
  getBuildingAggregateStatus,
  getDisabledElevatorCount,
  getEffectiveElevators,
  isOpenFault,
} from "./elevator-status";
import { isClosedFault } from "./fault-lifecycle";
import { filterFaultsForLiveStart } from "./building-live";
import { mergeAllFaults, mergeFaults } from "./report-storage";
import type {
  BuildingDataContext,
  BuildingListItem,
  BuildingStatusTone,
  Fault,
  Status,
} from "./types";
import { hoursBetween, safePercent } from "./utils";

export { faultTypes, DEFAULT_BUILDING_ID, getBuildingDataset };

const ACTIVE_FAULT_STATUSES = ["פעילה", "בטיפול", "מושבתת"] as const;

function resolveCtx(ctxOrId?: BuildingDataContext | string): BuildingDataContext {
  if (typeof ctxOrId === "string") return getBuildingDataset(ctxOrId);
  if (ctxOrId) return ctxOrId;
  return getBuildingDataset(DEFAULT_BUILDING_ID);
}

/** תאימות לאחור — ברירת מחדל: מגדל פורטה */
const defaultCtx = () => getBuildingDataset(DEFAULT_BUILDING_ID);
export const building = defaultCtx().building;
export const elevators = defaultCtx().elevators;
export const faults = defaultCtx().faults;
export const ACTIVE_FAULT_DOWNTIME = defaultCtx().activeFaultDowntime;

function getAllFaults(
  ctx: BuildingDataContext,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true,
  liveStartedAt: string | null = null
): Fault[] {
  const demoFaults = filterFaultsForLiveStart(ctx.faults, liveStartedAt);
  const liveSubmitted = filterFaultsForLiveStart(submitted, liveStartedAt);
  return buildingId
    ? mergeAllFaults(
        demoFaults,
        liveSubmitted,
        buildingId,
        storageReady ? undefined : null
      )
    : mergeFaults(demoFaults, liveSubmitted);
}

function getMergedOpenFaults(
  ctx: BuildingDataContext,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true,
  liveStartedAt: string | null = null
): Fault[] {
  return getAllFaults(
    ctx,
    submitted,
    buildingId,
    storageReady,
    liveStartedAt
  )
    .filter((f) => isOpenFault(f))
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
}

export function getOpenFaults(
  ctxOrId?: BuildingDataContext | string,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true
) {
  const ctx = resolveCtx(ctxOrId);
  return getMergedOpenFaults(ctx, submitted, buildingId, storageReady);
}

/** מיזוג נתוני דמו + דיווחי localStorage — סטטוס מעליות בזמן אמת */
function buildListStatusMeta(
  buildingStatus: Status,
  disabledElevatorCount: number,
  openFaultCount: number
): { statusLabel: string; statusTone: BuildingStatusTone } {
  if (buildingStatus === "מושבתת") {
    return {
      statusLabel:
        disabledElevatorCount === 1
          ? "מעלית מושבתת"
          : `${disabledElevatorCount} מעליות מושבתות`,
      statusTone: "alert",
    };
  }
  if (buildingStatus === "בטיפול") {
    return {
      statusLabel:
        openFaultCount > 0
          ? `${openFaultCount} תקלות בטיפול`
          : "בטיפול",
      statusTone: "warning",
    };
  }
  if (openFaultCount > 0) {
    return {
      statusLabel:
        openFaultCount === 1
          ? "תקלה פתוחה אחת"
          : `${openFaultCount} תקלות פתוחות`,
      statusTone: "warning",
    };
  }
  return { statusLabel: "יציב", statusTone: "good" };
}

function resolveClosuresOverride(
  buildingId: string,
  storageReady: boolean,
  closuresByBuilding?: Record<string, Record<string, Fault>>
): Record<string, Fault> | null | undefined {
  if (!storageReady) return null;
  if (closuresByBuilding && buildingId in closuresByBuilding) {
    return closuresByBuilding[buildingId];
  }
  return undefined;
}

/** סיכום חי לכל הבניינים — כולל דיווחים וסגירות מ-localStorage */
export function getLiveBuildingListItems(
  reportsByBuilding: Record<string, Fault[]> = {},
  storageReady = true,
  closuresByBuilding?: Record<string, Record<string, Fault>>,
  liveStartedAtByBuilding: Record<string, string | null> = {}
): BuildingListItem[] {
  return getAllBuildingIds().map((id) => {
    const ctx = getBuildingDataset(id);
    const liveStartedAt = liveStartedAtByBuilding[id] ?? null;
    const submitted = filterFaultsForLiveStart(
      reportsByBuilding[id] ?? [],
      liveStartedAt
    );
    const demoFaults = filterFaultsForLiveStart(ctx.faults, liveStartedAt);
    const closuresOverride = resolveClosuresOverride(
      id,
      storageReady,
      closuresByBuilding
    );
    const allFaults = mergeAllFaults(
      demoFaults,
      submitted,
      id,
      closuresOverride
    );
    const activeFaults = allFaults.filter((f) => !isClosedFault(f));
    const effectiveElevators = getEffectiveElevators(
      ctx.elevators,
      activeFaults
    );
    const openFaultsList = allFaults
      .filter((f) => isOpenFault(f))
      .sort(
        (a, b) =>
          new Date(b.reportedAt).getTime() -
          new Date(a.reportedAt).getTime()
      );
    const stats = {
      totalFaults: allFaults.length,
      openFaults: openFaultsList.length,
      closedFaults: allFaults.filter((f) => isClosedFault(f)).length,
      disabledElevators: effectiveElevators.filter(
        (e) => e.status === "מושבתת"
      ).length,
      effectiveElevators,
    };
    const buildingStatus = getBuildingAggregateStatus(stats.effectiveElevators);
    const { statusLabel, statusTone } = buildListStatusMeta(
      buildingStatus,
      stats.disabledElevators,
      stats.openFaults
    );

    return {
      id: ctx.id,
      buildingCode: ctx.building.buildingCode,
      name: ctx.building.name,
      address: ctx.building.address,
      city: ctx.building.city,
      elevatorCount: ctx.building.elevatorCount,
      faultCount: stats.totalFaults,
      openFaultCount: stats.openFaults,
      closedFaultCount: stats.closedFaults,
      disabledElevatorCount: stats.disabledElevators,
      buildingStatus,
      statusLabel,
      statusTone,
    };
  });
}

export function buildRuntimeBuildingContext(
  ctx: BuildingDataContext,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true,
  liveStartedAt: string | null = null
): BuildingDataContext {
  const allFaults = getAllFaults(
    ctx,
    submitted,
    buildingId,
    storageReady,
    liveStartedAt
  );
  const activeFaults = allFaults.filter((f) => !isClosedFault(f));
  return {
    ...ctx,
    faults: allFaults,
    elevators: getEffectiveElevators(ctx.elevators, activeFaults),
  };
}

export function getDashboardStats(
  ctxOrId?: BuildingDataContext | string,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true
) {
  const ctx = resolveCtx(ctxOrId);
  const now = new Date();
  const allFaults = getAllFaults(ctx, submitted, buildingId, storageReady);
  const openFaultsList = getMergedOpenFaults(
    ctx,
    submitted,
    buildingId,
    storageReady
  );
  const activeFaults = allFaults.filter((f) => !isClosedFault(f));
  const monthFaults = allFaults.filter((f) => {
    const date = new Date(f.reportedAt);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;
  const disabledElevators = getDisabledElevatorCount(
    ctx.elevators,
    activeFaults
  );

  return {
    elevatorCount: ctx.building.elevatorCount,
    openFaults: openFaultsList.length,
    monthFaults,
    disabledElevators,
  };
}

export function getClientStats(
  ctxOrId?: BuildingDataContext | string,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true
) {
  const ctx = resolveCtx(ctxOrId);
  const allFaults = getAllFaults(ctx, submitted, buildingId, storageReady);
  const openFaultsList = getMergedOpenFaults(
    ctx,
    submitted,
    buildingId,
    storageReady
  );
  const activeFaults = allFaults.filter((f) => !isClosedFault(f));
  const effectiveElevators = getEffectiveElevators(
    ctx.elevators,
    activeFaults
  );
  const activeElevators = effectiveElevators.filter(
    (e) => e.status === "פעילה"
  ).length;
  const disabledElevators = effectiveElevators.filter(
    (e) => e.status === "מושבתת"
  ).length;
  const availability = safePercent(
    activeElevators,
    ctx.building.elevatorCount
  );

  return {
    totalFaults: allFaults.length,
    openFaults: openFaultsList.length,
    closedFaults: allFaults.filter((f) => isClosedFault(f)).length,
    availability,
    activeElevators,
    disabledElevators,
    elevatorCount: ctx.building.elevatorCount,
    effectiveElevators,
  };
}

export function getFaultsByType(ctxOrId?: BuildingDataContext | string) {
  const ctx = resolveCtx(ctxOrId);
  const counts = new Map<string, number>();
  for (const fault of ctx.faults) {
    counts.set(fault.type, (counts.get(fault.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function getMonthlyFaultTrend(ctxOrId?: BuildingDataContext | string) {
  const ctx = resolveCtx(ctxOrId);
  const now = new Date();
  const trend: { month: string; count: number }[] = [];

  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = ctx.faults.filter((f) => {
      const fd = new Date(f.reportedAt);
      return (
        fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear()
      );
    }).length;
    trend.push({
      month: new Intl.DateTimeFormat("he-IL", { month: "short" }).format(d),
      count,
    });
  }

  return trend;
}

export function getMonthlyOperationalReport(
  ctxOrId?: BuildingDataContext | string,
  submitted: Fault[] = [],
  buildingId?: string,
  storageReady = true
) {
  const ctx = resolveCtx(ctxOrId);
  const now = new Date();
  const monthFaults = getAllFaults(
    ctx,
    submitted,
    buildingId,
    storageReady
  ).filter((f) => {
    const date = new Date(f.reportedAt);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
  const closedThisMonth = monthFaults.filter((f) => isClosedFault(f)).length;
  const openThisMonth = monthFaults.filter((f) => isOpenFault(f)).length;
  const allFaultsForReport = getAllFaults(
    ctx,
    submitted,
    buildingId,
    storageReady
  );
  const activeFaultsForReport = allFaultsForReport.filter(
    (f) => !isClosedFault(f)
  );
  const activeElevators = getEffectiveElevators(
    ctx.elevators,
    activeFaultsForReport
  ).filter((e) => e.status === "פעילה").length;
  const availability = safePercent(
    activeElevators,
    ctx.building.elevatorCount
  );

  const closedWithResolution = monthFaults.filter(
    (f) => isClosedFault(f) && f.resolvedAt
  );
  const avgResolutionDays =
    closedWithResolution.length > 0
      ? Math.round(
          (closedWithResolution.reduce(
            (s, f) => s + hoursBetween(f.reportedAt, f.resolvedAt!) / 24,
            0
          ) /
            closedWithResolution.length) *
            10
        ) / 10
      : 0;

  return {
    month: new Intl.DateTimeFormat("he-IL", {
      month: "long",
      year: "numeric",
    }).format(now),
    totalReported: monthFaults.length,
    closed: closedThisMonth,
    open: openThisMonth,
    availability,
    avgResolutionDays,
    reportsSubmitted: monthFaults.length,
  };
}
