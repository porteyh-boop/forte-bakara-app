"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForteContactForm from "@/components/forte/ForteContactForm";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  contactMatchesSearch,
  emptyContactInput,
  validateContactInput,
  type Contact,
  type ContactInput,
} from "@/lib/contacts";
import { createContact, listContacts } from "@/lib/contacts-cloud";

function contactDetailLine(contact: Contact): string {
  return [contact.company, contact.roleTitle, contact.phone, contact.email]
    .filter(Boolean)
    .join(" · ");
}

interface CentralContactComboboxProps {
  contacts: Contact[];
  onContactsChange?: (contacts: Contact[]) => void;
  blockedContactIds: Set<string>;
  onSelectContact: (contact: Contact) => void;
  onManualEntry: () => void;
  placeholder?: string;
  inputId?: string;
}

export default function CentralContactCombobox({
  contacts,
  onContactsChange,
  blockedContactIds,
  onSelectContact,
  onManualEntry,
  placeholder = "חפש או בחר איש קשר...",
  inputId,
}: CentralContactComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ContactInput>(emptyContactInput());
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshContacts = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const result = await listContacts();
    setLoading(false);

    if (result.error) {
      setLoadError(result.error);
      return;
    }

    onContactsChange?.(result.contacts);
  }, [onContactsChange]);

  useEffect(() => {
    if (contacts.length > 0) return;
    void refreshContacts();
  }, [contacts.length, refreshContacts]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filteredContacts = useMemo(
    () =>
      contacts.filter(
        (contact) =>
          contactMatchesSearch(contact, query) &&
          !blockedContactIds.has(contact.id)
      ),
    [contacts, query, blockedContactIds]
  );

  function resetCreateDialog() {
    setCreateForm(emptyContactInput());
    setCreateError(null);
    setCreating(false);
  }

  function openCreateDialog() {
    setOpen(false);
    resetCreateDialog();
    setCreateOpen(true);
  }

  function handleOpen() {
    setOpen(true);
    if (contacts.length === 0) {
      void refreshContacts();
    }
  }

  function handleSelect(contact: Contact) {
    onSelectContact(contact);
    setQuery("");
    setOpen(false);
  }

  function handleManualEntry() {
    onManualEntry();
    setQuery("");
    setOpen(false);
  }

  async function handleCreateSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;

    const validationError = validateContactInput(createForm);
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setCreating(true);
    setCreateError(null);

    const result = await createContact(createForm);
    setCreating(false);

    if (!result.contact) {
      setCreateError(result.error ?? "שמירה נכשלה.");
      return;
    }

    const nextContacts = contacts.some((row) => row.id === result.contact!.id)
      ? contacts
      : [result.contact, ...contacts];
    onContactsChange?.(nextContacts);

    setCreateOpen(false);
    resetCreateDialog();
    onSelectContact(result.contact);
  }

  return (
    <>
      <div ref={rootRef} className="relative" data-component="central-contact-combobox">
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            handleOpen();
          }}
          onFocus={handleOpen}
          onClick={handleOpen}
          placeholder={placeholder}
          className="form-input w-full"
          autoComplete="off"
          aria-expanded={open}
          aria-haspopup="listbox"
        />

        {open && (
          <div
            className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            role="listbox"
          >
            <ul className="max-h-[min(50vh,16rem)] overflow-y-auto">
              {loading ? (
                <li className="px-3 py-3 text-xs text-gray-text text-center">
                  טוען ספר אנשי קשר...
                </li>
              ) : loadError ? (
                <li className="px-3 py-3 text-xs text-red-600 text-center">{loadError}</li>
              ) : filteredContacts.length === 0 ? (
                <li className="px-3 py-3 text-xs text-gray-text text-center">
                  {query.trim() ? "לא נמצאו תוצאות." : "אין אנשי קשר בספר."}
                </li>
              ) : (
                filteredContacts.map((contact) => {
                  const details = contactDetailLine(contact);
                  return (
                    <li key={contact.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(contact)}
                        className="w-full px-3 py-2 text-right hover:bg-gray-50 transition-colors"
                      >
                        <p className="text-sm font-medium text-navy">{contact.fullName}</p>
                        {details ? (
                          <p className="text-xs text-gray-text">{details}</p>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={openCreateDialog}
                className="w-full px-3 py-2.5 text-right text-sm font-semibold text-navy hover:bg-gold/10 transition-colors"
              >
                + איש קשר חדש
              </button>
              <button
                type="button"
                onClick={handleManualEntry}
                className="w-full px-3 py-2.5 text-right text-sm text-navy border-t border-gray-100 hover:bg-gray-50 transition-colors"
              >
                הזנה ידנית
              </button>
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <ForteV2DialogOverlay onClose={() => setCreateOpen(false)}>
          <ForteV2Dialog
            title="איש קשר חדש"
            onClose={() => setCreateOpen(false)}
            size="lg"
          >
            <form onSubmit={(event) => void handleCreateSubmit(event)} className="space-y-4">
              {createError && <ForteV2StatusBanner tone="error">{createError}</ForteV2StatusBanner>}
              <ForteContactForm
                form={createForm}
                onChange={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
              />
              <div className="flex gap-2 pt-1">
                <ForteV2PrimaryButton type="submit" disabled={creating} size="sm">
                  {creating ? "שומר..." : "שמור"}
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton onClick={() => setCreateOpen(false)} size="sm">
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}
    </>
  );
}
