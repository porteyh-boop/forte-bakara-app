import { getSupabaseServiceClient } from "@/lib/supabase-server";

const TASKS_TABLE = "ai_tasks";
const AGENTS_TABLE = "ai_agents";
const TASK_TYPE = "marketing_ai_generate_batch";
const LOCK_MAX_AGE_MS = 5 * 60 * 1000;

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function marketingAgentId(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>
): Promise<string | null> {
  const { data } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", "marketing")
    .maybeSingle();
  return data ? asString((data as Record<string, unknown>).id) : null;
}

export async function acquireMarketingGenerateLock(): Promise<{
  taskId: string | null;
  error: "generation_in_progress" | "marketing_agent_missing" | "save_failed" | null;
}> {
  const sb = getSupabaseServiceClient();
  if (!sb) return { taskId: null, error: "save_failed" };

  const agentId = await marketingAgentId(sb);
  if (!agentId) return { taskId: null, error: "marketing_agent_missing" };

  const cutoff = new Date(Date.now() - LOCK_MAX_AGE_MS).toISOString();
  const { data: running } = await sb
    .from(TASKS_TABLE)
    .select("id")
    .eq("agent_id", agentId)
    .eq("task_type", TASK_TYPE)
    .eq("status", "running")
    .gte("updated_at", cutoff)
    .limit(1);

  if (running && running.length > 0) {
    return { taskId: null, error: "generation_in_progress" };
  }

  const now = new Date().toISOString();
  const { data: task, error } = await sb
    .from(TASKS_TABLE)
    .insert({
      agent_id: agentId,
      task_type: TASK_TYPE,
      title: "יצירת 3 פוסטים עם AI",
      description: "Marketing agent batch generation",
      status: "running",
      started_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();

  if (error || !task) return { taskId: null, error: "save_failed" };
  return { taskId: asString((task as Record<string, unknown>).id), error: null };
}

export async function releaseMarketingGenerateLock(
  taskId: string,
  outcome: "completed" | "failed"
): Promise<void> {
  const id = taskId.trim();
  if (!id) return;
  const sb = getSupabaseServiceClient();
  if (!sb) return;

  const now = new Date().toISOString();
  await sb
    .from(TASKS_TABLE)
    .update({
      status: outcome,
      completed_at: outcome === "completed" ? now : null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("task_type", TASK_TYPE);
}
