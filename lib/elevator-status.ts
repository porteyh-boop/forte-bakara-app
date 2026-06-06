import {
  faultIndicatesDisabledElevator,
  isClosedFault,
} from "./fault-lifecycle";
import type { Elevator, Fault, Status } from "./types";

export { isOpenFault, faultIndicatesDisabledElevator } from "./fault-lifecycle";

export function getActiveFaultsForElevator(
  elevatorId: string,
  faults: Fault[]
): Fault[] {
  return faults.filter(
    (f) => f.elevatorId === elevatorId && !isClosedFault(f)
  );
}

/** @deprecated Use getActiveFaultsForElevator */
export function getOpenFaultsForElevator(
  elevatorId: string,
  faults: Fault[]
): Fault[] {
  return getActiveFaultsForElevator(elevatorId, faults);
}

/**
 * סטטוס מעלית מחושב בזמן אמת מתוך תקלות פעילות בלבד.
 * לא משתמש בסטטוס סטטי מנתוני דמו (buildings.ts).
 */
export function getEffectiveElevatorStatus(
  _elevator: Elevator,
  activeFaults: Fault[],
  elevatorId: string
): Status {
  const faultsForElevator = getActiveFaultsForElevator(
    elevatorId,
    activeFaults
  );

  if (faultsForElevator.some(faultIndicatesDisabledElevator)) {
    return "מושבתת";
  }

  if (faultsForElevator.some((f) => f.status === "בטיפול")) {
    return "בטיפול";
  }

  return "פעילה";
}

export function getEffectiveElevators(
  elevators: Elevator[],
  activeFaults: Fault[]
): Elevator[] {
  return elevators.map((elevator) => ({
    ...elevator,
    status: getEffectiveElevatorStatus(
      elevator,
      activeFaults,
      elevator.id
    ),
  }));
}

/** סטטוס כללי של בניין לפי מעליות מחושבות בזמן אמת */
export function getBuildingAggregateStatus(elevators: Elevator[]): Status {
  if (elevators.some((e) => e.status === "מושבתת")) return "מושבתת";
  if (elevators.some((e) => e.status === "בטיפול")) return "בטיפול";
  return "פעילה";
}

/** מונה מעליות מושבתות — ללא כפילות לפי מזהה מעלית */
export function getDisabledElevatorCount(
  elevators: Elevator[],
  activeFaults: Fault[]
): number {
  return getEffectiveElevators(elevators, activeFaults).filter(
    (e) => e.status === "מושבתת"
  ).length;
}
