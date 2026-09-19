import {
  masterApiFetch,
  parseMasterApiError,
  parseMasterApiJson,
} from "@/lib/master-api-fetch";
import type {
  AiApprovalDto,
  ForteAiMarketingDashboardDto,
} from "@/lib/forte-ai-marketing";

const DASHBOARD_API = "/forte/api/master/ai-marketing/dashboard";
const APPROVALS_API = "/forte/api/master/ai-marketing/approvals";

interface DashboardResponse {
  dashboard?: ForteAiMarketingDashboardDto | null;
  error?: string | null;
}

interface ApprovalPatchResponse {
  approval?: AiApprovalDto | null;
  error?: string | null;
}

export async function fetchForteAiMarketingDashboard(): Promise<{
  dashboard: ForteAiMarketingDashboardDto | null;
  error: string | null;
}> {
  try {
    const response = await masterApiFetch(DASHBOARD_API, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await parseMasterApiJson<DashboardResponse>(response);
    if (!response.ok || !payload?.dashboard) {
      return {
        dashboard: null,
        error:
          payload?.error ?? parseMasterApiError(payload, response.status),
      };
    }
    return { dashboard: payload.dashboard, error: null };
  } catch (error) {
    console.warn("[forte-ai-marketing-api] dashboard error:", error);
    return { dashboard: null, error: "network" };
  }
}

export async function patchForteAiApproval(input: {
  approvalId: string;
  status: "approved" | "rejected";
  decisionNote?: string;
}): Promise<{ approval: AiApprovalDto | null; error: string | null }> {
  try {
    const response = await masterApiFetch(
      `${APPROVALS_API}/${encodeURIComponent(input.approvalId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: input.status,
          decisionNote: input.decisionNote ?? "",
        }),
      }
    );
    const payload = await parseMasterApiJson<ApprovalPatchResponse>(response);
    if (!response.ok || !payload?.approval) {
      return {
        approval: null,
        error:
          payload?.error ?? parseMasterApiError(payload, response.status),
      };
    }
    return { approval: payload.approval, error: null };
  } catch (error) {
    console.warn("[forte-ai-marketing-api] approval patch error:", error);
    return { approval: null, error: "network" };
  }
}
