"use client";

import { useEffect, useState } from "react";
import ClientPermissionsFieldList from "@/components/ClientPermissionsFieldList";
import {
  getClientPermissionsOrDefaults,
  saveClientPermissions,
  type ClientPermissionFlags,
  type ClientPermissionKey,
} from "@/lib/client-permissions";
import {
  getMasterClientPermissionsOrDefaults,
  saveMasterClientPermissions,
} from "@/lib/master-client-access-api";

interface MasterClientPermissionsModalProps {
  clientUserId: string;
  clientName: string;
  open: boolean;
  /** When true (Master V2), use secured Master APIs instead of direct Supabase. */
  useMasterApi?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MasterClientPermissionsModal({
  clientUserId,
  clientName,
  open,
  useMasterApi = false,
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

    const loadPermissions = useMasterApi
      ? getMasterClientPermissionsOrDefaults
      : getClientPermissionsOrDefaults;

    void loadPermissions(clientUserId).then((defaults) => {
      if (cancelled) return;
      setFlags(defaults);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, clientUserId, useMasterApi]);

  if (!open) return null;

  async function handleSave() {
    if (!flags) return;

    setSaving(true);
    setError(null);
    const saved = useMasterApi
      ? await saveMasterClientPermissions(clientUserId, flags)
      : Boolean(await saveClientPermissions(clientUserId, flags));
    setSaving(false);

    if (!saved) {
      setError("שמירת ההרשאות נכשלה. ודאו ש-migration 013 הורץ ב-Supabase.");
      return;
    }

    onSaved();
    onClose();
  }

  function toggleFlag(key: ClientPermissionKey) {
    if (key === "can_receive_notifications") return;
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
          <ClientPermissionsFieldList flags={flags} onToggle={toggleFlag} />
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
