export interface Contact {
  id: string;
  fullName: string;
  company: string;
  roleTitle: string;
  phone: string;
  email: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  fullName: string;
  company: string;
  roleTitle: string;
  phone: string;
  email: string;
  notes: string;
}

export interface ProjectContact {
  id: string;
  contactId: string;
  buildingId: string;
  projectRole: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContactWithDetails extends ProjectContact {
  fullName: string;
  company: string;
  roleTitle: string;
  phone: string;
  email: string;
  notes: string;
}

export interface ProjectContactAttachInput {
  contactId: string;
  projectRole?: string;
  isPrimary?: boolean;
}

export interface ProjectContactUpdateInput {
  projectRole?: string;
  isPrimary?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyContactInput(): ContactInput {
  return {
    fullName: "",
    company: "",
    roleTitle: "",
    phone: "",
    email: "",
    notes: "",
  };
}

export function isValidContactEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return true;
  return EMAIL_RE.test(trimmed);
}

export function validateContactInput(input: ContactInput): string | null {
  if (!input.fullName.trim()) return "יש להזין שם מלא.";
  if (!isValidContactEmail(input.email)) return 'כתובת דוא"ל לא תקינה.';
  return null;
}

export function contactInputFromContact(contact: Contact): ContactInput {
  return {
    fullName: contact.fullName,
    company: contact.company,
    roleTitle: contact.roleTitle,
    phone: contact.phone,
    email: contact.email,
    notes: contact.notes,
  };
}

export function normalizeContactPhoneForLookup(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Exact match — email (case-insensitive) or normalized phone digits. */
export function findContactByExactMatch(
  input: ContactInput,
  contacts: Contact[]
): Contact | null {
  const email = input.email.trim().toLowerCase();
  if (email) {
    const match = contacts.find(
      (contact) => contact.email.trim().toLowerCase() === email
    );
    if (match) return match;
  }

  const phoneNorm = normalizeContactPhoneForLookup(input.phone);
  if (phoneNorm) {
    const match = contacts.find(
      (contact) =>
        normalizeContactPhoneForLookup(contact.phone) === phoneNorm
    );
    if (match) return match;
  }

  return null;
}

export function contactMatchesSearch(contact: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    contact.fullName,
    contact.company,
    contact.roleTitle,
    contact.phone,
    contact.email,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function projectContactMatchesSearch(
  contact: ProjectContactWithDetails,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    contact.fullName,
    contact.company,
    contact.roleTitle,
    contact.projectRole,
    contact.phone,
    contact.email,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
