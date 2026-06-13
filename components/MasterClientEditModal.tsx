"use client";

import { useEffect, useState } from "react";
import {
  CLIENT_TYPE_OPTIONS,
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  resolveClientWelcomeMessage,
  type ClientType,
} from "@/lib/client-profile";
import {
  getAllClientUserAccessRecords,
  updateClientUserProfile,
  type ClientUserAccessListItem,
} from "@/lib/client-access";

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
  const [clientType, setClientType] = useState<ClientType | "">("");
  const [welcomeMessage, setWelcomeMessage] = useState(
    DEFAULT_CLIENT_WELCOME_MESSAGE
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getAllClientUserAccessRecords().then((records) => {
      if (cancelled) return;

      const item = records.find((row) => row.user.id === clientUserId);
      if (!item) {
        setError("לא נמצא לקוח לעריכה.");
        setLoading(false);
        return;
      }

      hydrateForm(item);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, clientUserId]);

  function hydrateForm(item: ClientUserAccessListItem) {
    setName(item.user.name);
    setPhone(item.user.phone ?? "");
    setEmail(item.user.email ?? "");
    setClientType(item.user.client_type ?? "");
    setWelcomeMessage(resolveClientWelcomeMessage(item.user.welcome_message));
  }

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("שם הלקוח נדרש.");
      return;
    }

    setSaving(true);
    setError(null);

    const trimmedWelcome = welcomeMessage.trim();
    const saved = await updateClientUserProfile({
      userId: clientUserId,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      clientType: clientType || null,
      welcomeMessage:
        trimmedWelcome === DEFAULT_CLIENT_WELCOME_MESSAGE.trim()
          ? null
          : trimmedWelcome || null,
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
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-text">שם</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-text">טלפון</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-text">אימייל</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-text">סוג לקוח</label>
              <select
                value={clientType}
                onChange={(e) =>
                  setClientType(e.target.value as ClientType | "")
                }
                className="form-input mt-1"
              >
                <option value="">לא הוגדר</option>
                {CLIENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-text">הודעת פתיחה לפורטל</label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={4}
                className="form-input mt-1 resize-y min-h-[6rem]"
              />
            </div>
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
