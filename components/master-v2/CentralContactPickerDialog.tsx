"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ForteV2Dialog,
  ForteV2DialogOverlay,
  MasterProjectV2SearchInput,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { contactMatchesSearch, type Contact } from "@/lib/contacts";
import { listContacts } from "@/lib/contacts-cloud";

interface CentralContactPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (contact: Contact) => void;
  title?: string;
}

export default function CentralContactPickerDialog({
  open,
  onClose,
  onSelect,
  title = "בחר מאנשי הקשר",
}: CentralContactPickerDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;

    setSearch("");
    setError(null);
    setLoading(true);

    void listContacts().then((result) => {
      setContacts(result.contacts);
      setError(result.error);
      setLoading(false);
    });
  }, [open]);

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contactMatchesSearch(contact, search)),
    [contacts, search]
  );

  if (!open) return null;

  function handleSelect(contact: Contact) {
    onSelect(contact);
    onClose();
  }

  return (
    <ForteV2DialogOverlay onClose={onClose}>
      <ForteV2Dialog title={title} onClose={onClose} size="xl">
        <div className="space-y-3">
          <MasterProjectV2SearchInput
            value={search}
            onChange={setSearch}
            placeholder="חיפוש לפי שם, חברה, טלפון..."
          />

          {error && <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>}

          <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
            {loading ? (
              <p className="text-xs text-forte-text-secondary py-6 text-center">
                טוען ספר אנשי קשר...
              </p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-xs text-forte-text-secondary py-6 text-center">
                {search ? "לא נמצאו תוצאות." : "אין אנשי קשר בספר."}
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredContacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(contact)}
                      className="w-full rounded-lg border border-forte-border px-3 py-2 text-right hover:border-forte-primary/40 hover:bg-forte-blue-light/30 transition-colors"
                    >
                      <p className="text-sm font-medium text-forte-text">{contact.fullName}</p>
                      <p className="text-xs text-forte-text-secondary">
                        {[contact.company, contact.roleTitle, contact.phone, contact.email]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <MasterProjectV2SecondaryButton onClick={onClose}>ביטול</MasterProjectV2SecondaryButton>
          </div>
        </div>
      </ForteV2Dialog>
    </ForteV2DialogOverlay>
  );
}
