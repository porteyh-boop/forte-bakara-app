"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import ForteContactForm, { emptyContactInput } from "@/components/forte/ForteContactForm";
import {
  createProjectContact,
  isProjectContactsConfigured,
  listProjectContacts,
  removeContactFromProject,
  updateProjectContactRelation,
} from "@/lib/project-contacts-cloud";
import { updateContact } from "@/lib/contacts-cloud";
import type { ContactInput, ProjectContactWithDetails } from "@/lib/contacts";

interface ForteBuildingContactsListSectionProps {
  buildingId: string;
}

type EditorMode = "create" | "edit";

export default function ForteBuildingContactsListSection({
  buildingId,
}: ForteBuildingContactsListSectionProps) {
  const { guardSensitiveAction } = useAppVersion();
  const [contacts, setContacts] = useState<ProjectContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingContact, setEditingContact] = useState<ProjectContactWithDetails | null>(
    null
  );
  const [form, setForm] = useState<ContactInput>(emptyContactInput());
  const [projectRole, setProjectRole] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ProjectContactWithDetails | null>(
    null
  );
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listProjectContacts(buildingId);
    setContacts(result.contacts);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [buildingId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreateDialog() {
    setEditorMode("create");
    setEditingContact(null);
    setForm(emptyContactInput());
    setProjectRole("");
    setIsPrimary(false);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(contact: ProjectContactWithDetails) {
    setEditorMode("edit");
    setEditingContact(contact);
    setForm({
      fullName: contact.fullName,
      company: contact.company,
      roleTitle: contact.roleTitle,
      phone: contact.phone,
      email: contact.email,
      notes: contact.notes,
    });
    setProjectRole(contact.projectRole);
    setIsPrimary(contact.isPrimary);
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingContact(null);
    setForm(emptyContactInput());
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!guardSensitiveAction()) return;

    setSaving(true);
    setFormError(null);

    if (editorMode === "create") {
      const result = await createProjectContact(buildingId, form, {
        projectRole,
        isPrimary,
      });
      setSaving(false);
      if (!result.contact) {
        setFormError(result.error ?? "שמירת איש קשר נכשלה.");
        return;
      }
    } else if (editingContact) {
      const central = await updateContact(editingContact.contactId, form);
      if (!central.contact) {
        setSaving(false);
        setFormError(central.error ?? "עדכון נכשל.");
        return;
      }
      const relation = await updateProjectContactRelation(
        editingContact.id,
        buildingId,
        { projectRole, isPrimary }
      );
      setSaving(false);
      if (!relation.contact) {
        setFormError(relation.error ?? "עדכון שיוך נכשל.");
        return;
      }
    }

    closeDialog();
    setMessage(editorMode === "create" ? "איש הקשר נוסף." : "איש הקשר עודכן.");
    await refresh();
  }

  async function confirmRemove() {
    if (!removeTarget || removing) return;
    if (!guardSensitiveAction()) return;

    setRemoving(true);
    setRemoveError(null);
    const result = await removeContactFromProject(removeTarget.id, buildingId);
    setRemoving(false);

    if (!result.ok) {
      setRemoveError(result.error ?? "הסרה נכשלה.");
      return;
    }

    setRemoveTarget(null);
    setMessage("איש הקשר הוסר מהפרויקט.");
    await refresh();
  }

  const configured = isProjectContactsConfigured();

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy">אנשי קשר</h3>
          <p className="text-xs text-gray-text mt-0.5">
            רשימת אנשי קשר המשויכים לבניין
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          disabled={!configured}
          className="text-sm font-semibold bg-navy text-white px-4 py-2 rounded-xl disabled:opacity-40"
        >
          איש קשר חדש
        </button>
      </div>

      {!configured && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Supabase לא מוגדר — לא ניתן לטעון אנשי קשר.
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
        <p className="text-sm text-gray-text">לא הוגדרו אנשי קשר לבניין.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[720px] text-sm text-right border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-text">
                <th className="py-2 px-2 font-semibold">פעולות</th>
                <th className="py-2 px-2 font-semibold">שם</th>
                <th className="py-2 px-2 font-semibold">תפקיד</th>
                <th className="py-2 px-2 font-semibold">חברה</th>
                <th className="py-2 px-2 font-semibold">טלפון</th>
                <th className="py-2 px-2 font-semibold">דוא&quot;ל</th>
                <th className="py-2 px-2 font-semibold">ראשי</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b border-gray-100 hover:bg-gray-50/80"
                >
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDialog(contact)}
                        className="text-xs font-semibold text-navy border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50"
                      >
                        ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveError(null);
                          setRemoveTarget(contact);
                        }}
                        className="text-xs font-semibold text-red-700 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50"
                      >
                        הסר
                      </button>
                    </div>
                  </td>
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
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-navy/90" dir="ltr">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-2">
                    {contact.isPrimary ? (
                      <span className="inline-flex text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">
                        ★ ראשי
                      </span>
                    ) : (
                      <span className="text-gray-text">לא</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={(e) => void handleSave(e)} className="p-4 space-y-4">
              <h4 className="text-base font-bold text-navy">
                {editorMode === "create" ? "איש קשר חדש" : "עריכת איש קשר"}
              </h4>
              {formError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}
              <ForteContactForm
                form={form}
                onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                showProjectFields
                projectRole={projectRole}
                isPrimary={isPrimary}
                onProjectRoleChange={setProjectRole}
                onPrimaryChange={setIsPrimary}
              />
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? "שומר..." : "שמור"}
                </button>
                <button type="button" onClick={closeDialog} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-xl p-4 space-y-4">
            <h4 className="text-base font-bold text-navy">הסרה מהפרויקט</h4>
            <p className="text-sm text-gray-text">להסיר את {removeTarget.fullName}?</p>
            {removeError && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {removeError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirmRemove()}
                disabled={removing}
                className="flex-1 rounded-xl bg-red-600 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {removing ? "מסיר..." : "הסר"}
              </button>
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
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
