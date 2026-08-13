export const BUILDING_CONTACT_TYPES = [
  "ועד בית",
  "חברת ניהול",
  "יזם",
  "אחזקה",
  "חברת מעליות",
  "אחר",
] as const;

export type BuildingContactType = (typeof BUILDING_CONTACT_TYPES)[number];

export interface BuildingContact {
  id: string;
  buildingId: string;
  fullName: string;
  roleTitle: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  contactType: BuildingContactType;
  isPrimary: boolean;
  receivesReports: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildingContactInput {
  fullName: string;
  roleTitle: string;
  company: string;
  phone: string;
  whatsapp: string;
  email: string;
  contactType: BuildingContactType;
  isPrimary: boolean;
  receivesReports: boolean;
  notes: string;
}

export const emptyBuildingContactInput = (): BuildingContactInput => ({
  fullName: "",
  roleTitle: "",
  company: "",
  phone: "",
  whatsapp: "",
  email: "",
  contactType: "ועד בית",
  isPrimary: false,
  receivesReports: false,
  notes: "",
});

export function isBuildingContactType(value: string): value is BuildingContactType {
  return (BUILDING_CONTACT_TYPES as readonly string[]).includes(value);
}

export function validateBuildingContactInput(
  input: BuildingContactInput
): string | null {
  if (!input.fullName.trim()) return "יש להזין שם מלא.";
  if (!isBuildingContactType(input.contactType)) return "סוג איש קשר לא תקין.";
  return null;
}

export function buildingContactInputFromContact(
  contact: BuildingContact
): BuildingContactInput {
  return {
    fullName: contact.fullName,
    roleTitle: contact.roleTitle,
    company: contact.company,
    phone: contact.phone,
    whatsapp: contact.whatsapp,
    email: contact.email,
    contactType: contact.contactType,
    isPrimary: contact.isPrimary,
    receivesReports: contact.receivesReports,
    notes: contact.notes,
  };
}
