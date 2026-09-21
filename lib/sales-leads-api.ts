import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { OpenedSalesProject, SalesWinMissingField } from "@/lib/sales-lead-ops";
import type {
  SalesLeadTrialPortalStatus,
  SalesLeadTrialProvisionInput,
  SalesLeadTrialProvisionResult,
} from "@/lib/sales-lead-trial-portal";
import type { SalesLead, SalesLeadDraft } from "@/lib/sales-leads";

const MASTER_SALES_LEADS_API = "/forte/api/master-sales-leads";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

interface ListResponse {
  leads?: SalesLead[];
  error?: string | null;
}

interface LeadResponse {
  lead?: SalesLead;
  error?: string | null;
  openedProject?: OpenedSalesProject | null;
  projectConversion?: { required: true; missing: SalesWinMissingField[] } | null;
}

export type SalesLeadSaveClientResult = {
  lead: SalesLead | null;
  error: string | null;
  openedProject: OpenedSalesProject | null;
  projectConversion: { required: true; missing: SalesWinMissingField[] } | null;
};

function emptySaveResult(error: string | null): SalesLeadSaveClientResult {
  return {
    lead: null,
    error,
    openedProject: null,
    projectConversion: null,
  };
}

function hebrewSalesApiError(error: string, status: number): string {
  if (error === "unauthorized" || status === 401) {
    return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
  }
  if (error === "origin_not_allowed" || status === 403) {
    return "הבקשה נחסמה.";
  }
  if (error === "supabase_service_unconfigured" || status === 503) {
    return "שמירת מכירות אינה זמינה כרגע.";
  }
  if (error === "not_found") return "הליד לא נמצא.";
  if (error === "missing_building_name") {
    return "יש להזין שם בניין לפני פתיחת הפורטל.";
  }
  if (error === "missing_elevators") {
    return "יש להגדיר לפחות מעלית אחת.";
  }
  if (error === "invalid_elevator_name") {
    return "יש להזין שם לכל מעלית.";
  }
  if (error === "invalid_floors_count") {
    return "יש להזין מספר תחנות תקין לכל מעלית.";
  }
  if (error === "invalid_lead_id" || error === "invalid_request") {
    return "הנתונים שנשלחו אינם תקינים.";
  }
  if (error === "save_failed") return "השמירה נכשלה. נסו שוב.";
  if (error === "trial_portal_disabled") {
    return "פורטל הניסיון אינו פעיל בסביבה זו.";
  }
  if (error === "trial_portal_lead_not_allowed") {
    return "פורטל הניסיון אינו מאושר לליד זה.";
  }
  if (error === "qa_lead_required") {
    return "פתיחת ניסיון זמינה רק לליד QA מסומן.";
  }
  if (error === "provision_failed") {
    return "לא ניתן היה לפתוח את הפורטל. נסה שוב.";
  }
  if (error === "invalid_building_service_type") {
    return "סוג השירות בליד אינו תואם לבניין — עדכנו את סוג השירות או נסו שוב לאחר עדכון המערכת.";
  }
  if (error === "lead_protected") {
    return "לא ניתן למחוק את הליד משום שהוא כבר מקושר לעבודה.";
  }
  return error || "שגיאת שרת.";
}

export type SalesLeadCleanupOptions = {
  closedNotWon: boolean;
  newUnconverted: boolean;
  staleInactive: boolean;
};

async function readApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  const raw = parseMasterApiError(payload, response.status);
  const hebrew = hebrewSalesApiError(raw, response.status);
  if (hebrew !== raw && hebrew) return hebrew;
  const msg = payload?.message?.trim();
  if (msg) return msg;
  return hebrew;
}

export async function listSalesLeads(): Promise<{
  leads: SalesLead[];
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(MASTER_SALES_LEADS_API, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await parseMasterApiJson<ListResponse>(response);
    if (!response.ok) {
      return { leads: [], error: await readApiError(response) };
    }
    return { leads: payload?.leads ?? [], error: null };
  } catch {
    return { leads: [], error: "לא ניתן לטעון את הלידים." };
  }
}

function saveResultFromPayload(
  payload: LeadResponse | null,
  fallbackError: string
): SalesLeadSaveClientResult {
  if (!payload?.lead) {
    return emptySaveResult(payload?.error ?? fallbackError);
  }
  return {
    lead: payload.lead,
    error: payload.error ?? null,
    openedProject: payload.openedProject ?? null,
    projectConversion: payload.projectConversion ?? null,
  };
}

export async function createSalesLead(
  draft: SalesLeadDraft
): Promise<SalesLeadSaveClientResult> {
  try {
    const response = await masterApiFetch(MASTER_SALES_LEADS_API, {
      method: "POST",
      body: JSON.stringify(draft),
    });
    const payload = await parseMasterApiJson<LeadResponse>(response);
    if (!response.ok) {
      return emptySaveResult(await readApiError(response));
    }
    return saveResultFromPayload(payload, "השמירה נכשלה. נסו שוב.");
  } catch {
    return emptySaveResult("השמירה נכשלה. נסו שוב.");
  }
}

export async function fetchSalesLeadTrialPortalStatus(leadId: string): Promise<{
  status: SalesLeadTrialPortalStatus | null;
  canProvision: boolean;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(
      `${MASTER_SALES_LEADS_API}/${encodeURIComponent(leadId)}/trial-portal`,
      { method: "GET", cache: "no-store" }
    );
    const payload = await parseMasterApiJson<{
      status?: SalesLeadTrialPortalStatus;
      meta?: { canProvision?: boolean };
      error?: string;
    }>(response);
    if (!response.ok) {
      return { status: null, canProvision: false, error: await readApiError(response) };
    }
    return {
      status: payload?.status ?? null,
      canProvision: payload?.meta?.canProvision === true,
      error: null,
    };
  } catch {
    return {
      status: null,
      canProvision: false,
      error: "לא ניתן לטעון את מצב הניסיון.",
    };
  }
}

export async function provisionSalesLeadTrialPortal(
  leadId: string,
  input: SalesLeadTrialProvisionInput
): Promise<{
  result: SalesLeadTrialProvisionResult | null;
  lead: SalesLead | null;
  status: SalesLeadTrialPortalStatus | null;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(
      `${MASTER_SALES_LEADS_API}/${encodeURIComponent(leadId)}/trial-portal`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
    const payload = await parseMasterApiJson<{
      result?: SalesLeadTrialProvisionResult;
      lead?: SalesLead;
      status?: SalesLeadTrialPortalStatus;
      error?: string;
    }>(response);
    if (!response.ok) {
      return {
        result: null,
        lead: null,
        status: null,
        error: await readApiError(response),
      };
    }
    return {
      result: payload?.result ?? null,
      lead: payload?.lead ?? null,
      status: payload?.status ?? null,
      error: null,
    };
  } catch {
    return {
      result: null,
      lead: null,
      status: null,
      error: "פתיחת הניסיון נכשלה.",
    };
  }
}

export async function deleteSalesLead(leadId: string): Promise<{
  deleted: boolean;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(
      `${MASTER_SALES_LEADS_API}/${encodeURIComponent(leadId)}`,
      { method: "DELETE" }
    );
    const payload = await parseMasterApiJson<{ deleted?: boolean; error?: string }>(
      response
    );
    if (!response.ok) {
      return { deleted: false, error: await readApiError(response) };
    }
    return { deleted: payload?.deleted === true, error: payload?.error ?? null };
  } catch {
    return { deleted: false, error: "מחיקת הליד נכשלה." };
  }
}

export async function previewSalesLeadCleanup(
  options: SalesLeadCleanupOptions
): Promise<{ count: number; sampleNames: string[]; error: string | null }> {
  try {
    const response = await masterApiFetch(`${MASTER_SALES_LEADS_API}/cleanup`, {
      method: "POST",
      body: JSON.stringify({ ...options, preview: true }),
    });
    const payload = await parseMasterApiJson<{
      count?: number;
      sampleNames?: string[];
      error?: string;
    }>(response);
    if (!response.ok) {
      return { count: 0, sampleNames: [], error: await readApiError(response) };
    }
    return {
      count: payload?.count ?? 0,
      sampleNames: payload?.sampleNames ?? [],
      error: null,
    };
  } catch {
    return { count: 0, sampleNames: [], error: "לא ניתן לטעון תצוגה מקדימה." };
  }
}

export async function executeSalesLeadCleanup(
  options: SalesLeadCleanupOptions
): Promise<{ deleted: number; error: string | null }> {
  try {
    const response = await masterApiFetch(`${MASTER_SALES_LEADS_API}/cleanup`, {
      method: "POST",
      body: JSON.stringify(options),
    });
    const payload = await parseMasterApiJson<{ deleted?: number; error?: string }>(
      response
    );
    if (!response.ok) {
      return { deleted: 0, error: await readApiError(response) };
    }
    return { deleted: payload?.deleted ?? 0, error: null };
  } catch {
    return { deleted: 0, error: "ניקוי הלידים נכשל." };
  }
}

export async function updateSalesLead(
  leadId: string,
  draft: SalesLeadDraft
): Promise<SalesLeadSaveClientResult> {
  try {
    const response = await masterApiFetch(
      `${MASTER_SALES_LEADS_API}/${encodeURIComponent(leadId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(draft),
      }
    );
    const payload = await parseMasterApiJson<LeadResponse>(response);
    if (!response.ok) {
      return emptySaveResult(await readApiError(response));
    }
    return saveResultFromPayload(payload, "השמירה נכשלה. נסו שוב.");
  } catch {
    return emptySaveResult("השמירה נכשלה. נסו שוב.");
  }
}
