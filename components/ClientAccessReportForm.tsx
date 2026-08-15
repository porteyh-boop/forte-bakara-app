"use client";

import { useMemo, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import { faultTypes } from "@/lib/data";
import {
  buildFaultFromSubmission,
  getSubmittedReports,
  isReportFormValid,
  trySaveSubmittedReport,
} from "@/lib/report-storage";
import type { Elevator, FaultType } from "@/lib/types";
import ReportImagePicker from "@/components/ReportImagePicker";
import {
  CLIENT_PORTAL_FAULT_SUBMIT_ERROR,
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
  const { guardSensitiveAction } = useAppVersion();
  const [elevatorId, setElevatorId] = useState(
    lockedElevatorId ?? elevators[0]?.id ?? ""
  );
  const [faultType, setFaultType] = useState("");
  const [description, setDescription] = useState("");
  const [imageAttachment, setImageAttachment] =
    useState<ReportImageAttachment | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState("");

  const selectedElevator = useMemo(
    () => elevators.find((elevator) => elevator.id === elevatorId),
    [elevators, elevatorId]
  );
  const isValid = isReportFormValid(elevatorId, faultType, description);

  function resetForm() {
    setSubmitted(false);
    setTicketNumber("");
    setSubmitError(null);
    setElevatorId(lockedElevatorId ?? elevators[0]?.id ?? "");
    setFaultType("");
    setDescription("");
    setImageAttachment(null);
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !selectedElevator || submitting) return;
    if (!guardSensitiveAction()) return;

    setSubmitting(true);
    setSubmitError(null);

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

    try {
      const result = await saveClientPortalFault({
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

      if (!result.ok) {
        setSubmitError(CLIENT_PORTAL_FAULT_SUBMIT_ERROR);
        return;
      }

      trySaveSubmittedReport(fault, buildingId);

      const savedTicket =
        result.fault.ticket_number ?? fault.ticketNumber ?? "";
      setTicketNumber(savedTicket);
      setSubmitted(true);
      onSubmitted?.();
      onSubmitSuccess?.(savedTicket);
    } catch {
      setSubmitError(CLIENT_PORTAL_FAULT_SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
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
      onSubmit={(e) => void handleSubmit(e)}
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4"
    >
      <div>
        <label className="text-xs text-gray-text">מעלית</label>
        <select
          value={elevatorId}
          onChange={(e) => setElevatorId(e.target.value)}
          className="form-input mt-1"
          disabled={
            submitting || Boolean(lockedElevatorId) || elevators.length <= 1
          }
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
          disabled={submitting}
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
          disabled={submitting}
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

      {submitError && (
        <p
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
          role="alert"
        >
          {submitError}
        </p>
      )}

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
