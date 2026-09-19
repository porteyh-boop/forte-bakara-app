import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { findDuplicateSalesLead } from "@/lib/scout/scout-duplicate";
import { getScoutResearchProvider } from "@/lib/scout/scout-research-provider";
import { buildCandidateFromSearchHit } from "@/lib/scout/scout-scoring";
import type { ScoutSearchPayload } from "@/lib/scout/scout-types";
import { listSalesLeadsServer } from "@/lib/sales-leads-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const CANDIDATES_TABLE = "scout_lead_candidates";
const TASKS_TABLE = "ai_tasks";

export type ScoutRunError =
  | "supabase_service_unconfigured"
  | "task_not_found"
  | "search_unconfigured"
  | "search_failed"
  | "run_failed";

export async function runScoutTaskServer(taskId: string): Promise<{
  ok: boolean;
  error: ScoutRunError | string | null;
  candidatesAdded: number;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "supabase_service_unconfigured", candidatesAdded: 0 };
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return { ok: false, error: "supabase_service_unconfigured", candidatesAdded: 0 };
  }

  const provider = getScoutResearchProvider();
  if (!provider) {
    return { ok: false, error: "search_unconfigured", candidatesAdded: 0 };
  }

  const { data: taskRow, error: taskErr } = await sb
    .from(TASKS_TABLE)
    .select("id, payload, status")
    .eq("id", taskId)
    .maybeSingle();

  if (taskErr || !taskRow) {
    return { ok: false, error: "task_not_found", candidatesAdded: 0 };
  }

  const payload = (taskRow as { payload?: ScoutSearchPayload }).payload;
  if (!payload?.city?.trim() || !payload.targetType) {
    return { ok: false, error: "run_failed", candidatesAdded: 0 };
  }

  const now = new Date().toISOString();
  await sb
    .from(TASKS_TABLE)
    .update({ status: "running", started_at: now, updated_at: now })
    .eq("id", taskId);

  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_research_started",
    summary: `SCOUT התחיל מחקר: ${payload.city} (${payload.targetType})`,
    taskId,
    details: { provider: provider.id, payload },
  });

  let hits;
  try {
    hits = await provider.search(payload);
  } catch (error) {
    await sb
      .from(TASKS_TABLE)
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", taskId);
    await recordAiActionServer({
      agentKey: "scout",
      actionType: "scout_research_failed",
      summary: "SCOUT: חיפוש Serper נכשל",
      taskId,
      details: { message: error instanceof Error ? error.message : String(error) },
    });
    return { ok: false, error: "search_failed", candidatesAdded: 0 };
  }

  const leadsResult = await listSalesLeadsServer();
  const leads = leadsResult.leads ?? [];

  let candidatesAdded = 0;
  for (const hit of hits) {
    const dup = findDuplicateSalesLead(
      {
        organizationName: hit.title,
        buildingName: "",
        city: payload.city,
        phone: "",
        email: "",
      },
      leads
    );

    const draft = buildCandidateFromSearchHit({
      hit,
      payloadCity: payload.city,
      targetType: payload.targetType,
      hasDuplicate: Boolean(dup.duplicateLeadId),
    });

    const fullDup = findDuplicateSalesLead(
      {
        organizationName: draft.organizationName,
        buildingName: draft.buildingName,
        city: draft.city,
        phone: draft.phone,
        email: draft.email,
      },
      leads
    );

    const { error: insertErr } = await sb.from(CANDIDATES_TABLE).insert({
      task_id: taskId,
      candidate_type: payload.targetType,
      organization_name: draft.organizationName,
      building_name: draft.buildingName,
      city: draft.city,
      address: draft.address,
      contact_name: draft.contactName,
      phone: draft.phone,
      email: draft.email,
      public_notes: draft.publicNotes,
      source_url: draft.sourceUrl,
      source_title: draft.sourceTitle,
      source_snippet: draft.sourceSnippet,
      raw_evidence: draft.rawEvidence,
      match_score: draft.matchScore,
      score_rationale: draft.scoreRationale,
      duplicate_lead_id: fullDup.duplicateLeadId,
      duplicate_match_reason: fullDup.duplicateMatchReason,
      review_status: "pending",
      updated_at: now,
    });

    if (!insertErr) {
      candidatesAdded += 1;
      await recordAiActionServer({
        agentKey: "scout",
        actionType: fullDup.duplicateLeadId
          ? "scout_duplicate_flagged"
          : "scout_candidate_saved",
        summary: fullDup.duplicateLeadId
          ? `SCOUT: מועמד עם כפילות — ${draft.organizationName}`
          : `SCOUT: נשמר מועמד — ${draft.organizationName}`,
        taskId,
        details: {
          sourceUrl: draft.sourceUrl,
          score: draft.matchScore,
          duplicateLeadId: fullDup.duplicateLeadId,
        },
      });
    }
  }

  const completedAt = new Date().toISOString();
  await sb
    .from(TASKS_TABLE)
    .update({
      status: "completed",
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", taskId);

  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_research_completed",
    summary: `SCOUT סיים מחקר — ${candidatesAdded} מועמדים`,
    taskId,
    details: { hits: hits.length, candidatesAdded },
  });

  return { ok: true, error: null, candidatesAdded };
}
