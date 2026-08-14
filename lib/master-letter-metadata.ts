import type { DocumentRecord } from "./document-center";
import type {
  MasterLetterFieldValue,
  MasterLetterTemplateId,
} from "./master-letters";
import { getMasterLetterTemplate } from "./master-letter-templates";
import type { Contact, ProjectContactWithDetails } from "./contacts";

export const MASTER_LETTER_METADATA_SCHEMA_VERSION = 1 as const;
export const MASTER_LETTER_METADATA_KEY = "letter" as const;

export const MASTER_LETTER_DOSSIER_SECTIONS = [
  "general",
  "inspections",
  "faults",
] as const;

export type MasterLetterDossierSection =
  (typeof MASTER_LETTER_DOSSIER_SECTIONS)[number];

export const MASTER_LETTER_DOSSIER_SECTION_LABELS: Record<
  MasterLetterDossierSection,
  string
> = {
  general: "כללי / התקשרות",
  inspections: "בדיקות",
  faults: "תקלות",
};

export interface MasterLetterRecipientSnapshot {
  contactId: string | null;
  manual: boolean;
  fullName: string;
  company: string | null;
  roleTitle: string | null;
  email: string | null;
  addresseeLine: string;
}

export interface MasterLetterInspectorFollowUpMetadata {
  reportDocumentId: string;
  letterStage: "letter_1" | "letter_2" | "letter_3";
}

export interface MasterLetterStoredMetadata {
  schemaVersion: typeof MASTER_LETTER_METADATA_SCHEMA_VERSION;
  templateId: MasterLetterTemplateId;
  subject: string;
  section: MasterLetterDossierSection;
  recipients: MasterLetterRecipientSnapshot[];
  cc: MasterLetterRecipientSnapshot[];
  /** @deprecated normalized from recipients[0] on read for backward compatibility */
  recipient?: MasterLetterRecipientSnapshot;
  templateFields?: Record<string, MasterLetterFieldValue>;
  customNote?: string | null;
  letterDate?: string | null;
  elevatorId?: string | null;
  elevatorName?: string | null;
  bodyText?: string | null;
  generatedAt: string;
  inspectorFollowUp?: MasterLetterInspectorFollowUpMetadata | null;
}

export interface MasterLetterListDisplay {
  subject: string;
  recipient: string;
  templateLabel: string;
  sectionLabel: string;
  isHistorical: boolean;
  canEdit: boolean;
}

export function buildAddresseeLineFromContact(
  contact: Pick<ProjectContactWithDetails, "fullName" | "company">
): string {
  if (contact.company.trim()) {
    return `לכבוד ${contact.company.trim()}`;
  }
  if (contact.fullName.trim()) {
    return `לכבוד ${contact.fullName.trim()}`;
  }
  return "לכבוד";
}

export function buildAddresseeLineManual(fields: {
  fullName?: string;
  company?: string;
}): string {
  if (fields.company?.trim()) {
    return `לכבוד ${fields.company.trim()}`;
  }
  if (fields.fullName?.trim()) {
    return `לכבוד ${fields.fullName.trim()}`;
  }
  return "לכבוד ועד הבית / חברת הניהול";
}

export function buildRecipientSnapshotFromContact(
  contact: ProjectContactWithDetails
): MasterLetterRecipientSnapshot {
  return {
    contactId: contact.contactId,
    manual: false,
    fullName: contact.fullName,
    company: contact.company || null,
    roleTitle: contact.projectRole || contact.roleTitle || null,
    email: contact.email || null,
    addresseeLine: buildAddresseeLineFromContact(contact),
  };
}

export function buildRecipientSnapshotFromDirectoryContact(
  contact: Pick<
    Contact,
    "id" | "fullName" | "company" | "roleTitle" | "email"
  >
): MasterLetterRecipientSnapshot {
  return {
    contactId: contact.id,
    manual: false,
    fullName: contact.fullName,
    company: contact.company || null,
    roleTitle: contact.roleTitle || null,
    email: contact.email || null,
    addresseeLine: buildAddresseeLineFromContact(contact),
  };
}

export function buildRecipientSnapshotManual(fields: {
  fullName?: string;
  company?: string;
  roleTitle?: string;
  email?: string;
}): MasterLetterRecipientSnapshot {
  return {
    contactId: null,
    manual: true,
    fullName: fields.fullName?.trim() ?? "",
    company: fields.company?.trim() || null,
    roleTitle: fields.roleTitle?.trim() || null,
    email: fields.email?.trim() || null,
    addresseeLine: buildAddresseeLineManual(fields),
  };
}

export function formatMasterLetterRecipientListLabel(
  recipients: MasterLetterRecipientSnapshot[]
): string {
  if (recipients.length === 0) return "—";

  const firstLabel =
    recipients[0].fullName.trim() ||
    recipients[0].company?.trim() ||
    recipients[0].addresseeLine ||
    "—";

  if (recipients.length === 1) return firstLabel;
  return `${firstLabel} + ${recipients.length - 1} נמענים`;
}

function parseRecipientSnapshot(
  raw: Record<string, unknown>
): MasterLetterRecipientSnapshot | null {
  const addresseeLine = String(raw.addresseeLine ?? "").trim();
  const fullName = String(raw.fullName ?? "").trim();
  const company = raw.company ? String(raw.company).trim() : null;

  if (!addresseeLine && !fullName && !company) return null;

  return {
    contactId: raw.contactId ? String(raw.contactId) : null,
    manual: Boolean(raw.manual),
    fullName,
    company,
    roleTitle: raw.roleTitle ? String(raw.roleTitle) : null,
    email: raw.email ? String(raw.email) : null,
    addresseeLine: addresseeLine || buildAddresseeLineManual({ fullName, company: company ?? undefined }),
  };
}

function parseRecipientSnapshotArray(raw: unknown): MasterLetterRecipientSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) =>
      item && typeof item === "object"
        ? parseRecipientSnapshot(item as Record<string, unknown>)
        : null
    )
    .filter((item): item is MasterLetterRecipientSnapshot => item !== null);
}

export function buildMasterLetterAiMetadata(
  metadata: MasterLetterStoredMetadata
): Record<string, unknown> {
  return {
    [MASTER_LETTER_METADATA_KEY]: metadata,
  };
}

export function parseMasterLetterMetadata(
  document: DocumentRecord
): MasterLetterStoredMetadata | null {
  const raw = document.ai_metadata;
  if (!raw || typeof raw !== "object") return null;

  const envelope = raw as Record<string, unknown>;
  const letter = envelope[MASTER_LETTER_METADATA_KEY];
  if (!letter || typeof letter !== "object") return null;

  const data = letter as Record<string, unknown>;
  if (Number(data.schemaVersion) !== MASTER_LETTER_METADATA_SCHEMA_VERSION) {
    return null;
  }

  const templateId = String(data.templateId ?? "") as MasterLetterTemplateId;
  if (!getMasterLetterTemplate(templateId)) return null;

  const section = String(data.section ?? "general");
  const normalizedSection: MasterLetterDossierSection =
    section === "inspections" || section === "faults" ? section : "general";

  let recipients = parseRecipientSnapshotArray(data.recipients);
  let cc = parseRecipientSnapshotArray(data.cc);

  if (recipients.length === 0 && data.recipient && typeof data.recipient === "object") {
    const legacy = parseRecipientSnapshot(data.recipient as Record<string, unknown>);
    if (legacy) recipients = [legacy];
  }

  if (recipients.length === 0) return null;

  const templateFieldsRaw = data.templateFields;
  const templateFields =
    templateFieldsRaw && typeof templateFieldsRaw === "object"
      ? (templateFieldsRaw as Record<string, MasterLetterFieldValue>)
      : undefined;

  let inspectorFollowUp: MasterLetterInspectorFollowUpMetadata | null = null;
  const followUpRaw = data.inspectorFollowUp;
  if (followUpRaw && typeof followUpRaw === "object") {
    const followUp = followUpRaw as Record<string, unknown>;
    const reportDocumentId = String(followUp.reportDocumentId ?? "").trim();
    const letterStage = String(followUp.letterStage ?? "").trim();
    if (
      reportDocumentId &&
      (letterStage === "letter_1" ||
        letterStage === "letter_2" ||
        letterStage === "letter_3")
    ) {
      inspectorFollowUp = {
        reportDocumentId,
        letterStage,
      };
    }
  }

  return {
    schemaVersion: MASTER_LETTER_METADATA_SCHEMA_VERSION,
    templateId,
    subject: String(data.subject ?? document.title),
    section: normalizedSection,
    recipients,
    cc,
    recipient: recipients[0],
    templateFields,
    customNote: data.customNote ? String(data.customNote) : null,
    letterDate: data.letterDate ? String(data.letterDate) : null,
    elevatorId: data.elevatorId ? String(data.elevatorId) : null,
    elevatorName: data.elevatorName ? String(data.elevatorName) : null,
    bodyText: data.bodyText ? String(data.bodyText) : null,
    generatedAt: String(data.generatedAt ?? document.created_at),
    inspectorFollowUp,
  };
}

export function getMasterLetterListDisplay(
  document: DocumentRecord
): MasterLetterListDisplay {
  const metadata = parseMasterLetterMetadata(document);
  if (metadata) {
    return {
      subject: metadata.subject,
      recipient: formatMasterLetterRecipientListLabel(metadata.recipients),
      templateLabel:
        getMasterLetterTemplate(metadata.templateId)?.label ?? metadata.templateId,
      sectionLabel: MASTER_LETTER_DOSSIER_SECTION_LABELS[metadata.section],
      isHistorical: false,
      canEdit: true,
    };
  }

  const descriptionParts = document.description?.split(" · ") ?? [];
  return {
    subject: descriptionParts[1]?.trim() || document.title,
    recipient: "—",
    templateLabel: descriptionParts[0]?.trim() || "—",
    sectionLabel: "—",
    isHistorical: true,
    canEdit: false,
  };
}
