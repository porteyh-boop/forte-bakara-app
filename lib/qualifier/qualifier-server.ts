import { recordAiActionServer } from "@/lib/forte-ai-marketing-server";
import { runQualifierRulesV1 } from "@/lib/qualifier/qualifier-engine";
import type { QualifierCandidateInput } from "@/lib/qualifier/qualifier-types";
import type { ScoutLeadCandidateDto } from "@/lib/scout/scout-types";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

const AGENTS_TABLE = "ai_agents";
const CANDIDATES_TABLE = "scout_lead_candidates";

export type QualifierServerError =
  | "supabase_service_unconfigured"
  | "invalid_input"
  | "qualifier_agent_missing"
  | "not_found"
  | "save_failed";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
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

function toQualifierInput(dto: ScoutLeadCandidateDto): QualifierCandidateInput {
  return {
    candidateType: dto.candidateType,
    organizationName: dto.organizationName,
    buildingName: dto.buildingName,
    city: dto.city,
    address: dto.address,
    contactName: dto.contactName,
    phone: dto.phone,
    email: dto.email,
    publicNotes: dto.publicNotes,
    sourceUrl: dto.sourceUrl,
    sourceTitle: dto.sourceTitle,
    sourceSnippet: dto.sourceSnippet,
    rawEvidence: dto.rawEvidence,
    matchScore: dto.matchScore,
    scoreRationale: dto.scoreRationale,
    duplicateLeadId: dto.duplicateLeadId,
    duplicateMatchReason: dto.duplicateMatchReason,
  };
}

async function ensureQualifierAgentId(
  sb: NonNullable<ReturnType<typeof getSupabaseServiceClient>>
): Promise<string | null> {
  const { data } = await sb
    .from(AGENTS_TABLE)
    .select("id")
    .eq("agent_key", "qualifier")
    .maybeSingle();
  return data ? asString((data as Record<string, unknown>).id) : null;
}

export async function runQualifierOnCandidateServer(candidateId: string): Promise<{
  candidate: ScoutLeadCandidateDto | null;
  error: QualifierServerError | null;
}> {
  const id = candidateId.trim();
  if (!id) return { candidate: null, error: "invalid_input" };

  if (!isSupabaseServiceConfigured()) {
    return { candidate: null, error: "supabase_service_unconfigured" };
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return { candidate: null, error: "supabase_service_unconfigured" };

  const agentId = await ensureQualifierAgentId(sb);
  if (!agentId) return { candidate: null, error: "qualifier_agent_missing" };

  const { data: existing, error: loadErr } = await sb
    .from(CANDIDATES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr || !existing) {
    return { candidate: null, error: "not_found" };
  }

  const before = mapCandidate(existing as Record<string, unknown>);
  const result = runQualifierRulesV1(toQualifierInput(before));
  const now = new Date().toISOString();

  const { data: updated, error: updErr } = await sb
    .from(CANDIDATES_TABLE)
    .update({
      qualify_verdict: result.verdict,
      qualify_reason: result.reason.slice(0, 2000),
      qualified_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    return { candidate: null, error: "save_failed" };
  }

  await recordAiActionServer({
    agentKey: "qualifier",
    actionType: "qualifier_completed",
    summary: `QUALIFIER: ${result.verdict} — ${before.organizationName || "מועמד"}`,
    taskId: before.taskId,
    details: {
      candidate_id: id,
      verdict: result.verdict,
      reason: result.reason.slice(0, 500),
      match_score: before.matchScore,
    },
  });

  return {
    candidate: mapCandidate(updated as Record<string, unknown>),
    error: null,
  };
}
