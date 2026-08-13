import type { FaultNotificationDispatchInput } from "./fault-notifications";

/**
 * Fire-and-forget fault notification dispatch.
 * Never throws — fault DB operations must not depend on notification success.
 */
export function dispatchFaultNotification(
  input: FaultNotificationDispatchInput
): void {
  if (typeof window === "undefined") return;

  void fetch("/api/fault-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  }).catch((error) => {
    console.warn(
      "[fault-notification-client] dispatch failed:",
      error instanceof Error ? error.message : String(error)
    );
  });
}

export function pilotFaultToNotificationInput(
  fault: {
    id: string;
    building_id: string;
    building_name: string;
    elevator_name: string;
    fault_type: string;
    description: string;
    ticket_number: string | null;
    created_at: string;
    fault_source: string | null;
    is_disabled: boolean;
    image_data: string | null;
    image_url: string | null;
    treatment_note?: string | null;
    closure_note?: string | null;
    status?: string;
  },
  eventType: FaultNotificationDispatchInput["eventType"]
): FaultNotificationDispatchInput {
  return {
    faultId: fault.id,
    buildingId: fault.building_id,
    eventType,
    ticketNumber: fault.ticket_number ?? fault.id,
    buildingName: fault.building_name,
    elevatorName: fault.elevator_name,
    faultType: fault.fault_type,
    description: fault.description,
    createdAt: fault.created_at,
    faultSource: fault.fault_source,
    isDisabled: fault.is_disabled,
    hasImage: Boolean(fault.image_data || fault.image_url),
    treatmentNote: fault.treatment_note ?? null,
    closureNote: fault.closure_note ?? null,
    status: fault.status,
  };
}
