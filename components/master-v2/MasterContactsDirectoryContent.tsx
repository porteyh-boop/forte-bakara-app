"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import ForteContactForm, {
  contactInputFromContact,
  emptyContactInput,
} from "@/components/forte/ForteContactForm";
import ContactRowMenu from "@/components/master-v2/ContactRowMenu";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import VcfImportContactDialog from "@/components/master-v2/VcfImportContactDialog";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2EmptyState,
  ForteV2PageHeader,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
  MasterProjectV2SearchInput,
  MasterProjectV2TableShell,
  MasterProjectV2Toolbar,
  MasterProjectV2Workspace,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  createContact,
  deleteContact,
  isContactsConfigured,
  listContacts,
  updateContact,
} from "@/lib/contacts-cloud";
import { contactMatchesSearch, type Contact, type ContactInput } from "@/lib/contacts";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";
import { parseVCardFileSelection } from "@/lib/vcard-parser";

type EditorMode = "create" | "edit";

export default function MasterContactsDirectoryContent() {
  const { guardSensitiveAction } = useAppVersion();
  const configured = isContactsConfigured();

  const [authed, setAuthed] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactInput>(emptyContactInput());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const vcfInputRef = useRef<HTMLInputElement>(null);
  const [vcfImportOpen, setVcfImportOpen] = useState(false);
  const [vcfImportItems, setVcfImportItems] = useState<ContactInput[] | null>(null);
  const [vcfParseError, setVcfParseError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listContacts();
    setContacts(result.contacts);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contactMatchesSearch(contact, search)),
    [contacts, search]
  );

  function openCreateDialog() {
    setEditorMode("create");
    setEditingContact(null);
    setForm(emptyContactInput());
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(contact: Contact) {
    setEditorMode("edit");
    setEditingContact(contact);
    setForm(contactInputFromContact(contact));
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

    const result =
      editorMode === "create"
        ? await createContact(form)
        : editingContact
          ? await updateContact(editingContact.id, form)
          : { contact: null, error: "איש קשר לא נמצא." };

    setSaving(false);

    if (!result.contact) {
      setFormError(result.error ?? "שמירה נכשלה.");
      return;
    }

    closeDialog();
    setMessage(editorMode === "create" ? "איש הקשר נוסף לספר." : "איש הקשר עודכן.");
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    if (!guardSensitiveAction()) return;

    setDeleting(true);
    setDeleteError(null);

    const result = await deleteContact(deleteTarget.id);
    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error ?? "מחיקה נכשלה.");
      return;
    }

    setDeleteTarget(null);
    setMessage("איש הקשר נמחק מהספר.");
    await refresh();
  }

  function openVcfImportPicker() {
    if (!configured) return;
    vcfInputRef.current?.click();
  }

  async function handleVcfFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;

    try {
      const { contacts: parsedContacts, error } = await parseVCardFileSelection(files);
      if (error || parsedContacts.length === 0) {
        setVcfImportItems(null);
        setVcfParseError(error ?? "לא ניתן לקרוא את קובץ איש הקשר.");
        setVcfImportOpen(true);
        return;
      }

      setVcfParseError(null);
      setVcfImportItems(parsedContacts);
      setVcfImportOpen(true);
    } catch {
      setVcfImportItems(null);
      setVcfParseError("לא ניתן לקרוא את קובץ איש הקשר.");
      setVcfImportOpen(true);
    }
  }

  function closeVcfImportDialog() {
    setVcfImportOpen(false);
    setVcfImportItems(null);
    setVcfParseError(null);
  }

  async function handleVcfImportSaved(message: string) {
    setMessage(message);
    await refresh();
  }

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  const showEmptyState = !loading && filteredContacts.length === 0 && !search;

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="contacts-directory">
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="ספר אנשי קשר"
          subtitle="ניהול מרכזי של אנשי קשר לכל הפרויקטים"
        />

        <div className="fv2-workspace-content">
          <MasterProjectV2Workspace data-workspace="contacts-directory">
            <MasterProjectV2Toolbar
              inner
              search={
                <MasterProjectV2SearchInput value={search} onChange={setSearch} />
              }
              actions={
                <div className="flex flex-wrap gap-2">
                  <ForteV2PrimaryButton onClick={openCreateDialog} disabled={!configured} size="sm">
                    + איש קשר חדש
                  </ForteV2PrimaryButton>
                  <ForteV2SecondaryButton
                    onClick={openVcfImportPicker}
                    disabled={!configured}
                    size="sm"
                  >
                    ייבוא אנשי קשר
                  </ForteV2SecondaryButton>
                  <input
                    ref={vcfInputRef}
                    type="file"
                    multiple
                    accept=".vcf,.vcard,text/vcard,text/x-vcard"
                    className="hidden"
                    onChange={(e) => void handleVcfFileSelected(e)}
                  />
                </div>
              }
            />

            {!configured && (
              <ForteV2StatusBanner tone="warning">
                Supabase לא מוגדר — לא ניתן לטעון את ספר אנשי הקשר.
              </ForteV2StatusBanner>
            )}

            {message && (
              <ForteV2StatusBanner tone="success">{message}</ForteV2StatusBanner>
            )}

            {error && <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner>}

            {loading ? (
              <p className="text-sm text-forte-text-secondary py-10 text-center">
                טוען אנשי קשר...
              </p>
            ) : showEmptyState ? (
              <ForteV2EmptyState
                icon="📇"
                title="אין אנשי קשר"
                description="התחילו בהוספת איש הקשר הראשון לספר."
                actions={
                  <ForteV2PrimaryButton onClick={openCreateDialog} disabled={!configured} size="sm">
                    + איש קשר חדש
                  </ForteV2PrimaryButton>
                }
              />
            ) : null}

            <MasterProjectV2TableShell
              title="אנשי קשר"
              count={!loading ? filteredContacts.length : undefined}
              headers={["", "שם מלא", "חברה / ארגון", "תפקיד", "טלפון", 'דוא"ל']}
            >
              {!loading &&
                filteredContacts.map((contact, index) => (
                  <tr key={contact.id} className={index % 2 === 1 ? "" : ""}>
                    <td className="py-2.5 px-2 w-10">
                      <ContactRowMenu
                        onEdit={() => openEditDialog(contact)}
                        onDelete={() => {
                          setDeleteError(null);
                          setDeleteTarget(contact);
                        }}
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
                    <td className="py-2.5 px-2" dir="ltr">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-forte-text/85 hover:text-forte-text underline-offset-2 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-forte-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2" dir="ltr">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-forte-text/85 hover:text-forte-text underline-offset-2 hover:underline"
                        >
                          {contact.email}
                        </a>
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
          </MasterProjectV2Workspace>
        </div>
      </div>

      {dialogOpen && (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog
            title={editorMode === "create" ? "איש קשר חדש" : "עריכת איש קשר"}
            onClose={closeDialog}
            size="lg"
          >
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              {formError && <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>}
              <ForteContactForm
                form={form}
                onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
              />
              <div className="flex gap-2 pt-1">
                <ForteV2PrimaryButton type="submit" disabled={saving} size="sm">
                  {saving ? "שומר..." : "שמור"}
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton onClick={closeDialog} size="sm">
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}

      <VcfImportContactDialog
        open={vcfImportOpen}
        initialItems={vcfImportItems}
        parseError={vcfParseError}
        contacts={contacts}
        onClose={closeVcfImportDialog}
        onSaved={handleVcfImportSaved}
        guardSensitiveAction={guardSensitiveAction}
      />

      {deleteTarget && (
        <ForteV2DialogOverlay
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError(null);
          }}
        >
          <ForteV2Dialog title="מחיקת איש קשר">
            <p className="text-sm text-forte-text-secondary mb-4">
              האם למחוק את {deleteTarget.fullName} מהספר?
            </p>
            {deleteError && <ForteV2StatusBanner tone="error">{deleteError}</ForteV2StatusBanner>}
            <div className="flex gap-2">
              <ForteV2DangerButton onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "מוחק..." : "מחק"}
              </ForteV2DangerButton>
              <ForteV2SecondaryButton
                size="sm"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
              >
                ביטול
              </ForteV2SecondaryButton>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}
    </MasterShellLayout>
  );
}
