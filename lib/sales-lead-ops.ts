import {
  normalizeContactPhoneForLookup,
  type Contact,
  type ContactInput,
} from "@/lib/contacts";
import type { SalesLead } from "@/lib/sales-leads";

export const SALES_CONTACT_NOTES_PREFIX = "[מכירות]";

export type SalesWinMissingField = "buildingName";

export type OpenedSalesProject = {
  buildingId: string;
  path: string;
};

export function salesLeadCanSyncContact(
  lead: Pick<SalesLead, "contactName" | "phone" | "email">
): boolean {
  return Boolean(
    lead.contactName.trim() && (lead.phone.trim() || lead.email.trim())
  );
}

export function buildSalesContactNotes(
  lead: Pick<SalesLead, "buildingName" | "address" | "city">
): string {
  const parts = [
    lead.buildingName.trim() ? `בניין: ${lead.buildingName.trim()}` : "",
    lead.address.trim() ? `כתובת: ${lead.address.trim()}` : "",
    lead.city.trim() ? `עיר: ${lead.city.trim()}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "";
  return `${SALES_CONTACT_NOTES_PREFIX} ${parts.join(" · ")}`;
}

export function buildSalesContactInput(
  lead: Pick<
    SalesLead,
    "contactName" | "clientName" | "phone" | "email" | "buildingName" | "address" | "city"
  >
): ContactInput {
  return {
    fullName: lead.contactName.trim(),
    company: lead.clientName.trim(),
    roleTitle: "",
    phone: lead.phone.trim(),
    email: lead.email.trim(),
    notes: buildSalesContactNotes(lead),
  };
}

export function mergeSalesContactNotes(
  existingNotes: string,
  nextNotes: string
): string {
  const current = existingNotes.trim();
  if (!current || current.startsWith(SALES_CONTACT_NOTES_PREFIX)) {
    return nextNotes;
  }
  return current;
}

/** Phone first, then email. Exact normalized match only. */
export function findSalesContactByPhoneThenEmail(
  input: Pick<ContactInput, "phone" | "email">,
  contacts: Contact[]
): Contact | null {
  const phoneNorm = normalizeContactPhoneForLookup(input.phone);
  if (phoneNorm) {
    const match = contacts.find(
      (contact) => normalizeContactPhoneForLookup(contact.phone) === phoneNorm
    );
    if (match) return match;
  }

  const email = input.email.trim().toLowerCase();
  if (email) {
    return (
      contacts.find((contact) => contact.email.trim().toLowerCase() === email) ??
      null
    );
  }

  return null;
}

export function missingWinProjectFields(
  lead: Pick<SalesLead, "buildingName" | "convertedBuildingId" | "status">
): SalesWinMissingField[] {
  if (lead.convertedBuildingId) return [];
  if (lead.status !== "זכייה") return [];
  return lead.buildingName.trim() ? [] : ["buildingName"];
}

export function salesWinMissingFieldLabel(field: SalesWinMissingField): string {
  if (field === "buildingName") return "שם בניין";
  return field;
}
