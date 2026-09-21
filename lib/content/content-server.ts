import { buildContentDraftV1 } from "@/lib/content/content-engine";
import type { ContentChannelId, ContentDraftDto, ContentDraftInput } from "@/lib/content/content-types";
import { CONTENT_CHANNELS } from "@/lib/content/content-types";
import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import type { ScoutLeadCandidateDto } from "@/lib/scout/scout-types";
import { SCOUT_CANDIDATE_TYPE_LABELS } from "@/lib/scout/scout-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const AGENTS_TABLE = "ai_agents";
const CANDIDATES_TABLE = "scout_lead_candidates";
const DRAFTS_TABLE = "scout_outreach_drafts";

export type ContentServerError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "content_agent_missing"
  | "not_found"
  | "not_approved"
  | "save_failed"
  | "delete_failed";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function isChannel(value: string): value is ContentChannelId {
  return (CONTENT_CHANNELS as readonly string[]).includes(value);
}

function mapCandidate(row: Record<string, unknown>): ScoutLeadCandidateDto {
  const evidence = row.raw_evidence;
  const verdictRaw = asString(row.qualify_verdict).trim();
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
    reviewStatus: asString(row.review_status) as ScoutLeadCandidateDto["reviewStatus"],
    salesLeadId: asString(row.sales_lead_id) || null,
    qualifyVerdict:
      verdictRaw === "suitable" || verdictRaw === "review" || verdictRaw === "unsuitable"
        ? verdictRaw
        : null,
    qualifyReason: asString(row.qualify_reason) || null,
    qualifiedAt: asString(row.qualified_at) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapDraft(row: Record<string, unknown>): ContentDraftDto {
  const ch = asString(row.channel);
  return {
    id: asString(row.id),
    scoutLeadCandidateId: asString(row.scout_lead_candidate_id),
    salesLeadId: asString(row.sales_lead_id) || null,
    channel: isChannel(ch) ? ch : "whatsapp",
    draftText: asString(row.draft_text),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function toDraftInput(c: ScoutLeadCandidateDto): ContentDraftInput {
  return {
    contactName: c.contactName,
    organizationName: c.organizationName,
    buildingName: c.buildingName,
    city: c.city,
    candidateType: c.candidateType,
    candidateTypeLabel: SCOUT_CANDIDATE_TYPE_LABELS[c.candidateType] ?? c.candidateType,
    sourceUrl: c.sourceUrl,
    qualifyVerdict: c.qualifyVerdict,
    qualifyReason: c.qualifyReason,
    publicNotes: c.publicNotes.slice(0, 500),
  };
}

function candidateEligibleForContent(c: ScoutLeadCandidateDto): boolean {
  return c.reviewStatus === "approved" || c.reviewStatus === "imported";
}

async function ensureContentAgentId(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>
): Promise<string | null> {
  const { data } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", "content")
    .maybeSingle();
  return data ? asString((data as Record<string, unknown>).id) : null;
}

export async function createContentOutreachDraftServer(body: unknown): Promise<{
  draft: ContentDraftDto | null;
  error: ContentServerError | null;
}> {
  if (!body || typeof body !== "object") {
    return { draft: null, error: "invalid_input" };
  }
  const raw = body as Record<string, unknown>;
  const candidateId = asString(raw.candidateId).trim();
  const salesLeadIdInput = asString(raw.salesLeadId).trim();
  const channelRaw = asString(raw.channel).trim().toLowerCase();

  if (!candidateId || !isChannel(channelRaw)) {
    return { draft: null, error: "invalid_input" };
  }

  if (!isSupabaseServiceConfigured()) {
    return { draft: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { draft: null, error: "supabase_service_unconfigured" };

  if (!(await ensureContentAgentId(sb))) {
    return { draft: null, error: "content_agent_missing" };
  }

  const { data: row } = await sb
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();

  if (!row) return { draft: null, error: "not_found" };

  const candidate = mapCandidate(row as Record<string, unknown>);
  if (!candidateEligibleForContent(candidate)) {
    return { draft: null, error: "not_approved" };
  }

  if (salesLeadIdInput && candidate.salesLeadId && salesLeadIdInput !== candidate.salesLeadId) {
    return { draft: null, error: "invalid_input" };
  }

  const draftText = buildContentDraftV1(channelRaw, toDraftInput(candidate));
  const now = new Date().toISOString();
  const salesLeadId = candidate.salesLeadId || salesLeadIdInput || null;

  const { data: inserted, error: insertErr } = await sb
    .from(DRAFTS_TABLE)
    .insert({
      scout_lead_candidate_id: candidateId,
      sales_lead_id: salesLeadId,
      channel: channelRaw,
      draft_text: draftText,
      updated_at: now,
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return { draft: null, error: "save_failed" };
  }

  await recordAiActionServer({
    agentKey: "content",
    actionType: "content_draft_created",
    summary: `CONTENT: טיוטת ${channelRaw} — ${candidate.organizationName || candidate.city}`,
    taskId: candidate.taskId,
    leadId: salesLeadId,
    details: {
      candidate_id: candidateId,
      channel: channelRaw,
      draft_id: asString((inserted as Record<string, unknown>).id),
    },
  });

  return { draft: mapDraft(inserted as Record<string, unknown>), error: null };
}

export async function deleteContentOutreachDraftServer(draftId: string): Promise<{
  deleted: boolean;
  error: ContentServerError | null;
}> {
  const id = draftId.trim();
  if (!id) return { deleted: false, error: "invalid_input" };
  if (!isSupabaseServiceConfigured()) {
    return { deleted: false, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { deleted: false, error: "supabase_service_unconfigured" };

  if (!(await ensureContentAgentId(sb))) {
    return { deleted: false, error: "content_agent_missing" };
  }

  const { data: row } = await sb
    .from(DRAFTS_TABLE)
    .select("id, scout_lead_candidate_id, channel")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { deleted: false, error: "not_found" };

  const rec = row as Record<string, unknown>;
  const candidateId = asString(rec.scout_lead_candidate_id);

  const { error: delErr } = await sb.from(DRAFTS_TABLE).delete().eq("id", id);
  if (delErr) return { deleted: false, error: "delete_failed" };

  await recordAiActionServer({
    agentKey: "content",
    actionType: "content_draft_deleted",
    summary: "טיוטת פנייה נמחקה",
    details: {
      draft_id: id,
      candidate_id: candidateId,
      channel: asString(rec.channel),
    },
  });

  return { deleted: true, error: null };
}
