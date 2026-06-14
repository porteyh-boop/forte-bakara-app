"use client";

import { useEffect, useState } from "react";
import ClientWelcomeFields from "@/components/ClientWelcomeFields";
import {
  getClientUserById,
  updateClientUserProfile,
} from "@/lib/client-access";
import { useClientWelcomeFields } from "@/lib/use-client-welcome-fields";

interface MasterClientEditModalProps {
  clientUserId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function MasterClientEditModal({
  clientUserId,
  open,
  onClose,
  onSaved,
}: MasterClientEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const {
    clientType,
    welcomeMessage,
    setClientType,
    setWelcomeMessage,
    resetWelcomeToDefault,
    hydrateFromUser,
    getWelcomeMessageForSave,
  } = useClientWelcomeFields();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getClientUserById(clientUserId).then((user) => {
      if (cancelled) return;

      if (!user) {
        setError("לא נמצא לקוח לעריכה.");
        setLoading(false);
        return;
      }

      setName(user.name);
      setPhone(user.phone ?? "");
      setEmail(user.email ?? "");
      hydrateFromUser(user);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, clientUserId, hydrateFromUser]);

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("שם הלקוח נדרש.");
      return;
    }

    setSaving(true);
    setError(null);

    const saved = await updateClientUserProfile({
      userId: clientUserId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      clientType: clientType || null,
      welcomeMessage: getWelcomeMessageForSave(),
    });

    setSaving(false);

    if (!saved) {
      setError("עדכון הלקוח נכשל. ודאו ש-migration 015 הורץ ב-Supabase.");
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
      aria-labelledby="client-edit-title"
    >
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="client-edit-title" className="text-base font-bold text-navy">
              ערוך לקוח
            </h2>
            <p className="text-xs text-gray-text mt-0.5">
              עדכון פרטי לקוח ללא שינוי בקישור הגישה
            </p>
            <p className="text-[11px] text-gray-text mt-1">
              פרטים אלה שייכים למשתמש הפורטל ואינם מעדכנים את כרטיס הבניין.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-gray-text hover:text-navy"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-text">טוען פרטי לקוח...</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-gray-text">שם משתמש בפורטל</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-text">טלפון משתמש בפורטל</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-text">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input mt-1"
              />
            </div>
            <ClientWelcomeFields
              clientType={clientType}
              welcomeMessage={welcomeMessage}
              onClientTypeChange={setClientType}
              onWelcomeMessageChange={setWelcomeMessage}
              onResetWelcomeToDefault={resetWelcomeToDefault}
              clientTypeLabel="סוג לקוח / גורם מקבל גישה"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-navy border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || saving || !name.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
        </div>
      </div>
    </div>
  );
}
