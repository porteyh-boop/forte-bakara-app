import { getBuildingLiveStartedAt } from "./buildings-cloud";
import {
  getPilotFaultsForBuilding,
  isPilotCloudConfigured,
  type PilotCloudFault,
} from "./pilot-cloud";
import {
  filterFaultsForLiveStart,
  isAfterLiveStart,
  resolveLiveStartedAt,
  setCachedLiveStartedAt,
} from "./building-live";
import {
  getSubmittedReports,
  saveSubmittedReports,
} from "./report-storage";
import type { Fault, FaultType } from "./types";

/** חלון המתנה לדיווח שנשלח לענן וטרם הופיע ב-Supabase */
export const PENDING_CLOUD_SYNC_MS = 120_000;

function toFaultType(value: string): FaultType {
  const allowed: FaultType[] = [
    "תקועה בין קומות",
    "רעש חריג",
    "דלת לא נסגרת",
    "תאורה לא עובדת",
    "כפתורים לא מגיבים",
    "אחר",
  ];
  return allowed.includes(value as FaultType) ? (value as FaultType) : "אחר";
}

export function mapPilotCloudFaultToFault(cloud: PilotCloudFault): Fault {
  const ticketNumber = cloud.ticket_number ?? undefined;
  return {
    id: ticketNumber ? `user-${ticketNumber}` : `cloud-${cloud.id}`,
    ticketNumber,
    elevatorId: cloud.elevator_id,
    elevatorName: cloud.elevator_name,
    type: toFaultType(cloud.fault_type),
    description: cloud.description,
    status: cloud.status as Fault["status"],
    priority: cloud.is_disabled ? "דחופה" : "רגילה",
    reportedAt: cloud.created_at,
    reportedBy: "דייר / ועד בית",
    isUserSubmitted: true,
    isDisabled: cloud.is_disabled,
    resolvedAt: cloud.closed_at ?? undefined,
    ...(cloud.image_url || cloud.image_data
      ? {
          image: {
            dataUrl: cloud.image_url ?? cloud.image_data!,
            name: cloud.image_url
              ? cloud.image_url.split("/").pop() ?? "report-image"
              : "report-image",
            sizeBytes: cloud.image_data?.length ?? 0,
            mimeType: cloud.image_url ? "image/jpeg" : "image/jpeg",
          },
        }
      : {}),
  };
}

function enrichFaultFromLocal(cloudFault: Fault, localReports: Fault[]): Fault {
  if (cloudFault.image) return cloudFault;
  const local = localReports.find(
    (item) =>
      item.ticketNumber &&
      cloudFault.ticketNumber &&
      item.ticketNumber === cloudFault.ticketNumber
  );
  if (local?.image) {
    return { ...cloudFault, image: local.image };
  }
  return cloudFault;
}

function isPendingLocalReport(
  report: Fault,
  now: number,
  liveStartedAt?: string | null
): boolean {
  if (!report.isUserSubmitted || !report.ticketNumber) return false;
  if (liveStartedAt && !isAfterLiveStart(report.reportedAt, liveStartedAt)) {
    return false;
  }
  const age = now - new Date(report.reportedAt).getTime();
  return age >= 0 && age <= PENDING_CLOUD_SYNC_MS;
}

export async function resolveLiveStartedAtForBuilding(
  buildingId: string
): Promise<string | null> {
  const cached = resolveLiveStartedAt(buildingId);
  if (cached) return cached;

  if (!isPilotCloudConfigured()) return null;

  const fromCloud = await getBuildingLiveStartedAt(buildingId);
  if (fromCloud) {
    setCachedLiveStartedAt(buildingId, fromCloud);
  }
  return fromCloud;
}

export function reconcileSubmittedReportsWithCloud(params: {
  localReports: Fault[];
  cloudFaults: PilotCloudFault[];
  liveStartedAt?: string | null;
  now?: number;
}): Fault[] {
  const { localReports, cloudFaults, liveStartedAt, now = Date.now() } = params;
  const cloudMapped = cloudFaults
    .map(mapPilotCloudFaultToFault)
    .map((fault) => enrichFaultFromLocal(fault, localReports));

  const cloudTickets = new Set(
    cloudMapped.map((fault) => fault.ticketNumber).filter(Boolean)
  );

  const pendingLocal = localReports.filter(
    (report) =>
      report.ticketNumber &&
      !cloudTickets.has(report.ticketNumber) &&
      isPendingLocalReport(report, now, liveStartedAt)
  );

  const merged = [...pendingLocal, ...cloudMapped];
  return filterFaultsForLiveStart(merged, liveStartedAt).sort(
    (a, b) =>
      new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
  );
}

export async function syncSubmittedReportsWithCloud(
  buildingId: string,
  liveStartedAtOverride?: string | null
): Promise<Fault[]> {
  if (!isPilotCloudConfigured()) {
    const local = getSubmittedReports(buildingId);
    const liveStartedAt =
      liveStartedAtOverride ?? resolveLiveStartedAt(buildingId);
    return filterFaultsForLiveStart(local, liveStartedAt);
  }

  const liveStartedAt =
    liveStartedAtOverride ??
    (await resolveLiveStartedAtForBuilding(buildingId));

  const cloudFaults = await getPilotFaultsForBuilding(buildingId);
  if (cloudFaults === null) {
    return filterFaultsForLiveStart(
      getSubmittedReports(buildingId),
      liveStartedAt
    );
  }

  const localReports = getSubmittedReports(buildingId);
  const merged = reconcileSubmittedReportsWithCloud({
    localReports,
    cloudFaults,
    liveStartedAt,
  });

  saveSubmittedReports(buildingId, merged);
  return merged;
}

export async function syncAllSubmittedReportsWithCloud(
  buildingIds: string[],
  liveStartedAtByBuilding?: Record<string, string | null>
): Promise<Record<string, Fault[]>> {
  const map: Record<string, Fault[]> = {};
  await Promise.all(
    buildingIds.map(async (id) => {
      map[id] = await syncSubmittedReportsWithCloud(
        id,
        liveStartedAtByBuilding?.[id]
      );
    })
  );
  return map;
}
