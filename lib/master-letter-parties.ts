import type { Contact, ProjectContactWithDetails } from "./contacts";
import type { MasterLetterRecipientSnapshot } from "./master-letter-metadata";
import {
  buildAddresseeLineManual,
  buildRecipientSnapshotFromContact,
  buildRecipientSnapshotFromDirectoryContact,
  buildRecipientSnapshotManual,
} from "./master-letter-metadata";

export type MasterLetterPartySource = "contact" | "manual";

export interface MasterLetterManualParty {
  fullName: string;
  company: string;
  roleTitle: string;
  email: string;
}

export interface MasterLetterPartyEntry {
  id: string;
  source: MasterLetterPartySource;
  /** Project relation id (legacy / inspector prefill) */
  contactRelationId: string;
  /** Central directory contact id */
  centralContactId: string;
  manual: MasterLetterManualParty;
}

export interface MasterLetterPartyResolveContext {
  projectContacts: ProjectContactWithDetails[];
  centralContacts: Contact[];
}

export const EMPTY_MANUAL_PARTY: MasterLetterManualParty = {
  fullName: "",
  company: "",
  roleTitle: "",
  email: "",
};

export function createMasterLetterPartyEntry(
  source: MasterLetterPartySource = "contact"
): MasterLetterPartyEntry {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `party-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    source,
    contactRelationId: "",
    centralContactId: "",
    manual: { ...EMPTY_MANUAL_PARTY },
  };
}

export function createMasterLetterPartyEntryFromCentralContact(
  contactId: string
): MasterLetterPartyEntry {
  return {
    ...createMasterLetterPartyEntry("contact"),
    centralContactId: contactId,
  };
}

export function resolvePartyEntrySnapshot(
  entry: MasterLetterPartyEntry,
  context: MasterLetterPartyResolveContext
): MasterLetterRecipientSnapshot | null {
  if (entry.source === "contact") {
    if (entry.centralContactId.trim()) {
      const contact = context.centralContacts.find(
        (row) => row.id === entry.centralContactId
      );
      if (!contact) return null;
      return buildRecipientSnapshotFromDirectoryContact(contact);
    }

    const contact = context.projectContacts.find(
      (row) => row.id === entry.contactRelationId
    );
    if (!contact) return null;
    return buildRecipientSnapshotFromContact(contact);
  }

  if (
    !entry.manual.fullName.trim() &&
    !entry.manual.company.trim() &&
    !entry.manual.roleTitle.trim()
  ) {
    return null;
  }

  return buildRecipientSnapshotManual(entry.manual);
}

export function partyEntryHasContent(entry: MasterLetterPartyEntry): boolean {
  if (entry.source === "contact") {
    return Boolean(
      entry.centralContactId.trim() || entry.contactRelationId.trim()
    );
  }
  return Boolean(
    entry.manual.fullName.trim() ||
      entry.manual.company.trim() ||
      entry.manual.roleTitle.trim()
  );
}

export function recipientSnapshotIdentityKey(
  snapshot: MasterLetterRecipientSnapshot
): string {
  if (snapshot.contactId) {
    return `contact:${snapshot.contactId}`;
  }
  return `manual:${snapshot.fullName.trim().toLowerCase()}|${(snapshot.company ?? "").trim().toLowerCase()}|${(snapshot.roleTitle ?? "").trim().toLowerCase()}`;
}

export function partyEntryIdentityKey(
  entry: MasterLetterPartyEntry,
  context: MasterLetterPartyResolveContext
): string | null {
  const snapshot = resolvePartyEntrySnapshot(entry, context);
  if (!snapshot) return null;
  return recipientSnapshotIdentityKey(snapshot);
}

export function validateLetterParties(
  recipients: MasterLetterPartyEntry[],
  cc: MasterLetterPartyEntry[],
  context: MasterLetterPartyResolveContext
): string | null {
  const resolvedRecipients = recipients
    .map((entry) => resolvePartyEntrySnapshot(entry, context))
    .filter((row): row is MasterLetterRecipientSnapshot => row !== null);

  if (resolvedRecipients.length === 0) {
    return "יש להוסיף לפחות נמען אחד.";
  }

  if (recipients.some((entry) => partyEntryHasContent(entry) === false)) {
    return "יש להשלים את כל שורות הנמענים או להסיר שורה ריקה.";
  }

  if (cc.some((entry) => partyEntryHasContent(entry) === false)) {
    return "יש להשלים את כל שורות העותק או להסיר שורה ריקה.";
  }

  const recipientKeys = new Set<string>();
  for (const entry of recipients) {
    const key = partyEntryIdentityKey(entry, context);
    if (!key) continue;
    if (recipientKeys.has(key)) {
      return "לא ניתן לבחור אותו איש קשר פעמיים ברשימת הנמענים.";
    }
    recipientKeys.add(key);
  }

  const ccKeys = new Set<string>();
  for (const entry of cc) {
    const key = partyEntryIdentityKey(entry, context);
    if (!key) continue;
    if (ccKeys.has(key)) {
      return "לא ניתן לבחור אותו איש קשר פעמיים ברשימת העותק.";
    }
    ccKeys.add(key);
  }

  for (const entry of cc) {
    const key = partyEntryIdentityKey(entry, context);
    if (!key) continue;
    if (recipientKeys.has(key)) {
      return "איש קשר שכבר נמצא ב'לכבוד' לא יכול להופיע גם ב'עותק'.";
    }
  }

  for (const entry of recipients) {
    if (entry.source === "manual") {
      const hasLine =
        entry.manual.fullName.trim() ||
        entry.manual.company.trim() ||
        buildAddresseeLineManual(entry.manual) !== "לכבוד ועד הבית / חברת הניהול";
      if (!hasLine) {
        return "נמען ידני חייב לכלול לפחות שם או חברה.";
      }
    }
  }

  return null;
}

export function resolvePartySnapshots(
  entries: MasterLetterPartyEntry[],
  context: MasterLetterPartyResolveContext
): MasterLetterRecipientSnapshot[] {
  return entries
    .map((entry) => resolvePartyEntrySnapshot(entry, context))
    .filter((row): row is MasterLetterRecipientSnapshot => row !== null);
}

export function collectUsedContactRelationIds(
  entries: MasterLetterPartyEntry[],
  excludeEntryId?: string
): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    if (entry.source === "contact" && entry.contactRelationId.trim()) {
      ids.add(entry.contactRelationId);
    }
  }
  return ids;
}

export function collectBlockedCentralContactIds(
  entries: MasterLetterPartyEntry[],
  projectContacts: ProjectContactWithDetails[],
  excludeEntryId?: string
): Set<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (excludeEntryId && entry.id === excludeEntryId) continue;
    if (entry.centralContactId.trim()) {
      ids.add(entry.centralContactId.trim());
      continue;
    }
    if (entry.source === "contact" && entry.contactRelationId.trim()) {
      const relation = projectContacts.find(
        (row) => row.id === entry.contactRelationId
      );
      if (relation?.contactId) {
        ids.add(relation.contactId);
      }
    }
  }
  return ids;
}

export function getPartyEntryDisplayLabel(
  entry: MasterLetterPartyEntry,
  context: MasterLetterPartyResolveContext
): string {
  const snapshot = resolvePartyEntrySnapshot(entry, context);
  if (snapshot) {
    const parts = [snapshot.fullName.trim()];
    if (snapshot.company?.trim()) parts.push(snapshot.company.trim());
    return parts.filter(Boolean).join(" · ") || snapshot.addresseeLine;
  }

  if (entry.source === "manual") {
    const parts = [entry.manual.fullName.trim(), entry.manual.company.trim()].filter(
      Boolean
    );
    return parts.length > 0 ? parts.join(" · ") : "הזנה ידנית";
  }

  return "איש קשר";
}
