import {
  actionTypeRequiresApproval,
  AI_AGENT_KEYS,
  classifyActionRisk,
  type AiActionDto,
  type AiAgentDto,
  type AiAgentKey,
  type AiAgentStatusId,
  type AiApprovalDto,
  type AiApprovalStatusId,
  type AiTaskDto,
  type AiTaskStatusId,
  type ForteAiMarketingDashboardDto,
  type ForteAiMarketingSummaryDto,
} from "@/lib/forte-ai-marketing";
import {
  CLOSED_SALES_LEAD_STATUSES,
  type SalesLeadStatus,
} from "@/lib/sales-leads";
import { SALES_LEADS_TABLE } from "@/lib/sales-leads-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export type ForteAiMarketingServerError =
  | "supabase_service_unconfigured"
  | "supabase_unreachable"
  | "load_failed"
  | "invalid_approval_id"
  | "not_found"
  | "invalid_status"
  | "save_failed";

const AGENTS_TABLE = "ai_agents";
const TASKS_TABLE = "ai_tasks";
const ACTIONS_TABLE = "ai_actions";
const APPROVALS_TABLE = "ai_approvals";
const CONTENT_TABLE = "marketing_content";
const CAMPAIGNS_TABLE = "marketing_campaigns";

const INTERESTED_STATUSES: SalesLeadStatus[] = [
  "נוצר קשר",
  "בירור-פגישה",
  "הצעה נשלחה",
  "משא ומתן",
];

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function mapDashboardLoadError(message: string): ForteAiMarketingServerError {
  const lower = message.toLowerCase();
  if (lower.includes("fetch failed") || lower.includes("network")) {
    return "supabase_unreachable";
  }
  if (
    lower.includes("does not exist") ||
    lower.includes("42p01") ||
    lower.includes("schema cache")
  ) {
    return "load_failed";
  }
  return "load_failed";
}

function asAgentKey(value: unknown): AiAgentKey | null {
  const raw = asString(value).trim();
  return (AI_AGENT_KEYS as readonly string[]).includes(raw)
    ? (raw as AiAgentKey)
    : null;
}

function mapAgent(row: Record<string, unknown>): AiAgentDto {
  return {
    id: asString(row.id),
    agentKey: asAgentKey(row.agent_key) ?? "manager",
    displayName: asString(row.display_name),
    description: asString(row.description),
    status: asString(row.status) as AiAgentStatusId,
    updatedAt: asString(row.updated_at),
  };
}

function mapTask(
  row: Record<string, unknown>,
  agentKeyById: Map<string, AiAgentKey>
): AiTaskDto {
  const agentId = asString(row.agent_id);
  return {
    id: asString(row.id),
    agentId,
    agentKey: agentKeyById.get(agentId) ?? null,
    taskType: asString(row.task_type),
    title: asString(row.title),
    description: asString(row.description),
    status: asString(row.status) as AiTaskStatusId,
    priority: Number(row.priority) || 0,
    leadId: asString(row.lead_id) || null,
    dueAt: asString(row.due_at) || null,
    updatedAt: asString(row.updated_at),
  };
}

function mapAction(
  row: Record<string, unknown>,
  agentKeyById: Map<string, AiAgentKey>
): AiActionDto {
  const agentId = asString(row.agent_id);
  return {
    id: asString(row.id),
    agentId,
    agentKey: agentKeyById.get(agentId) ?? null,
    taskId: asString(row.task_id) || null,
    actionType: asString(row.action_type),
    riskLevel: asString(row.risk_level) as AiActionDto["riskLevel"],
    requiresApproval: Boolean(row.requires_approval),
    summary: asString(row.summary),
    createdAt: asString(row.created_at),
  };
}

function mapApproval(
  row: Record<string, unknown>,
  actionSummary: string,
  agentKey: AiAgentKey | null,
  linkedPostImageUrl: string | null = null
): AiApprovalDto {
  return {
    id: asString(row.id),
    actionId: asString(row.action_id),
    approvalKind: asString(row.approval_kind),
    status: asString(row.status) as AiApprovalStatusId,
    approverLabel: asString(row.approver_label),
    decisionNote: asString(row.decision_note),
    summary: actionSummary,
    agentKey,
    linkedPostImageUrl,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

async function buildAgentKeyMap(sb: SupabaseService): Promise<Map<string, AiAgentKey>> {
  const { data } = await sb.from(AGENTS_TABLE).select("id, agent_key");
  const map = new Map<string, AiAgentKey>();
  for (const row of data ?? []) {
    const key = asAgentKey((row as Record<string, unknown>).agent_key);
    if (key) map.set(asString((row as Record<string, unknown>).id), key);
  }
  return map;
}

type SupabaseService = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

async function loadMarketingSummary(
  sb: SupabaseService
): Promise<ForteAiMarketingSummaryDto> {
  const summary: ForteAiMarketingSummaryDto = {
    leadsOpen: 0,
    contentItems: 0,
    campaigns: 0,
    interestedLeads: 0,
    salesWins: 0,
  };

  const { data: leads } = await sb
    .from(SALES_LEADS_TABLE)
    .select("status");
  for (const row of leads ?? []) {
    const status = asString((row as Record<string, unknown>).status);
    if (!(CLOSED_SALES_LEAD_STATUSES as readonly string[]).includes(status)) {
      summary.leadsOpen += 1;
    }
    if (status === "זכייה") summary.salesWins += 1;
    if ((INTERESTED_STATUSES as readonly string[]).includes(status as SalesLeadStatus)) {
      summary.interestedLeads += 1;
    }
  }

  const { count: contentCount } = await sb
    .from(CONTENT_TABLE)
    .select("id", { count: "exact", head: true });
  summary.contentItems = contentCount ?? 0;

  const { count: campaignCount } = await sb
    .from(CAMPAIGNS_TABLE)
    .select("id", { count: "exact", head: true });
  summary.campaigns = campaignCount ?? 0;

  return summary;
}

export async function loadForteAiMarketingDashboardServer(): Promise<{
  dashboard: ForteAiMarketingDashboardDto | null;
  error: ForteAiMarketingServerError | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { dashboard: null, error: "supabase_service_unconfigured" };
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return { dashboard: null, error: "supabase_service_unconfigured" };
  const db = sb;

  try {
    const { data: agentRows, error: agentErr } = await db
      .from(AGENTS_TABLE)
      .select("id, agent_key, display_name, description, status, updated_at")
      .order("agent_key", { ascending: true });

    if (agentErr) {
      console.warn("[forte-ai-marketing] agents load failed:", agentErr.message);
      return {
        dashboard: null,
        error: mapDashboardLoadError(agentErr.message),
      };
    }

    const agents = (agentRows ?? []).map((r) =>
      mapAgent(r as Record<string, unknown>)
    );
    const agentKeyById = new Map(agents.map((a) => [a.id, a.agentKey]));

    const { data: taskRows } = await db
      .from(TASKS_TABLE)
      .select(
        "id, agent_id, task_type, title, description, status, priority, lead_id, due_at, updated_at"
      )
      .in("status", ["pending", "running"])
      .order("updated_at", { ascending: false })
      .limit(30);

    const activeTasks = (taskRows ?? []).map((r) =>
      mapTask(r as Record<string, unknown>, agentKeyById)
    );

    const { data: actionRows } = await db
      .from(ACTIONS_TABLE)
      .select(
        "id, agent_id, task_id, action_type, risk_level, requires_approval, summary, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(25);

    const recentActions = (actionRows ?? []).map((r) =>
      mapAction(r as Record<string, unknown>, agentKeyById)
    );

    const { data: approvalRows } = await db
      .from(APPROVALS_TABLE)
      .select(
        "id, action_id, approval_kind, status, approver_label, decision_note, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(30);

    const actionSummaryById = new Map(
      recentActions.map((a) => [a.id, a.summary])
    );
    for (const row of actionRows ?? []) {
      const id = asString((row as Record<string, unknown>).id);
      actionSummaryById.set(id, asString((row as Record<string, unknown>).summary));
    }

    const pendingActionIds = [
      ...new Set(
        (approvalRows ?? []).map((row) =>
          asString((row as Record<string, unknown>).action_id)
        )
      ),
    ].filter(Boolean);

    const actionDetailsById = new Map<
      string,
      { actionType: string; details: Record<string, unknown> }
    >();
    if (pendingActionIds.length > 0) {
      const { data: pendingActionRows } = await db
        .from(ACTIONS_TABLE)
        .select("id, action_type, details, summary, agent_id")
        .in("id", pendingActionIds);
      for (const row of pendingActionRows ?? []) {
        const rec = row as Record<string, unknown>;
        const id = asString(rec.id);
        const detailsRaw = rec.details;
        const details =
          detailsRaw && typeof detailsRaw === "object"
            ? (detailsRaw as Record<string, unknown>)
            : {};
        actionDetailsById.set(id, {
          actionType: asString(rec.action_type),
          details,
        });
        const summary = asString(rec.summary);
        if (summary) actionSummaryById.set(id, summary);
      }
    }

    const linkedPostIds = [
      ...new Set(
        [...actionDetailsById.values()]
          .filter((a) => a.actionType === "send_social_post")
          .map((a) => asString(a.details.postId).trim())
          .filter(Boolean)
      ),
    ];

    const postImageById = new Map<string, string>();
    if (linkedPostIds.length > 0) {
      const { data: postRows } = await db
        .from("social_marketing_posts")
        .select("id, image_url")
        .in("id", linkedPostIds);
      for (const row of postRows ?? []) {
        const rec = row as Record<string, unknown>;
        const pid = asString(rec.id);
        const url = asString(rec.image_url).trim();
        if (pid && url) postImageById.set(pid, url);
      }
    }

    const pendingApprovals: AiApprovalDto[] = [];
    for (const row of approvalRows ?? []) {
      const rec = row as Record<string, unknown>;
      const actionId = asString(rec.action_id);
      let summary = actionSummaryById.get(actionId) ?? "";
      let agentKey: AiAgentKey | null = null;
      const actionMeta = actionDetailsById.get(actionId);
      if (!summary && actionMeta) {
        const { data: actionRow } = await db
          .from(ACTIONS_TABLE)
          .select("summary, agent_id")
          .eq("id", actionId)
          .maybeSingle();
        if (actionRow) {
          summary = asString((actionRow as Record<string, unknown>).summary);
          const aid = asString((actionRow as Record<string, unknown>).agent_id);
          agentKey = agentKeyById.get(aid) ?? null;
        }
      } else {
        const action = recentActions.find((a) => a.id === actionId);
        agentKey = action?.agentKey ?? null;
        if (!agentKey && actionMeta) {
          const { data: actionRow } = await db
            .from(ACTIONS_TABLE)
            .select("agent_id")
            .eq("id", actionId)
            .maybeSingle();
          if (actionRow) {
            const aid = asString((actionRow as Record<string, unknown>).agent_id);
            agentKey = agentKeyById.get(aid) ?? null;
          }
        }
      }

      let linkedPostImageUrl: string | null = null;
      if (actionMeta?.actionType === "send_social_post") {
        const postId = asString(actionMeta.details.postId).trim();
        if (postId) linkedPostImageUrl = postImageById.get(postId) ?? null;
      }

      pendingApprovals.push(mapApproval(rec, summary, agentKey, linkedPostImageUrl));
    }

    const summary = await loadMarketingSummary(db);

    return {
      dashboard: {
        agents,
        activeTasks,
        recentActions,
        pendingApprovals,
        summary,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[forte-ai-marketing] dashboard error:", message);
    return {
      dashboard: null,
      error: mapDashboardLoadError(message),
    };
  }
}

export async function patchAiApprovalStatusServer(input: {
  approvalId: string;
  status: "approved" | "rejected";
  decisionNote?: string;
}): Promise<{ approval: AiApprovalDto | null; error: ForteAiMarketingServerError | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { approval: null, error: "supabase_service_unconfigured" };
  }

  const approvalId = input.approvalId.trim();
  if (!approvalId) {
    return { approval: null, error: "invalid_approval_id" };
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return { approval: null, error: "supabase_service_unconfigured" };

  const { data: existing, error: loadErr } = await sb
    .from(APPROVALS_TABLE)
    .select("id, action_id, status")
    .eq("id", approvalId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { approval: null, error: loadErr ? "load_failed" : "not_found" };
  }

  if (asString((existing as Record<string, unknown>).status) !== "pending") {
    return { approval: null, error: "invalid_status" };
  }

  const actionId = asString((existing as Record<string, unknown>).action_id);
  const { data: actionRow } = await sb
    .from(ACTIONS_TABLE)
    .select("action_type, details")
    .eq("id", actionId)
    .maybeSingle();

  const actionType = actionRow
    ? asString((actionRow as Record<string, unknown>).action_type).trim().toLowerCase()
    : "";
  const details =
    actionRow && typeof (actionRow as Record<string, unknown>).details === "object"
      ? ((actionRow as Record<string, unknown>).details as Record<string, unknown>)
      : {};
  const linkedPostId = asString(details.postId).trim();

  if (actionType === "send_social_post" && linkedPostId) {
    const { applyJudahDecisionToSocialPostServer } = await import(
      "@/lib/social-marketing/social-marketing-server"
    );
    const synced = await applyJudahDecisionToSocialPostServer(linkedPostId, input.status);
    if (synced.error) {
      return { approval: null, error: synced.error === "not_found" ? "not_found" : "save_failed" };
    }
  }

  const now = new Date().toISOString();
  const { data: updated, error: saveErr } = await sb
    .from(APPROVALS_TABLE)
    .update({
      status: input.status,
      decision_note: (input.decisionNote ?? "").trim(),
      decided_at: now,
      updated_at: now,
    })
    .eq("id", approvalId)
    .select(
      "id, action_id, approval_kind, status, approver_label, decision_note, created_at, updated_at"
    )
    .maybeSingle();

  if (saveErr || !updated) {
    return { approval: null, error: "save_failed" };
  }

  const updatedActionId = asString((updated as Record<string, unknown>).action_id);
  const { data: actionRowForMap } = await sb
    .from(ACTIONS_TABLE)
    .select("summary, agent_id")
    .eq("id", updatedActionId)
    .maybeSingle();

  const agentKeyById = await buildAgentKeyMap(sb);
  const agentId = actionRowForMap
    ? asString((actionRowForMap as Record<string, unknown>).agent_id)
    : "";
  const summary = actionRowForMap
    ? asString((actionRowForMap as Record<string, unknown>).summary)
    : "";

  return {
    approval: mapApproval(
      updated as Record<string, unknown>,
      summary,
      agentKeyById.get(agentId) ?? null
    ),
    error: null,
  };
}

/** Core audit + approval registration for future agent runners (phase 1 API only). */
export async function recordAiActionServer(input: {
  agentKey: AiAgentKey;
  actionType: string;
  summary: string;
  taskId?: string | null;
  leadId?: string | null;
  details?: Record<string, unknown>;
}): Promise<{
  actionId: string | null;
  approvalId: string | null;
  error: ForteAiMarketingServerError | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { actionId: null, approvalId: null, error: "supabase_service_unconfigured" };
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return { actionId: null, approvalId: null, error: "supabase_service_unconfigured" };
  }

  const { data: agentRow } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", input.agentKey)
    .maybeSingle();

  if (!agentRow) {
    return { actionId: null, approvalId: null, error: "load_failed" };
  }

  const requiresApproval = actionTypeRequiresApproval(input.actionType);
  const riskLevel = classifyActionRisk(input.actionType);

  const { data: actionRow, error: actionErr } = await sb
    .from(ACTIONS_TABLE)
    .insert({
      agent_id: asString((agentRow as Record<string, unknown>).id),
      task_id: input.taskId?.trim() || null,
      action_type: input.actionType.trim(),
      risk_level: riskLevel,
      requires_approval: requiresApproval,
      summary: input.summary.trim(),
      details: input.details ?? {},
      lead_id: input.leadId?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (actionErr || !actionRow) {
    return { actionId: null, approvalId: null, error: "save_failed" };
  }

  const actionId = asString((actionRow as Record<string, unknown>).id);
  if (!requiresApproval) {
    return { actionId, approvalId: null, error: null };
  }

  const { data: approvalRow, error: approvalErr } = await sb
    .from(APPROVALS_TABLE)
    .insert({
      action_id: actionId,
      approval_kind: input.actionType.trim(),
      status: "pending",
      approver_label: "יהודה",
    })
    .select("id")
    .maybeSingle();

  if (approvalErr || !approvalRow) {
    return { actionId, approvalId: null, error: "save_failed" };
  }

  return {
    actionId,
    approvalId: asString((approvalRow as Record<string, unknown>).id),
    error: null,
  };
}
