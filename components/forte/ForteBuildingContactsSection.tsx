"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import ForteBuildingContactForm, {
  contactFormFromExisting,
  emptyBuildingContactInput,
} from "@/components/forte/ForteBuildingContactForm";
import {
  createBuildingContact,
  deleteBuildingContact,
  isBuildingContactsConfigured,
  listBuildingContacts,
  updateBuildingContact,
} from "@/lib/building-contacts-cloud";
import type { BuildingContact, BuildingContactInput } from "@/lib/building-contacts";

interface ForteBuildingContactsSectionProps {
  buildingId: string;
}

type EditorMode = "create" | "edit";

export default function ForteBuildingContactsSection({
  buildingId,
}: ForteBuildingContactsSectionProps) {
  const { guardSensitiveAction } = useAppVersion();
  const [contacts, setContacts] = useState<BuildingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingContact, setEditingContact] = useState<BuildingContact | null>(
    null
  );
  const [form, setForm] = useState<BuildingContactInput>(
    emptyBuildingContactInput()
  );
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BuildingContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listBuildingContacts(buildingId);
    setContacts(result.contacts);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setEditorMode("create");
    setEditingContact(null);
    setForm(emptyBuildingContactInput());
    setEditorOpen(true);
    setMessage(null);
  }

  function openEdit(contact: BuildingContact) {
    setEditorMode("edit");
    setEditingContact(contact);
    setForm(contactFormFromExisting(contact));
    setEditorOpen(true);
    setMessage(null);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingContact(null);
    setForm(emptyBuildingContactInput());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!guardSensitiveAction()) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    const result =
      editorMode === "create"
        ? await createBuildingContact(buildingId, form)
        : editingContact
          ? await updateBuildingContact(editingContact.id, buildingId, form)
          : { contact: null, error: "איש קשר לא נמצא." };

    setSaving(false);

    if (!result.contact) {
      setError(result.error ?? "שמירה נכשלה.");
      return;
    }

    setMessage(
      editorMode === "create" ? "איש הקשר נוסף בהצלחה." : "איש הקשר עודכן בהצלחה."
    );
    closeEditor();
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    if (!guardSensitiveAction()) return;

    setDeleting(true);
    setError(null);
    const result = await deleteBuildingContact(deleteTarget.id, buildingId);
    setDeleting(false);

    if (!result.ok) {
      setError(result.error ?? "מחיקה נכשלה.");
      setDeleteTarget(null);
      return;
    }

    setMessage("איש הקשר נמחק.");
    setDeleteTarget(null);
    await refresh();
  }

  const configured = isBuildingContactsConfigured();

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">אנשי קשר</h3>
          <p className="text-xs text-gray-text mt-0.5">
            אנשי קשר המשויכים לבניין הפעיל
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={!configured}
          className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl disabled:opacity-40"
        >
          + הוסף איש קשר
        </button>
      </div>

      {!configured && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Supabase לא מוגדר — לא ניתן לשמור אנשי קשר.
        </p>
      )}

      {message && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          {message}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-text">טוען אנשי קשר...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-gray-text">אין אנשי קשר לבניין זה.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[720px] text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-text">
                <th className="py-2 px-2 font-semibold">שם</th>
                <th className="py-2 px-2 font-semibold">תפקיד</th>
                <th className="py-2 px-2 font-semibold">חברה</th>
                <th className="py-2 px-2 font-semibold">טלפון</th>
                <th className="py-2 px-2 font-semibold">דוא&quot;ל</th>
                <th className="py-2 px-2 font-semibold">ראשי</th>
                <th className="py-2 px-2 font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-gray-100 hover:bg-gray-50/80"
                >
                  <td className="py-2.5 px-2 font-semibold text-navy">
                    {contact.fullName}
                  </td>
                  <td className="py-2.5 px-2 text-navy/90">
                    {contact.roleTitle || "—"}
                  </td>
                  <td className="py-2.5 px-2 text-navy/90">
                    {contact.company || "—"}
                  </td>
                  <td className="py-2.5 px-2 text-navy/90" dir="ltr">
                    {contact.phone || "—"}
                  </td>
                  <td className="py-2.5 px-2 text-navy/90" dir="ltr">
                    {contact.email || "—"}
                  </td>
                  <td className="py-2.5 px-2">
                    {contact.isPrimary ? (
                      <span className="inline-flex text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                        כן
                      </span>
                    ) : (
                      <span className="text-gray-text">לא</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(contact)}
                        className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
                      >
                        עריכה
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(contact)}
                        className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50"
                      >
                        מחיקה
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-editor-title"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={(e) => void handleSave(e)} className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h4
                  id="contact-editor-title"
                  className="text-base font-bold text-navy"
                >
                  {editorMode === "create" ? "הוספת איש קשר" : "עריכת איש קשר"}
                </h4>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="text-gray-text hover:text-navy text-sm"
                  aria-label="סגור"
                >
                  ✕
                </button>
              </div>

              <ForteBuildingContactForm
                form={form}
                onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={saving}
                >
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-contact-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-4 space-y-4">
            <h4 id="delete-contact-title" className="text-base font-bold text-navy">
              מחיקת איש קשר
            </h4>
            <p className="text-sm text-gray-text">
              האם למחוק את{" "}
              <span className="font-semibold text-navy">
                {deleteTarget.fullName}
              </span>
              ? פעולה זו אינה ניתנת לביטול.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? "מוחק..." : "מחק"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
