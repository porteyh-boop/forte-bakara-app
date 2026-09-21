import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { SCOUT_TASK_TYPE } from "@/lib/scout/scout-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const TASKS_TABLE = "ai_tasks";
const CANDIDATES_TABLE = "scout_lead_candidates";
const AGENTS_TABLE = "ai_agents";

export type ScoutCleanupError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "not_found"
  | "task_running"
  | "save_failed";

export type ScoutTaskCleanupOptions = {
  failed: boolean;
  completed: boolean;
  emptyStale: boolean;
};

export type ScoutCandidateCleanupOptions = {
  rejected: boolean;
  unsuitable: boolean;
  imported: boolean;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function scoutAgentId(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>
): Promise<string | null> {
  const { data } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", "scout")
    .maybeSingle();
  return data ? asString((data as Record<string, unknown>).id) : null;
}

async function isScoutTask(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  taskId: string,
  agentId: string
): Promise<{ ok: boolean; status: string }> {
  const { data } = await sb
    .from(TASKS_TABLE)
    .select("id, status, task_type, agent_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!data) return { ok: false, status: "" };
  const row = data as Record<string, unknown>;
  if (asString(row.agent_id) !== agentId) return { ok: false, status: "" };
  if (asString(row.task_type) !== SCOUT_TASK_TYPE) return { ok: false, status: "" };
  return { ok: true, status: asString(row.status) };
}

export async function deleteScoutTaskServer(taskId: string): Promise<{
  deleted: boolean;
  error: ScoutCleanupError | null;
}> {
  const id = taskId.trim();
  if (!id) return { deleted: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { deleted: false, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: false, error: "supabase_service_unconfigured" };

  const agentId = await scoutAgentId(sb);
  if (!agentId) return { deleted: false, error: "not_found" };

  const check = await isScoutTask(sb, id, agentId);
  if (!check.ok) return { deleted: false, error: "not_found" };
  if (check.status === "running") {
    return { deleted: false, error: "task_running" };
  }

  const { error } = await sb.from(TASKS_TABLE).delete().eq("id", id);
  if (error) return { deleted: false, error: "save_failed" };

  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_task_deleted",
    summary: "משימת איתור נמחקה",
    taskId: null,
    details: { deleted_task_id: id },
  });

  return { deleted: true, error: null };
}

export async function deleteScoutCandidateServer(candidateId: string): Promise<{
  deleted: boolean;
  error: ScoutCleanupError | null;
}> {
  const id = candidateId.trim();
  if (!id) return { deleted: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { deleted: false, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: false, error: "supabase_service_unconfigured" };

  const { data: row } = await sb
    .from(CANDIDATES_TABLE)
    .select("id, task_id, sales_lead_id, organization_name")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { deleted: false, error: "not_found" };

  const rec = row as Record<string, unknown>;
  const salesLeadId = asString(rec.sales_lead_id) || null;

  const { error } = await sb.from(CANDIDATES_TABLE).delete().eq("id", id);
  if (error) return { deleted: false, error: "save_failed" };

  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_candidate_deleted",
    summary: `מועמד הוסר מרשימת האיתור — ${asString(rec.organization_name) || "מועמד"}`,
    taskId: asString(rec.task_id) || null,
    leadId: salesLeadId,
    details: {
      candidate_id: id,
      sales_lead_preserved: Boolean(salesLeadId),
    },
  });

  return { deleted: true, error: null };
}

async function listScoutTaskIdsForCleanup(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  agentId: string,
  options: ScoutTaskCleanupOptions
): Promise<string[]> {
  const { data: rows } = await sb
    .from(TASKS_TABLE)
    .select("id, status")
    .eq("agent_id", agentId)
    .eq("task_type", SCOUT_TASK_TYPE);

  const ids = new Set<string>();
  for (const row of rows ?? []) {
    const rec = row as Record<string, unknown>;
    const taskId = asString(rec.id);
    const status = asString(rec.status);
    if (status === "running") continue;

    if (options.failed && status === "failed") ids.add(taskId);
    if (options.completed && status === "completed") ids.add(taskId);

    if (options.emptyStale && (status === "completed" || status === "failed" || status === "cancelled")) {
      const { count } = await sb
        .from(CANDIDATES_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId);
      if ((count ?? 0) === 0) ids.add(taskId);
    }
  }
  return [...ids];
}

export async function previewScoutTaskCleanupServer(
  options: ScoutTaskCleanupOptions
): Promise<{ count: number; error: ScoutCleanupError | null }> {
  if (!options.failed && !options.completed && !options.emptyStale) {
    return { count: 0, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { count: 0, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { count: 0, error: "supabase_service_unconfigured" };
  const agentId = await scoutAgentId(sb);
  if (!agentId) return { count: 0, error: null };
  const ids = await listScoutTaskIdsForCleanup(sb, agentId, options);
  return { count: ids.length, error: null };
}

export async function executeScoutTaskCleanupServer(
  options: ScoutTaskCleanupOptions
): Promise<{ deleted: number; error: ScoutCleanupError | null }> {
  if (!options.failed && !options.completed && !options.emptyStale) {
    return { deleted: 0, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { deleted: 0, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: 0, error: "supabase_service_unconfigured" };
  const agentId = await scoutAgentId(sb);
  if (!agentId) return { deleted: 0, error: null };

  const ids = await listScoutTaskIdsForCleanup(sb, agentId, options);
  let deleted = 0;
  for (const taskId of ids) {
    const result = await deleteScoutTaskServer(taskId);
    if (result.deleted) deleted += 1;
  }

  if (deleted > 0) {
    await recordAiActionServer({
      agentKey: "scout",
      actionType: "scout_cleanup_completed",
      summary: `ניקוי משימות איתור — ${deleted} משימות הוסרו`,
      details: { deleted, options },
    });
  }

  return { deleted, error: null };
}

async function listCandidateIdsForCleanup(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  options: ScoutCandidateCleanupOptions
): Promise<string[]> {
  const ids = new Set<string>();

  if (options.rejected) {
    const { data } = await sb
      .from(CANDIDATES_TABLE)
      .select("id")
      .eq("review_status", "rejected");
    for (const row of data ?? []) ids.add(asString((row as Record<string, unknown>).id));
  }

  if (options.unsuitable) {
    const { data } = await sb
      .from(CANDIDATES_TABLE)
      .select("id")
      .eq("qualify_verdict", "unsuitable");
    for (const row of data ?? []) ids.add(asString((row as Record<string, unknown>).id));
  }

  if (options.imported) {
    const { data } = await sb
      .from(CANDIDATES_TABLE)
      .select("id")
      .eq("review_status", "imported");
    for (const row of data ?? []) ids.add(asString((row as Record<string, unknown>).id));
  }

  return [...ids];
}

export async function previewScoutCandidateCleanupServer(
  options: ScoutCandidateCleanupOptions
): Promise<{ count: number; error: ScoutCleanupError | null }> {
  if (!options.rejected && !options.unsuitable && !options.imported) {
    return { count: 0, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { count: 0, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { count: 0, error: "supabase_service_unconfigured" };
  const ids = await listCandidateIdsForCleanup(sb, options);
  return { count: ids.length, error: null };
}

export async function executeScoutCandidateCleanupServer(
  options: ScoutCandidateCleanupOptions
): Promise<{ deleted: number; error: ScoutCleanupError | null }> {
  if (!options.rejected && !options.unsuitable && !options.imported) {
    return { deleted: 0, error: "invalid_input" };
  }
  if (!isSupabaseServiceConfigured()) {
    return { deleted: 0, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: 0, error: "supabase_service_unconfigured" };

  const ids = await listCandidateIdsForCleanup(sb, options);
  let deleted = 0;
  for (const candidateId of ids) {
    const result = await deleteScoutCandidateServer(candidateId);
    if (result.deleted) deleted += 1;
  }

  if (deleted > 0) {
    await recordAiActionServer({
      agentKey: "scout",
      actionType: "scout_candidates_cleanup_completed",
      summary: `ניקוי מועמדים — ${deleted} מועמדים הוסרו מרשימת האיתור`,
      details: { deleted, options },
    });
  }

  return { deleted, error: null };
}
