"use client";

import { useEffect, useState } from "react";
import {
  CLIENT_PERMISSION_KEYS,
  CLIENT_PERMISSION_LABELS,
  getClientPermissionsOrDefaults,
  saveClientPermissions,
  type ClientPermissionFlags,
} from "@/lib/client-permissions";

interface MasterClientPermissionsModalProps {
  clientUserId: string;
  clientName: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MasterClientPermissionsModal({
  clientUserId,
  clientName,
  open,
  onClose,
  onSaved,
}: MasterClientPermissionsModalProps) {
  const [flags, setFlags] = useState<ClientPermissionFlags | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getClientPermissionsOrDefaults(clientUserId).then((defaults) => {
      if (cancelled) return;
      setFlags(defaults);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, clientUserId]);

  if (!open) return null;

  async function handleSave() {
    if (!flags) return;

    setSaving(true);
    setError(null);
    const saved = await saveClientPermissions(clientUserId, flags);
    setSaving(false);

    if (!saved) {
      setError("שמירת ההרשאות נכשלה. ודאו ש-migration 013 הורץ ב-Supabase.");
      return;
    }

    onSaved();
    onClose();
  }

  function toggleFlag(key: keyof ClientPermissionFlags) {
    setFlags((current) =>
      current ? { ...current, [key]: !current[key] } : current
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-permissions-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 id="client-permissions-title" className="text-base font-bold text-navy">
            ניהול הרשאות
          </h3>
          <p className="text-sm text-gray-text mt-1">{clientName}</p>
        </div>

        {loading || !flags ? (
          <p className="text-sm text-gray-text">טוען הרשאות...</p>
        ) : (
          <div className="space-y-3">
            {CLIENT_PERMISSION_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5"
              >
                <span className="text-sm text-navy">{CLIENT_PERMISSION_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={flags[key]}
                  onClick={() => toggleFlag(key)}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                    flags[key] ? "bg-navy" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
                      flags[key] ? "end-0.5" : "end-5"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || !flags}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור הרשאות"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-navy"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
