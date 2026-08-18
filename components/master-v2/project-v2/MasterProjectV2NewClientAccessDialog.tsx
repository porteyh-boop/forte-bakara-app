"use client";

import { useEffect, useMemo, useState } from "react";
import ClientPermissionsFieldList from "@/components/ClientPermissionsFieldList";
import {
  buildClientAccessUrl,
  findClientAccessForContact,
  type ClientAccessLevel,
  type ClientAccessSession,
  type ClientUserAccessListItem,
} from "@/lib/client-access";
import {
  DEFAULT_NEW_CLIENT_ACCESS_PERMISSIONS,
  type ClientPermissionFlags,
  type ClientPermissionKey,
} from "@/lib/client-permissions";
import {
  createMasterClientUserAccess,
  saveMasterClientPermissions,
} from "@/lib/master-client-access-api";
import type { ProjectContactWithDetails } from "@/lib/contacts";

type CreateStep = "pick" | "configure" | "success";

interface ElevatorOption {
  id: string;
  name: string;
}

interface MasterProjectV2NewClientAccessDialogProps {
  open: boolean;
  buildingId: string;
  projectContacts: ProjectContactWithDetails[];
  existingRecords: ClientUserAccessListItem[];
  elevatorOptions: ElevatorOption[];
  onClose: () => void;
  onCreated: () => void;
}

function emptyManualForm() {
  return { name: "", phone: "", email: "", company: "", roleTitle: "" };
}

export default function MasterProjectV2NewClientAccessDialog({
  open,
  buildingId,
  projectContacts,
  existingRecords,
  elevatorOptions,
  onClose,
  onCreated,
}: MasterProjectV2NewClientAccessDialogProps) {
  const [step, setStep] = useState<CreateStep>("pick");
  const [selectedContact, setSelectedContact] =
    useState<ProjectContactWithDetails | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [accessLevel, setAccessLevel] = useState<ClientAccessLevel>("building");
  const [elevatorId, setElevatorId] = useState("");
  const [expiryMode, setExpiryMode] = useState<"none" | "date">("none");
  const [expiresAt, setExpiresAt] = useState("");
  const [permissions, setPermissions] = useState<ClientPermissionFlags>(
    DEFAULT_NEW_CLIENT_ACCESS_PERMISSIONS
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<ClientAccessSession | null>(
    null
  );
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setSelectedContact(null);
    setManualMode(false);
    setManualForm(emptyManualForm());
    setAccessLevel("building");
    setElevatorId("");
    setExpiryMode("none");
    setExpiresAt("");
    setPermissions(DEFAULT_NEW_CLIENT_ACCESS_PERMISSIONS);
    setCreating(false);
    setError(null);
    setCreatedSession(null);
    setCopyMessage(null);
  }, [open]);

  useEffect(() => {
    if (accessLevel === "building") {
      setElevatorId("");
      return;
    }
    if (!elevatorId && elevatorOptions[0]) {
      setElevatorId(elevatorOptions[0].id);
    }
  }, [accessLevel, elevatorId, elevatorOptions]);

  const availableContacts = useMemo(() => {
    return projectContacts.filter((contact) => {
      const existing = findClientAccessForContact(existingRecords, buildingId, {
        email: contact.email,
        phone: contact.phone,
      });
      return !existing;
    });
  }, [projectContacts, existingRecords, buildingId]);

  const duplicateForCurrent = useMemo(() => {
    const email = manualMode ? manualForm.email : selectedContact?.email;
    const phone = manualMode ? manualForm.phone : selectedContact?.phone;
    return findClientAccessForContact(existingRecords, buildingId, { email, phone });
  }, [manualMode, manualForm, selectedContact, existingRecords, buildingId]);

  const displayName = manualMode
    ? manualForm.name
    : selectedContact?.fullName ?? "";
  const displayCompany = manualMode
    ? manualForm.company
    : selectedContact?.company ?? "";
  const displayRole = manualMode
    ? manualForm.roleTitle
    : selectedContact?.roleTitle || selectedContact?.projectRole || "";

  function resetAndClose() {
    onClose();
  }

  function handlePickContact(contact: ProjectContactWithDetails) {
    setSelectedContact(contact);
    setManualMode(false);
    setStep("configure");
    setError(null);
  }

  function handleManualEntry() {
    setSelectedContact(null);
    setManualMode(true);
    setStep("configure");
    setError(null);
  }

  function togglePermission(key: ClientPermissionKey) {
    if (key === "can_receive_notifications") return;
    setPermissions((current) => ({ ...current, [key]: !current[key] }));
  }

  async function handleCreate() {
    const name = displayName.trim();
    const phone = (manualMode ? manualForm.phone : selectedContact?.phone ?? "").trim();
    const email = (manualMode ? manualForm.email : selectedContact?.email ?? "").trim();

    if (!name) {
      setError("שם הלקוח נדרש.");
      return;
    }

    if (duplicateForCurrent) {
      setError("ללקוח עם פרטים אלה כבר קיימת גישה לפרויקט.");
      return;
    }

    if (accessLevel === "elevator" && !elevatorId) {
      setError("יש לבחור מעלית.");
      return;
    }

    setCreating(true);
    setError(null);

    const created = await createMasterClientUserAccess({
      name,
      phone: phone || undefined,
      email: email || undefined,
      buildingId,
      elevatorId: accessLevel === "elevator" ? elevatorId : null,
      accessLevel,
      expiresAt:
        expiryMode === "date" && expiresAt
          ? new Date(`${expiresAt}T23:59:59`).toISOString()
          : null,
    });

    if (!created) {
      setCreating(false);
      setError("יצירת הגישה נכשלה. ודאו ש-Supabase מוגדר.");
      return;
    }

    const savedPermissions = await saveMasterClientPermissions(created.user.id, permissions);
    setCreating(false);

    if (!savedPermissions) {
      setError("הגישה נוצרה אך שמירת ההרשאות נכשלה.");
    }

    setCreatedSession(created);
    setStep("success");
    onCreated();
  }

  async function handleCopyLink() {
    if (!createdSession) return;
    const url = buildClientAccessUrl(createdSession.user.access_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage("הקישור הועתק");
    } catch {
      setCopyMessage(url);
    }
  }

  function handleOpenLink() {
    if (!createdSession) return;
    window.open(
      buildClientAccessUrl(createdSession.user.access_token),
      "_blank",
      "noopener,noreferrer"
    );
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-client-access-title"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg border border-forte-border shadow-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="new-client-access-title" className="text-sm font-bold text-forte-text">
              {step === "pick" && "לקוח חדש — בחירת אדם"}
              {step === "configure" && "לקוח חדש — הגדרת גישה"}
              {step === "success" && "הגישה נוצרה בהצלחה"}
            </h3>
            {step !== "success" && (
              <p className="text-xs text-forte-text-secondary mt-1">
                בניין: {buildingId} (נקבע אוטומטית מהפרויקט)
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="text-sm text-forte-text-secondary hover:text-forte-text"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        {step === "pick" && (
          <div className="space-y-3">
            {availableContacts.length === 0 ? (
              <p className="text-xs text-forte-text-secondary">
                אין אנשי קשר זמינים ליצירת גישה (כולם כבר משויכים או שאין אנשי קשר
                בפרויקט).
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-forte-text">
                  אנשי קשר בפרויקט
                </p>
                {availableContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handlePickContact(contact)}
                    className="w-full text-right rounded-md border border-forte-border px-3 py-2.5 hover:bg-forte-blue-light/40"
                  >
                    <p className="text-xs font-semibold text-forte-text">
                      {contact.fullName}
                    </p>
                    <p className="text-[11px] text-forte-text-secondary mt-0.5">
                      {[contact.company, contact.roleTitle || contact.projectRole]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                    <p className="text-[11px] text-forte-text-secondary">
                      {contact.phone || "—"} · {contact.email || "—"}
                    </p>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleManualEntry}
              className="w-full rounded-md border border-dashed border-forte-border px-3 py-2.5 text-xs font-semibold text-forte-text hover:bg-forte-blue-light/40"
            >
              הזנת לקוח חדש
            </button>
          </div>
        )}

        {step === "configure" && (
          <div className="space-y-4">
            {!manualMode && selectedContact && (
              <div className="rounded-md border border-forte-border bg-forte-blue-light/40 px-3 py-2">
                <p className="text-xs font-semibold text-forte-text">
                  {selectedContact.fullName}
                </p>
                <p className="text-[11px] text-forte-text-secondary">
                  {[displayCompany, displayRole].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-[11px] text-forte-text-secondary">
                  {selectedContact.phone || "—"} · {selectedContact.email || "—"}
                </p>
              </div>
            )}

            {manualMode && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-forte-text-secondary">שם</label>
                  <input
                    value={manualForm.name}
                    onChange={(e) =>
                      setManualForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    className="form-input mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-forte-text-secondary">חברה</label>
                  <input
                    value={manualForm.company}
                    onChange={(e) =>
                      setManualForm((current) => ({
                        ...current,
                        company: e.target.value,
                      }))
                    }
                    className="form-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-forte-text-secondary">תפקיד</label>
                  <input
                    value={manualForm.roleTitle}
                    onChange={(e) =>
                      setManualForm((current) => ({
                        ...current,
                        roleTitle: e.target.value,
                      }))
                    }
                    className="form-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-forte-text-secondary">טלפון</label>
                  <input
                    value={manualForm.phone}
                    onChange={(e) =>
                      setManualForm((current) => ({
                        ...current,
                        phone: e.target.value,
                      }))
                    }
                    className="form-input mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-forte-text-secondary">אימייל</label>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) =>
                      setManualForm((current) => ({
                        ...current,
                        email: e.target.value,
                      }))
                    }
                    className="form-input mt-1"
                  />
                </div>
              </div>
            )}

            {duplicateForCurrent && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                ללקוח עם פרטים אלה כבר קיימת גישה לפרויקט ({duplicateForCurrent.user.name}
                ).
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-forte-text">גישה</p>
              <label className="flex items-center gap-2 text-xs text-forte-text">
                <input
                  type="radio"
                  name="access-level"
                  checked={accessLevel === "building"}
                  onChange={() => setAccessLevel("building")}
                />
                כל הבניין
              </label>
              <label className="flex items-center gap-2 text-xs text-forte-text">
                <input
                  type="radio"
                  name="access-level"
                  checked={accessLevel === "elevator"}
                  onChange={() => setAccessLevel("elevator")}
                />
                מעלית מסוימת
              </label>
              {accessLevel === "elevator" && (
                <select
                  value={elevatorId}
                  onChange={(e) => setElevatorId(e.target.value)}
                  className="form-input"
                  required
                >
                  {elevatorOptions.map((elevator) => (
                    <option key={elevator.id} value={elevator.id}>
                      {elevator.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-forte-text">תוקף הקישור</p>
              <label className="flex items-center gap-2 text-xs text-forte-text">
                <input
                  type="radio"
                  name="expiry-mode"
                  checked={expiryMode === "none"}
                  onChange={() => setExpiryMode("none")}
                />
                ללא הגבלת זמן
              </label>
              <label className="flex items-center gap-2 text-xs text-forte-text">
                <input
                  type="radio"
                  name="expiry-mode"
                  checked={expiryMode === "date"}
                  onChange={() => setExpiryMode("date")}
                />
                תאריך תפוגה
              </label>
              {expiryMode === "date" && (
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="form-input"
                  required
                />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-forte-text mb-2">הרשאות</p>
              <ClientPermissionsFieldList
                flags={permissions}
                onToggle={togglePermission}
                compact
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="rounded-md border border-forte-border px-3 py-1.5 text-xs font-semibold text-forte-text"
              >
                חזרה
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={
                  creating ||
                  !displayName.trim() ||
                  Boolean(duplicateForCurrent) ||
                  (accessLevel === "elevator" && !elevatorId) ||
                  (expiryMode === "date" && !expiresAt)
                }
                className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {creating ? "יוצר..." : "צור גישה"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && createdSession && (
          <div className="space-y-3">
            <p className="text-xs text-forte-text">
              נוצרה גישה עבור {createdSession.user.name}
            </p>
            <p className="text-[11px] text-forte-text-secondary break-all bg-forte-blue-light/40 border border-forte-border rounded-md px-3 py-2">
              {buildClientAccessUrl(createdSession.user.access_token)}
            </p>
            {copyMessage && (
              <p className="text-xs text-emerald-800">{copyMessage}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white"
              >
                העתק קישור
              </button>
              <button
                type="button"
                onClick={handleOpenLink}
                className="rounded-md border border-forte-border px-3 py-1.5 text-xs font-semibold text-forte-text"
              >
                פתח קישור
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-md border border-forte-border px-3 py-1.5 text-xs font-semibold text-forte-text"
              >
                סגור
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
