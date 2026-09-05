import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
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

export async function createSalesLead(
  draft: SalesLeadDraft
): Promise<{ lead: SalesLead | null; error: string | null }> {
  try {
    const response = await masterApiFetch(MASTER_SALES_LEADS_API, {
      method: "POST",
      body: JSON.stringify(draft),
    });
    const payload = await parseMasterApiJson<LeadResponse>(response);
    if (!response.ok) {
      return { lead: null, error: await readApiError(response) };
    }
    return { lead: payload?.lead ?? null, error: payload?.lead ? null : "השמירה נכשלה. נסו שוב." };
  } catch {
    return { lead: null, error: "השמירה נכשלה. נסו שוב." };
  }
}

export async function updateSalesLead(
  leadId: string,
  draft: SalesLeadDraft
): Promise<{ lead: SalesLead | null; error: string | null }> {
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
      return { lead: null, error: await readApiError(response) };
    }
    return { lead: payload?.lead ?? null, error: payload?.lead ? null : "השמירה נכשלה. נסו שוב." };
  } catch {
    return { lead: null, error: "השמירה נכשלה. נסו שוב." };
  }
}
