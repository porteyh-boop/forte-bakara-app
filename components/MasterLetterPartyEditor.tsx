"use client";

import type { ProjectContactWithDetails } from "@/lib/contacts";
import {
  buildRecipientSnapshotFromContact,
  type MasterLetterRecipientSnapshot,
} from "@/lib/master-letter-metadata";
import {
  collectUsedContactRelationIds,
  createMasterLetterPartyEntry,
  EMPTY_MANUAL_PARTY,
  type MasterLetterPartyEntry,
} from "@/lib/master-letter-parties";

interface MasterLetterPartyEditorProps {
  title: string;
  entries: MasterLetterPartyEntry[];
  onChange: (entries: MasterLetterPartyEntry[]) => void;
  projectContacts: ProjectContactWithDetails[];
  blockedContactRelationIds: Set<string>;
  primaryLabel?: string;
  rowLabel?: string;
  addLabel: string;
  allowEmpty?: boolean;
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

function PartyRow({
  entry,
  index,
  projectContacts,
  blockedContactRelationIds,
  primaryLabel,
  rowLabel = "נמען",
  onChange,
  onRemove,
  canRemove,
}: {
  entry: MasterLetterPartyEntry;
  index: number;
  projectContacts: ProjectContactWithDetails[];
  blockedContactRelationIds: Set<string>;
  primaryLabel?: string;
  rowLabel?: string;
  onChange: (patch: Partial<MasterLetterPartyEntry>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const selectedContact = projectContacts.find(
    (row) => row.id === entry.contactRelationId
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-navy">
          {index === 0 && primaryLabel
            ? primaryLabel
            : `${rowLabel}${index === 0 ? "" : ` ${index + 1}`}`}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-600 hover:underline"
          >
            הסר
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              source: "contact",
              manual: { ...EMPTY_MANUAL_PARTY },
            })
          }
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            entry.source === "contact"
              ? "border-gold bg-gold/10 text-navy"
              : "border-gray-200 text-navy"
          }`}
          disabled={projectContacts.length === 0}
        >
          מאנשי קשר
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              source: "manual",
              contactRelationId: "",
            })
          }
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            entry.source === "manual"
              ? "border-gold bg-gold/10 text-navy"
              : "border-gray-200 text-navy"
          }`}
        >
          הזנה ידנית
        </button>
      </div>

      {entry.source === "contact" ? (
        projectContacts.length === 0 ? (
          <p className="text-xs text-gray-text">אין אנשי קשר זמינים בפרויקט.</p>
        ) : (
          <select
            value={entry.contactRelationId}
            onChange={(event) =>
              onChange({ contactRelationId: event.target.value })
            }
            className="form-input"
          >
            <option value="">בחרו...</option>
            {projectContacts.map((contact) => {
              const disabled =
                blockedContactRelationIds.has(contact.id) &&
                contact.id !== entry.contactRelationId;
              return (
                <option key={contact.id} value={contact.id} disabled={disabled}>
                  {contact.fullName}
                  {contact.company ? ` · ${contact.company}` : ""}
                  {contact.projectRole || contact.roleTitle
                    ? ` · ${contact.projectRole || contact.roleTitle}`
                    : ""}
                  {disabled ? " (כבר נבחר)" : ""}
                </option>
              );
            })}
          </select>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      )}

      {entry.source === "contact" && selectedContact && (
        <div className="text-xs text-navy">
          <span className="text-gray-text">לכבוד: </span>
          {buildRecipientSnapshotFromContact(selectedContact).addresseeLine}
        </div>
      )}
    </div>
  );
}

export default function MasterLetterPartyEditor({
  title,
  entries,
  onChange,
  projectContacts,
  blockedContactRelationIds,
  primaryLabel,
  rowLabel = "נמען",
  addLabel,
  allowEmpty = false,
}: MasterLetterPartyEditorProps) {
  function handleEntryChange(
    entryId: string,
    patch: Partial<MasterLetterPartyEntry>
  ) {
    onChange(updateEntry(entries, entryId, patch));
  }

  function handleRemove(entryId: string) {
    const next = entries.filter((entry) => entry.id !== entryId);
    if (next.length === 0 && !allowEmpty) {
      onChange([createMasterLetterPartyEntry(projectContacts.length ? "contact" : "manual")]);
      return;
    }
    onChange(next);
  }

  function handleAdd() {
    onChange([
      ...entries,
      createMasterLetterPartyEntry(projectContacts.length ? "contact" : "manual"),
    ]);
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-light/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gold">{title}</p>
        <button
          type="button"
          onClick={handleAdd}
          className="text-xs font-semibold text-navy border border-gray-200 rounded-md px-2.5 py-1 hover:bg-white"
        >
          {addLabel}
        </button>
      </div>

      <div className="space-y-3">
        {entries.map((entry, index) => {
          const blocked = new Set([
            ...blockedContactRelationIds,
            ...collectUsedContactRelationIds(entries, entry.id),
          ]);

          return (
            <PartyRow
              key={entry.id}
              entry={entry}
              index={index}
              projectContacts={projectContacts}
              blockedContactRelationIds={blocked}
              primaryLabel={primaryLabel}
              rowLabel={rowLabel}
              onChange={(patch) => handleEntryChange(entry.id, patch)}
              onRemove={() => handleRemove(entry.id)}
              canRemove={allowEmpty || entries.length > 1}
            />
          );
        })}
      </div>
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
