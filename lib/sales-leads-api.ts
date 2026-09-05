import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type { OpenedSalesProject, SalesWinMissingField } from "@/lib/sales-lead-ops";
import type { SalesLead, SalesLeadDraft } from "@/lib/sales-leads";

const MASTER_SALES_LEADS_API = "/forte/api/master-sales-leads";

interface ApiErrorPayload {
  error?: string;
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
  if (error === "not_found") return "הפנייה לא נמצאה.";
  if (error === "invalid_lead_id" || error === "invalid_request") {
    return "הנתונים שנשלחו אינם תקינים.";
  }
  if (error === "save_failed") return "השמירה נכשלה. נסו שוב.";
  return error || "שגיאת שרת.";
}

async function readApiError(response: Response): Promise<string> {
  const payload = await parseMasterApiJson<ApiErrorPayload>(response);
  const raw = parseMasterApiError(payload, response.status);
  return hebrewSalesApiError(raw, response.status);
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
