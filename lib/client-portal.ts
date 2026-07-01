import { isClosedFault, isOpenFault } from "./fault-lifecycle";
import { getEffectiveElevators } from "./elevator-status";
import { logClientActivity } from "./client-permissions";
import {
  savePilotFault,
  type SavePilotFaultInput,
} from "./pilot-cloud";
import { safePercent } from "./utils";
import type { Elevator, Fault } from "./types";

export const CLIENT_PORTAL_FAULT_SOURCE = "Client Portal";

export const CLIENT_PORTAL_ACTIVITY = {
  LOGIN: "LOGIN",
  OPEN_FAULT: "OPEN_FAULT",
  VIEW_FAULTS: "VIEW_FAULTS",
  VIEW_DOCUMENTS: "VIEW_DOCUMENTS",
  VIEW_AVAILABILITY: "VIEW_AVAILABILITY",
  SUBMIT_FEEDBACK: "SUBMIT_FEEDBACK",
  LOGOUT: "LOGOUT",
} as const;

export type ClientPortalActivityType =
  (typeof CLIENT_PORTAL_ACTIVITY)[keyof typeof CLIENT_PORTAL_ACTIVITY];

export interface ClientPortalStats {
  elevatorCount: number;
  openFaultCount: number;
  closedFaultCount: number;
  monthlyAvailabilityPercent: number;
}

export function computeClientPortalStats(
  elevators: Elevator[],
  faults: Fault[]
): ClientPortalStats {
  const openFaultCount = faults.filter((fault) => isOpenFault(fault)).length;
  const closedFaultCount = faults.filter((fault) => isClosedFault(fault)).length;
  const now = new Date();
  const monthFaults = faults.filter((fault) => {
    const date = new Date(fault.reportedAt);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
  const activeFaults = faults.filter((fault) => !isClosedFault(fault));
  const effectiveElevators = getEffectiveElevators(elevators, activeFaults);
  const activeElevators = effectiveElevators.filter(
    (elevator) => elevator.status === "פעילה"
  ).length;
  const monthlyAvailabilityPercent = safePercent(
    activeElevators,
    elevators.length || 1
  );

  void monthFaults;

  return {
    elevatorCount: elevators.length,
    openFaultCount,
    closedFaultCount,
    monthlyAvailabilityPercent,
  };
}

export async function logClientPortalActivity(
  clientUserId: string,
  actionType: ClientPortalActivityType,
  actionDetails?: string | null
): Promise<boolean> {
  return logClientActivity(clientUserId, actionType, actionDetails ?? null);
}

export async function saveClientPortalFault(
  input: SavePilotFaultInput
): Promise<boolean> {
  const saved = await savePilotFault({
    ...input,
    faultSource: CLIENT_PORTAL_FAULT_SOURCE,
  });
  return Boolean(saved);
}
