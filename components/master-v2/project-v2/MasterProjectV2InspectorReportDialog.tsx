"use client";

import { useEffect, useState } from "react";
import IsraeliDateInput from "@/components/master-v2/project-v2/IsraeliDateInput";
import {
  ISRAELI_DATE_INVALID_MESSAGE,
  isValidIsoDate,
  todayIsoDate,
} from "@/lib/israeli-date-input";
import {
  validateInspectorReportFile,
  validateInspectorReportInput,
} from "@/lib/inspector-report-tracking";
import { createMasterInspectorReport } from "@/lib/master-inspector-reports-api";

interface ElevatorOption {
  id: string;
  name: string;
}

interface MasterProjectV2InspectorReportDialogProps {
  open: boolean;
  buildingId: string;
  elevatorOptions: ElevatorOption[];
  onClose: () => void;
  onCreated: (message: string) => void;
}

export default function MasterProjectV2InspectorReportDialog({
  open,
  buildingId,
  elevatorOptions,
  onClose,
  onCreated,
}: MasterProjectV2InspectorReportDialogProps) {
  const [elevatorId, setElevatorId] = useState("");
  const [reportDate, setReportDate] = useState(() => todayIsoDate());
  const [inspectorName, setInspectorName] = useState("");
  const [nextInspectionDate, setNextInspectionDate] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [hasRemarks, setHasRemarks] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setElevatorId("");
    setReportDate(todayIsoDate());
    setInspectorName("");
    setNextInspectionDate("");
    setDocumentName("");
    setHasRemarks(false);
    setSelectedFile(null);
    setUploadProgress(null);
    setCreating(false);
    setError(null);
  }, [open]);

  const hasElevators = elevatorOptions.length > 0;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setSelectedFile(null);

    if (!file) return;

    const validationError = validateInspectorReportFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    if (!documentName.trim()) {
      setDocumentName(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("יש לבחור קובץ תסקיר.");
      return;
    }

    if (!isValidIsoDate(reportDate)) {
      setError(`תאריך בדיקה — ${ISRAELI_DATE_INVALID_MESSAGE}`);
      return;
    }

    if (nextInspectionDate && !isValidIsoDate(nextInspectionDate)) {
      setError(`מועד הבדיקה הבאה — ${ISRAELI_DATE_INVALID_MESSAGE}`);
      return;
    }

    const input = {
      buildingId,
      elevatorId: elevatorId || null,
      reportDate,
      inspectorName,
      documentName: documentName || selectedFile.name,
      hasRemarks,
      nextInspectionDate: nextInspectionDate || null,
    };

    const validationError = validateInspectorReportInput(input);
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    const { report: created } = await createMasterInspectorReport(
      {
        buildingId: input.buildingId,
        elevatorId: input.elevatorId,
        documentName: input.documentName || selectedFile.name,
        reportDate: input.reportDate,
        inspectorName: input.inspectorName,
        hasRemarks: input.hasRemarks,
        nextInspectionDate: input.nextInspectionDate,
        file: selectedFile,
      },
      setUploadProgress
    );
    setCreating(false);
    setUploadProgress(null);

    if (!created) {
      setError(
        "יצירת התסקיר נכשלה. ודאו ש-migrations 008, 011 ו-027 הורצו ב-Supabase."
      );
      return;
    }

    onCreated(
      created.has_remarks
        ? "תסקיר נשמר ומעקב 45 יום נפתח."
        : "תסקיר בודק נשמר בהצלחה."
    );
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2-inspector-report-title"
      onClick={onClose}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-lg border border-forte-border shadow-lg p-5 space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="v2-inspector-report-title" className="text-sm font-bold text-forte-text">
              + תסקיר בודק
            </h3>
            <p className="text-xs text-forte-text-secondary mt-1">
              בניין {buildingId} — נוצרים document + meta + קובץ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-forte-text-secondary hover:text-forte-text"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-forte-text-secondary">מעלית</label>
            <select
              value={elevatorId}
              onChange={(event) => setElevatorId(event.target.value)}
              className="form-input mt-1"
            >
              <option value="">כל הבניין</option>
              {elevatorOptions.map((elevator) => (
                <option key={elevator.id} value={elevator.id}>
                  {elevator.name}
                </option>
              ))}
            </select>
            {!hasElevators && (
              <p className="text-[11px] text-forte-text-secondary mt-0.5">
                לא נמצאו מעליות cloud לפרויקט.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-forte-text-secondary">שם מסמך</label>
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              className="form-input mt-1"
              placeholder="תסקיר בודק שנתי"
            />
          </div>
          <IsraeliDateInput
            label="תאריך בדיקה"
            value={reportDate}
            onChange={setReportDate}
            required
          />
          <div>
            <label className="text-xs text-forte-text-secondary">שם בודק</label>
            <input
              value={inspectorName}
              onChange={(event) => setInspectorName(event.target.value)}
              className="form-input mt-1"
              placeholder="אופציונלי"
            />
          </div>
          <IsraeliDateInput
            label="מועד הבדיקה הבאה"
            value={nextInspectionDate}
            onChange={setNextInspectionDate}
            hint="אופציונלי — נקבע ידנית · DD/MM/YYYY"
          />
          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-sm text-forte-text">
              <input
                type="checkbox"
                checked={hasRemarks}
                onChange={(event) => setHasRemarks(event.target.checked)}
                className="mt-1"
              />
              <span>
                יש הערות לתיקון — פתיחת מעקב ל-45 יום (תזכורת 35 · התראה 40 ·
                מכתב בהול 45+)
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-forte-text-secondary">קובץ תסקיר</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
              onChange={handleFileChange}
              className="block w-full text-xs mt-1"
              required
            />
            {selectedFile && (
              <p className="text-[11px] text-forte-text-secondary mt-1">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
              </p>
            )}
            <p className="text-[11px] text-forte-text-secondary mt-0.5">
              PDF · JPG · PNG · DOCX · XLSX · עד 20MB
            </p>
            {uploadProgress !== null && (
              <p className="text-[11px] text-forte-text-secondary mt-1">
                מעלה… {uploadProgress}%
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={creating || !selectedFile}
            className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {creating ? "שומר..." : "שמור תסקיר"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-md border border-forte-border px-3 py-1.5 text-xs font-semibold text-forte-text"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
