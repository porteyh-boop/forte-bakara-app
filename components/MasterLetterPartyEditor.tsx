"use client";

import CentralContactCombobox from "@/components/master-v2/CentralContactCombobox";
import type { Contact, ProjectContactWithDetails } from "@/lib/contacts";
import type { MasterLetterRecipientSnapshot } from "@/lib/master-letter-metadata";
import {
  collectBlockedCentralContactIds,
  createMasterLetterPartyEntry,
  createMasterLetterPartyEntryFromCentralContact,
  EMPTY_MANUAL_PARTY,
  getPartyEntryDisplayLabel,
  resolvePartyEntrySnapshot,
  type MasterLetterPartyEntry,
  type MasterLetterPartyResolveContext,
} from "@/lib/master-letter-parties";

interface MasterLetterPartyEditorProps {
  sectionTitle: string;
  /** Visible picker label — נמען ראשי or עותק */
  fieldLabel: string;
  entries: MasterLetterPartyEntry[];
  onChange: (entries: MasterLetterPartyEntry[]) => void;
  projectContacts: ProjectContactWithDetails[];
  centralContacts: Contact[];
  onCentralContactsChange: (contacts: Contact[]) => void;
  blockedCentralContactIds: Set<string>;
  allowEmpty?: boolean;
  comboboxInputId?: string;
}

function updateEntry(
  entries: MasterLetterPartyEntry[],
  entryId: string,
  patch: Partial<MasterLetterPartyEntry>
): MasterLetterPartyEntry[] {
  return entries.map((entry) =>
    entry.id === entryId ? { ...entry, ...patch } : entry
  );
}

function ManualEntryForm({
  entry,
  onChange,
}: {
  entry: MasterLetterPartyEntry;
  onChange: (patch: Partial<MasterLetterPartyEntry>) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <label className="block space-y-1">
        <span className="text-xs text-gray-text">שם</span>
        <input
          value={entry.manual.fullName}
          onChange={(event) =>
            onChange({
              manual: { ...entry.manual, fullName: event.target.value },
            })
          }
          className="form-input"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-gray-text">חברה / ארגון</span>
        <input
          value={entry.manual.company}
          onChange={(event) =>
            onChange({
              manual: { ...entry.manual, company: event.target.value },
            })
          }
          className="form-input"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-gray-text">תפקיד</span>
        <input
          value={entry.manual.roleTitle}
          onChange={(event) =>
            onChange({
              manual: { ...entry.manual, roleTitle: event.target.value },
            })
          }
          className="form-input"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-gray-text">אימייל</span>
        <input
          type="email"
          value={entry.manual.email}
          onChange={(event) =>
            onChange({
              manual: { ...entry.manual, email: event.target.value },
            })
          }
          className="form-input"
          dir="ltr"
        />
      </label>
    </div>
  );
}

function PartyChip({
  label,
  addresseeLine,
  onRemove,
}: {
  label: string;
  addresseeLine?: string;
  onRemove: () => void;
}) {
  return (
    <div className="inline-flex max-w-full items-start gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-navy">
      <div className="min-w-0 text-right">
        <p className="font-semibold truncate">{label}</p>
        {addresseeLine ? (
          <p className="text-[11px] text-gray-text truncate">{addresseeLine}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 text-gray-text hover:text-red-600 leading-none px-0.5"
        aria-label={`הסר ${label}`}
      >
        ×
      </button>
    </div>
  );
}

export default function MasterLetterPartyEditor({
  sectionTitle,
  fieldLabel,
  entries,
  onChange,
  projectContacts,
  centralContacts,
  onCentralContactsChange,
  blockedCentralContactIds,
  allowEmpty = false,
  comboboxInputId,
}: MasterLetterPartyEditorProps) {
  const resolveContext: MasterLetterPartyResolveContext = {
    projectContacts,
    centralContacts,
  };

  function handleRemove(entryId: string) {
    onChange(entries.filter((entry) => entry.id !== entryId));
  }

  function handleEntryChange(
    entryId: string,
    patch: Partial<MasterLetterPartyEntry>
  ) {
    onChange(updateEntry(entries, entryId, patch));
  }

  function handleSelectContact(contact: Contact) {
    const blocked = new Set([
      ...blockedCentralContactIds,
      ...collectBlockedCentralContactIds(entries, projectContacts),
    ]);
    if (blocked.has(contact.id)) return;

    onChange([...entries, createMasterLetterPartyEntryFromCentralContact(contact.id)]);
  }

  function handleManualEntry() {
    onChange([
      ...entries,
      {
        ...createMasterLetterPartyEntry("manual"),
        manual: { ...EMPTY_MANUAL_PARTY },
      },
    ]);
  }

  const contactEntries = entries.filter((entry) => entry.source === "contact");
  const manualEntries = entries.filter((entry) => entry.source === "manual");

  return (
    <div
      className="space-y-3 rounded-xl border border-gray-100 bg-gray-light/40 p-4"
      data-component="master-letter-party-editor"
    >
      <p className="text-xs font-semibold text-gold">{sectionTitle}</p>

      {contactEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contactEntries.map((entry) => {
            const snapshot = resolvePartyEntrySnapshot(entry, resolveContext);
            const label = getPartyEntryDisplayLabel(entry, resolveContext);

            return (
              <PartyChip
                key={entry.id}
                label={label}
                addresseeLine={snapshot?.addresseeLine}
                onRemove={() => handleRemove(entry.id)}
              />
            );
          })}
        </div>
      )}

      {manualEntries.map((entry, index) => (
        <div key={entry.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-navy">
              {index === 0 ? "הזנה ידנית" : `הזנה ידנית ${index + 1}`}
            </p>
            <button
              type="button"
              onClick={() => handleRemove(entry.id)}
              className="text-xs text-red-600 hover:underline"
            >
              הסר
            </button>
          </div>
          <ManualEntryForm
            entry={entry}
            onChange={(patch) => handleEntryChange(entry.id, patch)}
          />
        </div>
      ))}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-navy" htmlFor={comboboxInputId}>
          {fieldLabel}
        </label>
        <CentralContactCombobox
          contacts={centralContacts}
          onContactsChange={onCentralContactsChange}
          blockedContactIds={
            new Set([
              ...blockedCentralContactIds,
              ...collectBlockedCentralContactIds(entries, projectContacts),
            ])
          }
          onSelectContact={handleSelectContact}
          onManualEntry={handleManualEntry}
          inputId={comboboxInputId}
        />
      </div>

      {entries.length === 0 && !allowEmpty && (
        <p className="text-xs text-gray-text">יש להוסיף לפחות נמען אחד.</p>
      )}
    </div>
  );
}

export function snapshotsPreviewLines(
  recipients: MasterLetterRecipientSnapshot[],
  cc: MasterLetterRecipientSnapshot[]
): string[] {
  const lines: string[] = [];
  recipients.forEach((recipient, index) => {
    if (index === 0) lines.push("לכבוד:");
    if (recipient.fullName.trim()) lines.push(recipient.fullName.trim());
    if (recipient.company?.trim()) lines.push(recipient.company.trim());
    if (recipient.roleTitle?.trim()) lines.push(recipient.roleTitle.trim());
    if (index < recipients.length - 1) lines.push("");
  });
  if (cc.length > 0) {
    lines.push("עותק:");
    cc.forEach((entry) => {
      const name = entry.fullName.trim();
      const company = entry.company?.trim() ?? "";
      lines.push(
        name && company ? `${name} — ${company}` : name || company || entry.addresseeLine
      );
    });
  }
  return lines;
}
