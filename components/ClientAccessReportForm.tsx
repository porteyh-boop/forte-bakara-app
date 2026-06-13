"use client";

import { useMemo, useState } from "react";
import { faultTypes } from "@/lib/data";
import {
  buildFaultFromSubmission,
  getSubmittedReports,
  isReportFormValid,
  saveSubmittedReport,
} from "@/lib/report-storage";
import type { Elevator, FaultType } from "@/lib/types";
import ReportImagePicker from "@/components/ReportImagePicker";
import {
  REPORT_MAINTENANCE_RESPONSIBILITY,
  REPORT_SAVED_HEADLINE,
  REPORT_SAVED_INFO,
} from "@/lib/pilot-copy";
import { saveClientPortalFault } from "@/lib/client-portal";
import type { ReportImageAttachment } from "@/lib/report-image";

interface ClientAccessReportFormProps {
  buildingId: string;
  buildingName: string;
  elevators: Elevator[];
  lockedElevatorId?: string | null;
  allowImageUpload?: boolean;
  onSubmitted?: () => void;
  onSubmitSuccess?: (ticketNumber: string) => void;
}

export default function ClientAccessReportForm({
  buildingId,
  buildingName,
  elevators,
  lockedElevatorId,
  allowImageUpload = true,
  onSubmitted,
  onSubmitSuccess,
}: ClientAccessReportFormProps) {
  const [elevatorId, setElevatorId] = useState(
    lockedElevatorId ?? elevators[0]?.id ?? ""
  );
  const [faultType, setFaultType] = useState("");
  const [description, setDescription] = useState("");
  const [imageAttachment, setImageAttachment] =
    useState<ReportImageAttachment | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const selectedElevator = useMemo(
    () => elevators.find((elevator) => elevator.id === elevatorId),
    [elevators, elevatorId]
  );
  const isValid = isReportFormValid(elevatorId, faultType, description);

  function resetForm() {
    setSubmitted(false);
    setTicketNumber("");
    setElevatorId(lockedElevatorId ?? elevators[0]?.id ?? "");
    setFaultType("");
    setDescription("");
    setImageAttachment(null);
    setSubmitting(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !selectedElevator || submitting) return;

    setSubmitting(true);

    const existingCount = getSubmittedReports(buildingId).length;
    const fault = buildFaultFromSubmission(
      {
        elevatorId,
        elevatorName: selectedElevator.name,
        faultType: faultType as FaultType,
        description,
        isDisabled: false,
        image: allowImageUpload ? imageAttachment : null,
      },
      existingCount
    );

    saveSubmittedReport(fault, buildingId);
    void saveClientPortalFault({
      buildingId,
      buildingName,
      elevatorId: fault.elevatorId,
      elevatorName: fault.elevatorName,
      faultType: fault.type,
      description: fault.description,
      isDisabled: Boolean(fault.isDisabled),
      status: fault.status,
      ticketNumber: fault.ticketNumber,
      imageData: fault.image?.dataUrl ?? null,
    });

    setTimeout(() => {
      const savedTicket = fault.ticketNumber ?? "";
      setTicketNumber(savedTicket);
      setSubmitted(true);
      setSubmitting(false);
      onSubmitted?.();
      onSubmitSuccess?.(savedTicket);
    }, 300);
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 text-center">
        <h3 className="text-lg font-bold text-navy">{REPORT_SAVED_HEADLINE}</h3>
        <p className="text-sm text-gray-text">{REPORT_SAVED_INFO}</p>
        {ticketNumber && (
          <p className="text-sm font-semibold text-navy">
            מספר פנייה: {ticketNumber}
          </p>
        )}
        <button type="button" onClick={resetForm} className="btn-primary w-full">
          דיווח נוסף
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4"
    >
      <div>
        <label className="text-xs text-gray-text">מעלית</label>
        <select
          value={elevatorId}
          onChange={(e) => setElevatorId(e.target.value)}
          className="form-input mt-1"
          disabled={Boolean(lockedElevatorId) || elevators.length <= 1}
          required
        >
          {elevators.map((elevator) => (
            <option key={elevator.id} value={elevator.id}>
              {elevator.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-text">סוג תקלה</label>
        <select
          value={faultType}
          onChange={(e) => setFaultType(e.target.value)}
          className="form-input mt-1"
          required
        >
          <option value="">בחרו סוג תקלה</option>
          {faultTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-gray-text">תיאור התקלה</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input mt-1 min-h-[6rem]"
          placeholder="תארו את התקלה בקצרה"
          required
        />
      </div>

      {allowImageUpload && (
        <ReportImagePicker
          attachment={imageAttachment}
          onChange={setImageAttachment}
        />
      )}

      <p className="text-xs text-gray-text">{REPORT_MAINTENANCE_RESPONSIBILITY}</p>

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="btn-primary w-full disabled:opacity-50"
      >
        {submitting ? "שולח..." : "שליחת דיווח"}
      </button>
    </form>
  );
}
