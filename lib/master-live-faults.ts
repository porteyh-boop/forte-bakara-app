import { filterPilotFaultsForLiveStart } from "./building-live";
import type { PilotCloudFault } from "./pilot-cloud";
import type { Fault } from "./types";

export function mapDemoFaultToPilot(
  fault: Fault,
  buildingId: string,
  buildingName: string
): PilotCloudFault {
  return {
    id: fault.id,
    building_id: buildingId,
    building_name: buildingName,
    elevator_id: fault.elevatorId,
    elevator_name: fault.elevatorName,
    fault_type: fault.type,
    description: fault.description,
    is_disabled: fault.isDisabled ?? false,
    status: fault.status,
    ticket_number: fault.ticketNumber ?? null,
    image_data: null,
    image_url: null,
    created_at: fault.reportedAt,
    closed_at: fault.resolvedAt ?? null,
    source_device_id: null,
    fault_source: null,
    treatment_note: null,
    closure_note: null,
    treatment_started_at: null,
  };
}

export function mergeMasterBuildingPilotFaults(params: {
  cloudFaults: PilotCloudFault[];
  buildingId: string;
  buildingName: string;
  demoFaults?: Fault[];
  liveStartedAt: string | null | undefined;
}): PilotCloudFault[] {
  const {
    cloudFaults,
    buildingId,
    buildingName,
    demoFaults = [],
    liveStartedAt,
  } = params;

  let merged = cloudFaults.filter((f) => f.building_id === buildingId);

  if (!liveStartedAt && demoFaults.length > 0) {
    const seen = new Set(merged.map((f) => f.id));
    for (const fault of demoFaults) {
      const pilot = mapDemoFaultToPilot(fault, buildingId, buildingName);
      if (!seen.has(pilot.id)) {
        merged.push(pilot);
        seen.add(pilot.id);
      }
    }
  }

  return filterPilotFaultsForLiveStart(merged, liveStartedAt);
}
