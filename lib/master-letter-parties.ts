import type { ProjectContactWithDetails } from "./contacts";
import type { MasterLetterRecipientSnapshot } from "./master-letter-metadata";
import {
  buildAddresseeLineManual,
  buildRecipientSnapshotFromContact,
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
  contactRelationId: string;
  manual: MasterLetterManualParty;
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
    manual: { ...EMPTY_MANUAL_PARTY },
  };
}

export function resolvePartyEntrySnapshot(
  entry: MasterLetterPartyEntry,
  projectContacts: ProjectContactWithDetails[]
): MasterLetterRecipientSnapshot | null {
  if (entry.source === "contact") {
    const contact = projectContacts.find((row) => row.id === entry.contactRelationId);
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
    return Boolean(entry.contactRelationId.trim());
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
  projectContacts: ProjectContactWithDetails[]
): string | null {
  const snapshot = resolvePartyEntrySnapshot(entry, projectContacts);
  if (!snapshot) return null;
  return recipientSnapshotIdentityKey(snapshot);
}

export function validateLetterParties(
  recipients: MasterLetterPartyEntry[],
  cc: MasterLetterPartyEntry[],
  projectContacts: ProjectContactWithDetails[]
): string | null {
  const resolvedRecipients = recipients
    .map((entry) => resolvePartyEntrySnapshot(entry, projectContacts))
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
    const key = partyEntryIdentityKey(entry, projectContacts);
    if (!key) continue;
    if (recipientKeys.has(key)) {
      return "לא ניתן לבחור אותו איש קשר פעמיים ברשימת הנמענים.";
    }
    recipientKeys.add(key);
  }

  const ccKeys = new Set<string>();
  for (const entry of cc) {
    const key = partyEntryIdentityKey(entry, projectContacts);
    if (!key) continue;
    if (ccKeys.has(key)) {
      return "לא ניתן לבחור אותו איש קשר פעמיים ברשימת העותק.";
    }
    ccKeys.add(key);
  }

  for (const entry of cc) {
    const key = partyEntryIdentityKey(entry, projectContacts);
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
  projectContacts: ProjectContactWithDetails[]
): MasterLetterRecipientSnapshot[] {
  return entries
    .map((entry) => resolvePartyEntrySnapshot(entry, projectContacts))
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
