import { isClosedFault, isOpenFault } from "./fault-lifecycle";
import type { Elevator, Fault } from "./types";

export interface ElevatorFaultCounts {
  open: number;
  closed: number;
}

export function getElevatorFaultCounts(
  elevatorId: string,
  faults: Fault[]
): ElevatorFaultCounts {
  const forElevator = faults.filter((f) => f.elevatorId === elevatorId);
  return {
    open: forElevator.filter((f) => isOpenFault(f)).length,
    closed: forElevator.filter((f) => isClosedFault(f)).length,
  };
}

export function getAllElevatorFaultCounts(
  elevators: Elevator[],
  faults: Fault[]
): Record<string, ElevatorFaultCounts> {
  const counts: Record<string, ElevatorFaultCounts> = {};
  for (const elevator of elevators) {
    counts[elevator.id] = getElevatorFaultCounts(elevator.id, faults);
  }
  return counts;
}
