import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { runScoutTaskServer } from "@/lib/scout/scout-runner";
import type {
  ScoutCandidateTypeId,
  ScoutLeadCandidateDto,
  ScoutReviewStatusId,
  ScoutSearchPayload,
  ScoutTaskDetailDto,
  ScoutTaskDto,
} from "@/lib/scout/scout-types";
import {
  SCOUT_CANDIDATE_TYPES,
  SCOUT_SALES_LEAD_SOURCE,
  SCOUT_TASK_TYPE,
} from "@/lib/scout/scout-types";
import { createSalesLeadServer } from "@/lib/sales-leads-server";
import type { SalesLeadDraft } from "@/lib/sales-leads";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const AGENTS_TABLE = "ai_agents";
const TASKS_TABLE = "ai_tasks";
const CANDIDATES_TABLE = "scout_lead_candidates";

export type ScoutServerError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "scout_agent_missing"
  | "save_failed"
  | "not_found"
  | "invalid_status"
  | "duplicate_blocked"
  | "import_failed";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function mapCandidate(row: Record<string, unknown>): ScoutLeadCandidateDto {
  const evidence = row.raw_evidence;
  return {
    id: asString(row.id),
    taskId: asString(row.task_id),
    candidateType: asString(row.candidate_type) as ScoutLeadCandidateDto["candidateType"],
    organizationName: asString(row.organization_name),
    buildingName: asString(row.building_name),
    city: asString(row.city),
    address: asString(row.address),
    contactName: asString(row.contact_name),
    phone: asString(row.phone),
    email: asString(row.email),
    publicNotes: asString(row.public_notes),
    sourceUrl: asString(row.source_url),
    sourceTitle: asString(row.source_title),
    sourceSnippet: asString(row.source_snippet),
    rawEvidence: Array.isArray(evidence)
      ? (evidence as ScoutLeadCandidateDto["rawEvidence"])
      : [],
    matchScore: Number(row.match_score) || 0,
    scoreRationale: asString(row.score_rationale),
    duplicateLeadId: asString(row.duplicate_lead_id) || null,
    duplicateMatchReason: asString(row.duplicate_match_reason),
    reviewStatus: asString(row.review_status) as ScoutReviewStatusId,
    salesLeadId: asString(row.sales_lead_id) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function parseScoutSearchPayload(body: unknown): ScoutSearchPayload | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const city = asString(raw.city).trim();
  const targetType = asString(raw.targetType).trim() as ScoutCandidateTypeId;
  if (!city) return null;
  if (!(SCOUT_CANDIDATE_TYPES as readonly string[]).includes(targetType)) {
    return null;
  }
  const maxRaw = Number(raw.maxResults);
  const maxResults = Number.isFinite(maxRaw)
    ? Math.min(15, Math.max(1, Math.floor(maxRaw)))
    : 5;
  return {
    city,
    region: asString(raw.region).trim(),
    targetType,
    maxResults,
  };
}

async function getScoutAgentId(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>
): Promise<string | null> {
  const { data } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", "scout")
    .maybeSingle();
  return data ? asString((data as Record<string, unknown>).id) : null;
}

export async function createScoutTaskServer(body: unknown): Promise<{
  task: ScoutTaskDto | null;
  error: ScoutServerError | null;
}> {
  const payload = parseScoutSearchPayload(body);
  if (!payload) return { task: null, error: "invalid_input" };

  if (!isSupabaseServiceConfigured()) {
    return { task: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { task: null, error: "supabase_service_unconfigured" };

  const agentId = await getScoutAgentId(sb);
  if (!agentId) return { task: null, error: "scout_agent_missing" };

  const title = `SCOUT: ${payload.city}${payload.region ? ` (${payload.region})` : ""}`;
  const description = `איתור ${payload.targetType}, עד ${payload.maxResults} תוצאות`;

  const { data, error } = await sb
    .from(TASKS_TABLE)
    .insert({
      agent_id: agentId,
      task_type: SCOUT_TASK_TYPE,
      title,
      description,
      status: "pending",
      payload,
    })
    .select("id, title, description, status, payload, created_at, updated_at")
    .single();

  if (error || !data) return { task: null, error: "save_failed" };

  const taskId = asString((data as Record<string, unknown>).id);
  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_task_created",
    summary: `נוצרה משימת SCOUT — ${title}`,
    taskId,
    details: { payload },
  });

  return {
    task: {
      id: taskId,
      title: asString((data as Record<string, unknown>).title),
      description: asString((data as Record<string, unknown>).description),
      status: asString((data as Record<string, unknown>).status),
      payload,
      createdAt: asString((data as Record<string, unknown>).created_at),
      updatedAt: asString((data as Record<string, unknown>).updated_at),
      candidateCount: 0,
    },
    error: null,
  };
}

export async function listScoutTasksServer(): Promise<{
  tasks: ScoutTaskDto[];
  error: ScoutServerError | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { tasks: [], error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { tasks: [], error: "supabase_service_unconfigured" };

  const agentId = await getScoutAgentId(sb);
  if (!agentId) return { tasks: [], error: null };

  const { data: rows } = await sb
    .from(TASKS_TABLE)
    .select("id, title, description, status, payload, created_at, updated_at")
    .eq("agent_id", agentId)
    .eq("task_type", SCOUT_TASK_TYPE)
    .order("created_at", { ascending: false })
    .limit(50);

  const tasks: ScoutTaskDto[] = [];
  for (const row of rows ?? []) {
    const rec = row as Record<string, unknown>;
    const taskId = asString(rec.id);
    const { count } = await sb
      .from(CANDIDATES_TABLE)
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId);
    tasks.push({
      id: taskId,
      title: asString(rec.title),
      description: asString(rec.description),
      status: asString(rec.status),
      payload: rec.payload as ScoutSearchPayload,
      createdAt: asString(rec.created_at),
      updatedAt: asString(rec.updated_at),
      candidateCount: count ?? 0,
    });
  }

  return { tasks, error: null };
}

export async function getScoutTaskDetailServer(taskId: string): Promise<{
  task: ScoutTaskDetailDto | null;
  error: ScoutServerError | null;
}> {
  if (!taskId.trim()) return { task: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { task: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { task: null, error: "supabase_service_unconfigured" };

  const { data: row } = await sb
    .from(TASKS_TABLE)
    .select("id, title, description, status, payload, created_at, updated_at")
    .eq("id", taskId)
    .maybeSingle();

  if (!row) return { task: null, error: "not_found" };

  const { data: candidates } = await sb
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("task_id", taskId)
    .order("match_score", { ascending: false });

  const rec = row as Record<string, unknown>;
  return {
    task: {
      id: asString(rec.id),
      title: asString(rec.title),
      description: asString(rec.description),
      status: asString(rec.status),
      payload: rec.payload as ScoutSearchPayload,
      createdAt: asString(rec.created_at),
      updatedAt: asString(rec.updated_at),
      candidateCount: (candidates ?? []).length,
      candidates: (candidates ?? []).map((c) =>
        mapCandidate(c as Record<string, unknown>)
      ),
    },
    error: null,
  };
}

export async function runScoutTaskByIdServer(taskId: string) {
  return runScoutTaskServer(taskId);
}

export async function patchScoutCandidateReviewServer(input: {
  candidateId: string;
  reviewStatus: "approved" | "rejected";
}): Promise<{ candidate: ScoutLeadCandidateDto | null; error: ScoutServerError | null }> {
  if (!input.candidateId.trim()) return { candidate: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { candidate: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { candidate: null, error: "supabase_service_unconfigured" };

  const { data: existing } = await sb
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", input.candidateId)
    .maybeSingle();

  if (!existing) return { candidate: null, error: "not_found" };
  const current = mapCandidate(existing as Record<string, unknown>);
  if (current.reviewStatus === "imported") {
    return { candidate: null, error: "invalid_status" };
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from(CANDIDATES_TABLE)
    .update({ review_status: input.reviewStatus, updated_at: now })
    .eq("id", input.candidateId)
    .select("*")
    .maybeSingle();

  if (error || !updated) return { candidate: null, error: "save_failed" };

  await recordAiActionServer({
    agentKey: "scout",
    actionType:
      input.reviewStatus === "approved"
        ? "scout_candidate_approved"
        : "scout_candidate_rejected",
    summary: `SCOUT: ${input.reviewStatus === "approved" ? "אושר" : "נדחה"} — ${current.organizationName}`,
    taskId: current.taskId,
    details: { candidateId: input.candidateId, sourceUrl: current.sourceUrl },
  });

  return {
    candidate: mapCandidate(updated as Record<string, unknown>),
    error: null,
  };
}

export async function bulkPatchScoutCandidateReviewServer(input: {
  candidateIds: string[];
  reviewStatus: "approved" | "rejected";
}): Promise<{ updated: number; error: ScoutServerError | null }> {
  let updated = 0;
  for (const id of input.candidateIds) {
    const result = await patchScoutCandidateReviewServer({
      candidateId: id,
      reviewStatus: input.reviewStatus,
    });
    if (result.candidate) updated += 1;
  }
  return { updated, error: null };
}

export async function importScoutCandidateToSalesLeadServer(
  candidateId: string
): Promise<{
  candidate: ScoutLeadCandidateDto | null;
  leadId: string | null;
  error: ScoutServerError | null;
}> {
  if (!candidateId.trim()) return { candidate: null, leadId: null, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { candidate: null, leadId: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) {
    return { candidate: null, leadId: null, error: "supabase_service_unconfigured" };
  }

  const { data: existing } = await sb
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();

  if (!existing) return { candidate: null, leadId: null, error: "not_found" };
  const current = mapCandidate(existing as Record<string, unknown>);

  if (current.reviewStatus !== "approved") {
    return { candidate: null, leadId: null, error: "invalid_status" };
  }
  if (current.duplicateLeadId) {
    return { candidate: null, leadId: null, error: "duplicate_blocked" };
  }
  if (current.salesLeadId) {
    return { candidate: current, leadId: current.salesLeadId, error: null };
  }

  const clientName =
    current.organizationName.trim() ||
    current.buildingName.trim() ||
    "מועמד SCOUT";

  const draft: SalesLeadDraft = {
    clientName,
    buildingName: current.buildingName.trim(),
    address: current.address.trim(),
    city: current.city.trim(),
    contactName: current.contactName.trim(),
    phone: current.phone.trim(),
    email: current.email.trim(),
    needDescription: current.publicNotes.trim().slice(0, 2000),
    serviceType: "",
    serviceTypeOther: "",
    source: SCOUT_SALES_LEAD_SOURCE,
    sourceDetail: `task=${current.taskId}; candidate=${current.id}; ${current.sourceUrl}`,
    contactChannel: "",
    status: "חדש",
    estimatedValue: "",
    nextAction: "סקירת מועמד SCOUT",
    followUpDate: "",
    note: `יובא מ-SCOUT. ציון: ${current.matchScore}. ${current.scoreRationale}`,
  };

  const created = await createSalesLeadServer(draft);
  if (!created.lead) {
    return { candidate: null, leadId: null, error: "import_failed" };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updErr } = await sb
    .from(CANDIDATES_TABLE)
    .update({
      review_status: "imported",
      sales_lead_id: created.lead.id,
      updated_at: now,
    })
    .eq("id", candidateId)
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    return { candidate: null, leadId: created.lead.id, error: "save_failed" };
  }

  await recordAiActionServer({
    agentKey: "scout",
    actionType: "scout_lead_imported",
    summary: `SCOUT: יובא לליד — ${clientName}`,
    taskId: current.taskId,
    leadId: created.lead.id,
    details: { candidateId, sourceUrl: current.sourceUrl },
  });

  return {
    candidate: mapCandidate(updated as Record<string, unknown>),
    leadId: created.lead.id,
    error: null,
  };
}

export async function bulkImportScoutCandidatesServer(candidateIds: string[]): Promise<{
  imported: number;
  errors: ScoutServerError[];
}> {
  let imported = 0;
  const errors: ScoutServerError[] = [];
  for (const id of candidateIds) {
    const result = await importScoutCandidateToSalesLeadServer(id);
    if (result.leadId && !result.error) imported += 1;
    else if (result.error) errors.push(result.error);
  }
  return { imported, errors };
}
