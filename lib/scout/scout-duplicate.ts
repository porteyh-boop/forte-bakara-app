import type { SalesLead } from "@/lib/sales-leads";

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export type ScoutDuplicateInput = {
  organizationName: string;
  buildingName: string;
  city: string;
  phone: string;
  email: string;
};

export type ScoutDuplicateResult = {
  duplicateLeadId: string | null;
  duplicateMatchReason: string;
};

export function findDuplicateSalesLead(
  candidate: ScoutDuplicateInput,
  leads: SalesLead[]
): ScoutDuplicateResult {
  const org = normalizeText(candidate.organizationName);
  const building = normalizeText(candidate.buildingName);
  const city = normalizeText(candidate.city);
  const phone = digitsOnly(candidate.phone);
  const email = normalizeText(candidate.email);

  for (const lead of leads) {
    const leadPhone = digitsOnly(lead.phone);
    if (phone.length >= 9 && leadPhone.length >= 9 && phone === leadPhone) {
      return {
        duplicateLeadId: lead.id,
        duplicateMatchReason: `טלפון זהה לליד קיים (${lead.clientName})`,
      };
    }

    const leadEmail = normalizeText(lead.email);
    if (email.length >= 5 && leadEmail.length >= 5 && email === leadEmail) {
      return {
        duplicateLeadId: lead.id,
        duplicateMatchReason: `דוא"ל זהה לליד קיים (${lead.clientName})`,
      };
    }

    const leadOrg = normalizeText(lead.clientName);
    const leadBuilding = normalizeText(lead.buildingName);
    const leadCity = normalizeText(lead.city);

    if (
      org.length >= 4 &&
      city.length >= 2 &&
      leadOrg.length >= 4 &&
      leadCity === city &&
      (leadOrg === org || leadOrg.includes(org) || org.includes(leadOrg))
    ) {
      return {
        duplicateLeadId: lead.id,
        duplicateMatchReason: `שם ארגון/לקוח דומה ב-${lead.city} (${lead.clientName})`,
      };
    }

    if (
      building.length >= 4 &&
      city.length >= 2 &&
      leadBuilding.length >= 4 &&
      leadCity === city &&
      (leadBuilding === building ||
        leadBuilding.includes(building) ||
        building.includes(leadBuilding))
    ) {
      return {
        duplicateLeadId: lead.id,
        duplicateMatchReason: `שם בניין דומה ב-${lead.city} (${lead.buildingName || lead.clientName})`,
      };
    }
  }

  return { duplicateLeadId: null, duplicateMatchReason: "" };
}
