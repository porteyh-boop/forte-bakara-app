"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import ForteContactForm, {
  contactInputFromContact,
  emptyContactInput,
} from "@/components/forte/ForteContactForm";
import ContactRowMenu from "@/components/master-v2/ContactRowMenu";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2TabShell,
  MasterProjectV2EmptyState,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SearchInput,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
  MasterProjectV2TableShell,
  MasterProjectV2Toolbar,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  contactMatchesSearch,
  projectContactMatchesSearch,
  type Contact,
  type ContactInput,
  type ProjectContactWithDetails,
} from "@/lib/contacts";
import { listContacts, updateContact } from "@/lib/contacts-cloud";
import {
  attachContactsToProject,
  createProjectContact,
  isProjectContactsConfigured,
  listProjectContacts,
  removeContactFromProject,
  updateProjectContactRelation,
} from "@/lib/project-contacts-cloud";
import { exportProjectContactsToCsv } from "@/lib/project-v2-contacts-export";

interface MasterProjectV2ContactsTabProps {
  buildingId: string;
}

type EditorMode = "create" | "edit";

export default function MasterProjectV2ContactsTab({
  buildingId,
}: MasterProjectV2ContactsTabProps) {
  const { guardSensitiveAction } = useAppVersion();
  const configured = isProjectContactsConfigured();

  const [contacts, setContacts] = useState<ProjectContactWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const [pickOpen, setPickOpen] = useState(false);
  const [directoryContacts, setDirectoryContacts] = useState<Contact[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [attachError, setAttachError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);

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

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => projectContactMatchesSearch(contact, search)),
    [contacts, search]
  );

  const attachedContactIds = useMemo(
    () => new Set(contacts.map((contact) => contact.contactId)),
    [contacts]
  );

  const filteredDirectoryContacts = useMemo(() => {
    return directoryContacts.filter((contact) =>
      contactMatchesSearch(contact, directorySearch)
    );
  }, [directoryContacts, directorySearch]);

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
    setProjectRole("");
    setIsPrimary(false);
    setFormError(null);
  }

  async function openPickDialog() {
    setPickOpen(true);
    setDirectorySearch("");
    setSelectedIds(new Set());
    setAttachError(null);
    setDirectoryLoading(true);
    const result = await listContacts();
    setDirectoryContacts(result.contacts);
    if (result.error) setAttachError(result.error);
    setDirectoryLoading(false);
  }

  function closePickDialog() {
    setPickOpen(false);
    setSelectedIds(new Set());
    setAttachError(null);
  }

  function toggleSelected(contactId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
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
      closeDialog();
      setMessage("איש הקשר נוסף לפרויקט.");
      await refresh();
      return;
    }

    if (!editingContact) {
      setSaving(false);
      setFormError("איש קשר לא נמצא.");
      return;
    }

    const centralUpdate = await updateContact(editingContact.contactId, form);
    if (!centralUpdate.contact) {
      setSaving(false);
      setFormError(centralUpdate.error ?? "עדכון איש קשר נכשל.");
      return;
    }

    const relationUpdate = await updateProjectContactRelation(
      editingContact.id,
      buildingId,
      { projectRole, isPrimary }
    );
    setSaving(false);

    if (!relationUpdate.contact) {
      setFormError(relationUpdate.error ?? "עדכון שיוך לפרויקט נכשל.");
      return;
    }

    closeDialog();
    setMessage("איש הקשר עודכן.");
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
      setRemoveError(result.error ?? "הסרה מהפרויקט נכשלה.");
      return;
    }

    setRemoveTarget(null);
    setMessage("איש הקשר הוסר מהפרויקט.");
    await refresh();
  }

  async function confirmAttach() {
    if (attaching || selectedIds.size === 0) return;
    if (!guardSensitiveAction()) return;

    setAttaching(true);
    setAttachError(null);
    const result = await attachContactsToProject(
      buildingId,
      Array.from(selectedIds)
    );
    setAttaching(false);

    if (result.attached.length === 0) {
      setAttachError(result.error ?? "לא ניתן לצרף אנשי קשר.");
      return;
    }

    closePickDialog();
    setMessage(`${result.attached.length} אנשי קשר צורפו לפרויקט.`);
    await refresh();
  }

  const showEmptyState = !loading && filteredContacts.length === 0 && !search;

  return (
    <ForteV2TabShell
      workspace="project-v2-contacts"
      title="אנשי קשר"
      description="אנשי קשר המשויכים לפרויקט"
      actions={
        <>
          <MasterProjectV2PrimaryButton
            onClick={() => void openPickDialog()}
            disabled={!configured}
            size="sm"
          >
            + הוסף מהספר
          </MasterProjectV2PrimaryButton>
          <MasterProjectV2PrimaryButton
            onClick={openCreateDialog}
            disabled={!configured}
            size="sm"
          >
            + איש קשר חדש
          </MasterProjectV2PrimaryButton>
          <MasterProjectV2SecondaryButton
            onClick={() => exportProjectContactsToCsv(contacts, buildingId)}
            disabled={contacts.length === 0}
            size="sm"
          >
            ייצוא
          </MasterProjectV2SecondaryButton>
        </>
      }
    >
      <MasterProjectV2Toolbar
        inner
        search={
          <MasterProjectV2SearchInput value={search} onChange={setSearch} />
        }
      />

      {!configured && (
        <MasterProjectV2StatusBanner tone="warning">
          Supabase לא מוגדר — לא ניתן לטעון אנשי קשר.
        </MasterProjectV2StatusBanner>
      )}

      {message && (
        <MasterProjectV2StatusBanner tone="success">{message}</MasterProjectV2StatusBanner>
      )}

      {error && (
        <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>
      )}

      {loading ? (
        <p className="text-xs text-forte-text-secondary py-6 text-center">טוען אנשי קשר...</p>
      ) : showEmptyState ? (
        <MasterProjectV2EmptyState
          title="אין אנשי קשר המשויכים לפרויקט"
          description="הוסיפו אנשי קשר מהספר או צרו חדשים."
          actions={
            <>
              <MasterProjectV2PrimaryButton
                onClick={() => void openPickDialog()}
                disabled={!configured}
              >
                + הוסף מהספר
              </MasterProjectV2PrimaryButton>
              <MasterProjectV2PrimaryButton
                onClick={openCreateDialog}
                disabled={!configured}
              >
                + איש קשר חדש
              </MasterProjectV2PrimaryButton>
            </>
          }
        />
      ) : null}

      <MasterProjectV2TableShell
        headers={[
          "",
          "שם",
          "חברה",
          "תפקיד",
          "תפקיד בפרויקט",
          "טלפון",
          'דוא"ל',
          "ראשי",
        ]}
      >
        {!loading &&
          filteredContacts.map((contact) => (
            <tr
              key={contact.id}
              className="border-b border-forte-border/60 hover:bg-forte-blue-light/40"
            >
              <td className="py-2.5 px-2 w-10">
                <ContactRowMenu
                  onEdit={() => openEditDialog(contact)}
                  onDelete={() => {
                    setRemoveError(null);
                    setRemoveTarget(contact);
                  }}
                  deleteLabel="הסר מהפרויקט"
                />
              </td>
              <td className="py-2.5 px-2 font-medium text-forte-text">
                {contact.fullName}
              </td>
              <td className="py-2.5 px-2 text-forte-text/85">
                {contact.company || "—"}
              </td>
              <td className="py-2.5 px-2 text-forte-text/85">
                {contact.roleTitle || "—"}
              </td>
              <td className="py-2.5 px-2 text-forte-text/85">
                {contact.projectRole || "—"}
              </td>
              <td className="py-2.5 px-2" dir="ltr">
                {contact.phone ? (
                  <a href={`tel:${contact.phone}`} className="text-forte-text/85 hover:underline">
                    {contact.phone}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2.5 px-2" dir="ltr">
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-forte-text/85 hover:underline"
                  >
                    {contact.email}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2.5 px-2">
                {contact.isPrimary ? (
                  <span className="text-[11px] font-semibold text-amber-800">
                    ★ ראשי
                  </span>
                ) : (
                  <span className="text-forte-text-secondary">—</span>
                )}
              </td>
            </tr>
          ))}
      </MasterProjectV2TableShell>

      {!loading && filteredContacts.length === 0 && search && (
        <p className="text-xs text-forte-text-secondary text-center py-4">
          לא נמצאו אנשי קשר התואמים לחיפוש.
        </p>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forte-text/30 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white rounded-lg border border-forte-border shadow-xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={(e) => void handleSave(e)} className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-forte-text">
                  {editorMode === "create" ? "+ איש קשר חדש" : "עריכת איש קשר"}
                </h4>
                <button type="button" onClick={closeDialog} className="text-forte-text-secondary text-sm">
                  ✕
                </button>
              </div>

              {formError && (
                <MasterProjectV2StatusBanner tone="error">{formError}</MasterProjectV2StatusBanner>
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
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-forte-primary-hover disabled:opacity-40"
                >
                  {saving ? "שומר..." : "שמור"}
                </button>
                <MasterProjectV2SecondaryButton onClick={closeDialog}>
                  ביטול
                </MasterProjectV2SecondaryButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {pickOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forte-text/30 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl bg-white rounded-lg border border-forte-border shadow-xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-forte-border/60 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-forte-text">הוסף מהספר</h4>
                <button type="button" onClick={closePickDialog} className="text-forte-text-secondary text-sm">
                  ✕
                </button>
              </div>
              <MasterProjectV2SearchInput
                value={directorySearch}
                onChange={setDirectorySearch}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {attachError && (
                <MasterProjectV2StatusBanner tone="error">{attachError}</MasterProjectV2StatusBanner>
              )}

              {directoryLoading ? (
                <p className="text-xs text-forte-text-secondary py-6 text-center">טוען ספר אנשי קשר...</p>
              ) : filteredDirectoryContacts.length === 0 ? (
                <p className="text-xs text-forte-text-secondary py-6 text-center">
                  {directorySearch ? "לא נמצאו תוצאות." : "אין אנשי קשר בספר."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {filteredDirectoryContacts.map((contact) => {
                    const alreadyAttached = attachedContactIds.has(contact.id);
                    const checked = selectedIds.has(contact.id);
                    return (
                      <li
                        key={contact.id}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                          alreadyAttached
                            ? "border-forte-border/60 bg-forte-blue-light/40 opacity-70"
                            : "border-forte-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={alreadyAttached}
                          onChange={() => toggleSelected(contact.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-forte-text">
                            {contact.fullName}
                            {alreadyAttached && (
                              <span className="mr-2 text-[11px] text-forte-text-secondary">
                                (כבר משויך)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-forte-text-secondary">
                            {[contact.company, contact.roleTitle, contact.phone, contact.email]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-4 border-t border-forte-border/60 flex gap-2">
              <button
                type="button"
                onClick={() => void confirmAttach()}
                disabled={attaching || selectedIds.size === 0}
                className="rounded-md bg-forte-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-forte-primary-hover disabled:opacity-40"
              >
                {attaching ? "מצרף..." : "צרף לפרויקט"}
              </button>
              <MasterProjectV2SecondaryButton onClick={closePickDialog}>
                ביטול
              </MasterProjectV2SecondaryButton>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forte-text/30 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-lg border border-forte-border shadow-xl p-4 space-y-4">
            <h4 className="text-sm font-bold text-forte-text">הסרה מהפרויקט</h4>
            <p className="text-xs text-forte-text-secondary">
              להסיר את {removeTarget.fullName} מהפרויקט? איש הקשר יישאר בספר.
            </p>
            {removeError && (
              <MasterProjectV2StatusBanner tone="error">{removeError}</MasterProjectV2StatusBanner>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirmRemove()}
                disabled={removing}
                className="flex-1 rounded-md bg-red-600 text-white py-2 text-xs font-semibold disabled:opacity-50"
              >
                {removing ? "מסיר..." : "הסר מהפרויקט"}
              </button>
              <MasterProjectV2SecondaryButton
                onClick={() => {
                  setRemoveTarget(null);
                  setRemoveError(null);
                }}
              >
                ביטול
              </MasterProjectV2SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </ForteV2TabShell>
  );
}
