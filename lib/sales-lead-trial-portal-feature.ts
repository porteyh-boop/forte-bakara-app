/** Server-only feature gate for sales trial portal (default off). */

export const SALES_TRIAL_PORTAL_ENV_ENABLED = "FORTE_SALES_TRIAL_PORTAL_ENABLED";
export const SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS =
  "FORTE_SALES_TRIAL_PORTAL_ALLOWED_LEAD_IDS";

/** Synthetic QA marker — leads with this client name prefix are QA-only flows. */
export const SALES_TRIAL_QA_CLIENT_NAME_PREFIX = "QA-TRIAL-PORTAL";
export const SALES_TRIAL_QA_EMAIL_DOMAIN = "qa.forte.invalid";
export const SALES_TRIAL_QA_PHONE = "0500000000";

export function isSalesTrialPortalFeatureEnabled(): boolean {
  const raw = process.env[SALES_TRIAL_PORTAL_ENV_ENABLED]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function parseSalesTrialPortalAllowedLeadIds(): Set<string> {
  const raw = process.env[SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS]?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isSalesTrialPortalAllowedForLead(leadId: string): boolean {
  if (!isSalesTrialPortalFeatureEnabled()) return false;
  const allowed = parseSalesTrialPortalAllowedLeadIds();
  if (allowed.size === 0) return false;
  return allowed.has(leadId.trim().toLowerCase());
}

export function salesTrialPortalFeatureDisabledError(): {
  error: string;
  message: string;
} {
  return {
    error: "trial_portal_disabled",
    message: "פורטל הניסיון אינו פעיל בסביבה זו.",
  };
}

export function salesTrialPortalLeadNotAllowedError(): {
  error: string;
  message: string;
} {
  return {
    error: "trial_portal_lead_not_allowed",
    message: "פורטל הניסיון אינו מאושר לליד זה.",
  };
}

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
