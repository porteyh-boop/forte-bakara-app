import type { SalesLead } from "@/lib/sales-leads";

/** Synthetic QA marker — used only to suppress owner Telegram for QA trial buildings. */
export const SALES_TRIAL_QA_CLIENT_NAME_PREFIX = "QA-TRIAL-PORTAL";
export const SALES_TRIAL_QA_EMAIL_DOMAIN = "qa.forte.invalid";
export const SALES_TRIAL_QA_PHONE = "0500000000";

export function isSyntheticSalesTrialQaLead(input: {
  clientName: string;
  email?: string;
  phone?: string;
}): boolean {
  const name = input.clientName.trim();
  if (!name.startsWith(SALES_TRIAL_QA_CLIENT_NAME_PREFIX)) return false;
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").replace(/\D/g, "");
  if (email && !email.endsWith(`@${SALES_TRIAL_QA_EMAIL_DOMAIN}`)) return false;
  if (phone && phone !== SALES_TRIAL_QA_PHONE.replace(/\D/g, "")) return false;
  return true;
}

/** GET meta: may provision when no trial building yet and building name is set. */
export function canOpenSalesLeadTrialPortalForLead(
  lead: Pick<SalesLead, "trialBuildingId" | "buildingName">
): boolean {
  if (lead.trialBuildingId?.trim()) return false;
  return Boolean(lead.buildingName?.trim());
}
