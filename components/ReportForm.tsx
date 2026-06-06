"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { faultTypes } from "@/lib/data";
import {
  buildFaultFromSubmission,
  getSubmittedReports,
  isReportFormValid,
  saveSubmittedReport,
} from "@/lib/report-storage";
import type { FaultType } from "@/lib/types";
import { useBuilding } from "@/components/BuildingProvider";
import { useRuntimeBuildingContext } from "@/hooks/useRuntimeBuildingContext";
import ReportImagePicker from "@/components/ReportImagePicker";
import {
  REPORT_MAINTENANCE_RESPONSIBILITY,
  REPORT_SAVED_HEADLINE,
  REPORT_SAVED_INFO,
} from "@/lib/pilot-copy";
import { savePilotFaultFromLocalFault } from "@/lib/pilot-cloud";
import type { ReportImageAttachment } from "@/lib/report-image";

function elevatorStatusLabel(status: string): string {
  return status === "מושבתת" ? "מעלית מושבתת" : status;
}

export default function ReportForm() {
  const { buildingId, ctx } = useBuilding();
  const { elevators, ready } = useRuntimeBuildingContext();
  const [elevatorId, setElevatorId] = useState("");
  const [faultType, setFaultType] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [description, setDescription] = useState("");
  const [imageAttachment, setImageAttachment] =
    useState<ReportImageAttachment | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");

  const selectedElevator = useMemo(
    () => elevators.find((e) => e.id === elevatorId),
    [elevators, elevatorId]
  );
  const isValid = isReportFormValid(elevatorId, faultType, description);

  function resetForm() {
    setSubmitted(false);
    setTicketNumber("");
    setElevatorId("");
    setFaultType("");
    setIsDisabled(false);
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
        isDisabled,
        image: imageAttachment,
      },
      existingCount
    );

    saveSubmittedReport(fault, buildingId);
    savePilotFaultFromLocalFault(fault, buildingId, ctx.building.name);

    setTimeout(() => {
      setTicketNumber(fault.ticketNumber ?? fault.id);
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-scale-in">
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5 ring-4 ring-emerald-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-navy mb-2">{REPORT_SAVED_HEADLINE}</h2>
        {ticketNumber && (
          <p className="text-sm font-semibold text-navy bg-gold/15 border border-gold/30 rounded-xl px-4 py-2 mb-3">
            מספר פנייה: {ticketNumber}
          </p>
        )}
        <div
          dir="rtl"
          className="w-full max-w-sm text-right bg-gray-light border border-gray-200 rounded-xl px-4 py-3.5 mb-2"
        >
          <p className="text-sm text-navy/80 leading-relaxed">
            {REPORT_SAVED_INFO}
          </p>
          <p className="text-sm text-navy/85 font-medium leading-relaxed mt-3">
            {REPORT_MAINTENANCE_RESPONSIBILITY}
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full mt-8">
          <Link href="/history" className="btn-primary text-center">
            צפייה בהיסטוריית תקלות
          </Link>
          <Link href="/" className="text-sm font-medium text-navy hover:text-navy/80 transition-colors text-center">
            חזרה לדף הבית
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm font-medium text-gold hover:text-gold/80 transition-colors"
          >
            דיווח תקלה נוספת
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center animate-pulse">
        <p className="text-sm text-gray-text">טוען סטטוס מעליות...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="form-section animate-fade-up">
        <p className="text-xs font-semibold text-gold mb-3">פרטי מעלית</p>
        <label htmlFor="elevator" className="form-label">
          בחירת מעלית
        </label>
        <select
          id="elevator"
          value={elevatorId}
          onChange={(e) => setElevatorId(e.target.value)}
          className="form-input"
        >
          <option value="">בחרו מעלית</option>
          {elevators.map((e) => (
            <option
              key={e.id}
              value={e.id}
              className={e.status === "מושבתת" ? "text-red-600" : undefined}
            >
              {e.name} ({e.stations} תחנות) — {elevatorStatusLabel(e.status)}
            </option>
          ))}
        </select>
        {selectedElevator?.status === "מושבתת" && (
          <p className="form-hint text-red-600 font-semibold mt-2">
            מעלית מושבתת
          </p>
        )}
      </div>

      <div className="form-section animate-fade-up animation-delay-100">
        <p className="text-xs font-semibold text-gold mb-3">פרטי תקלה</p>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="faultType" className="form-label">
              סוג תקלה
            </label>
            <select
              id="faultType"
              value={faultType}
              onChange={(e) => setFaultType(e.target.value)}
              className="form-input"
            >
              <option value="">בחרו סוג תקלה</option>
              {faultTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between bg-gray-light rounded-xl px-4 py-3.5">
            <div>
              <label htmlFor="isDisabled" className="text-sm font-semibold text-navy">
                האם המעלית מושבתת?
              </label>
              <p className="text-xs text-gray-text mt-0.5">
                סמנו אם המעלית אינה פועלת כלל
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDisabled}
              id="isDisabled"
              onClick={() => setIsDisabled(!isDisabled)}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                isDisabled ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
                  isDisabled ? "end-0.5" : "end-5"
                }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="description" className="form-label">
              תיאור תקלה
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תארו את התקלה בפירוט — מיקום, תסמינים, נסיבות..."
              className="form-input resize-none"
            />
            <p className={`form-hint ${description.trim().length >= 10 ? "text-emerald-600" : ""}`}>
              {description.trim().length < 10
                ? `מינימום 10 תווים (${description.trim().length}/10)`
                : `${description.trim().length} תווים — מוכן לשמירה`}
            </p>
          </div>
        </div>
      </div>

      <div className="form-section animate-fade-up animation-delay-200">
        <p className="text-xs font-semibold text-gold mb-3">תיעוד</p>
        <label className="form-label">העלאת תמונה</label>
        <ReportImagePicker
          attachment={imageAttachment}
          onChange={setImageAttachment}
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || submitting}
        aria-disabled={!isValid || submitting}
        className={`btn-primary mt-1 animate-fade-up animation-delay-200 transition-opacity ${
          isValid && !submitting ? "opacity-100" : "opacity-50"
        }`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            שומר...
          </span>
        ) : (
          "שמירת דיווח"
        )}
      </button>

      {!isValid && (
        <p className="text-xs text-center text-gray-text -mt-2">
          למלא: מעלית, סוג תקלה ותיאור של לפחות 10 תווים
        </p>
      )}
    </form>
  );
}
