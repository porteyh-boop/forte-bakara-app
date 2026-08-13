"use client";

import { useEffect, useState } from "react";
import {
  updateClientAccessScope,
  type ClientAccessLevel,
} from "@/lib/client-access";

interface MasterProjectV2ClientAccessExpiryDialogProps {
  open: boolean;
  clientUserId: string;
  clientName: string;
  buildingId: string;
  accessLevel: ClientAccessLevel;
  elevatorId: string | null;
  currentExpiresAt: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function MasterProjectV2ClientAccessExpiryDialog({
  open,
  clientUserId,
  clientName,
  buildingId,
  accessLevel,
  elevatorId,
  currentExpiresAt,
  onClose,
  onSaved,
}: MasterProjectV2ClientAccessExpiryDialogProps) {
  const [mode, setMode] = useState<"none" | "date">(
    currentExpiresAt ? "date" : "none"
  );
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(currentExpiresAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(currentExpiresAt ? "date" : "none");
    setExpiresAt(toDateInputValue(currentExpiresAt));
    setError(null);
  }, [open, currentExpiresAt]);

  if (!open) return null;

  async function handleSave() {
    setSaving(true);
    setError(null);

    const nextExpiresAt =
      mode === "date" && expiresAt
        ? new Date(`${expiresAt}T23:59:59`).toISOString()
        : null;

    const updated = await updateClientAccessScope({
      userId: clientUserId,
      buildingId,
      accessLevel,
      elevatorId,
      expiresAt: nextExpiresAt,
    });

    setSaving(false);

    if (!updated) {
      setError("עדכון תוקף הקישור נכשל.");
      return;
    }

    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-expiry-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-lg border border-forte-border shadow-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="client-expiry-title" className="text-sm font-bold text-forte-text">
            שינוי תוקף קישור
          </h3>
          <p className="text-xs text-forte-text-secondary mt-1">{clientName}</p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-forte-text">
            <input
              type="radio"
              name="expiry-mode"
              checked={mode === "none"}
              onChange={() => setMode("none")}
            />
            ללא הגבלת זמן
          </label>
          <label className="flex items-center gap-2 text-xs text-forte-text">
            <input
              type="radio"
              name="expiry-mode"
              checked={mode === "date"}
              onChange={() => setMode("date")}
            />
            תאריך תפוגה
          </label>
          {mode === "date" && (
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="form-input mt-1"
              required
            />
          )}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || (mode === "date" && !expiresAt)}
            className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-forte-border px-3 py-1.5 text-xs font-semibold text-forte-text"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
