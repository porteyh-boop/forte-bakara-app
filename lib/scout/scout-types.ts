export const SCOUT_TASK_TYPE = "scout_search" as const;

export const SCOUT_CANDIDATE_TYPES = [
  "vaad_bayit",
  "building_with_elevators",
  "management_company",
  "relevant_asset",
] as const;

export type ScoutCandidateTypeId = (typeof SCOUT_CANDIDATE_TYPES)[number];

export const SCOUT_CANDIDATE_TYPE_LABELS: Record<ScoutCandidateTypeId, string> = {
  vaad_bayit: "ועד בית",
  building_with_elevators: "בניין עם מעליות",
  management_company: "חברת ניהול / נכסים",
  relevant_asset: "נכס רלוונטי",
};

export const SCOUT_REVIEW_STATUS_IDS = [
  "pending",
  "approved",
  "rejected",
  "imported",
] as const;

export type ScoutReviewStatusId = (typeof SCOUT_REVIEW_STATUS_IDS)[number];

import type { QualifyVerdictId } from "@/lib/qualifier/qualifier-types";

export { QUALIFY_VERDICT_LABELS } from "@/lib/qualifier/qualifier-types";

export const SCOUT_REVIEW_STATUS_LABELS: Record<ScoutReviewStatusId, string> = {
  pending: "ממתין לסקירה",
  approved: "אושר (טרם יובא)",
  rejected: "נדחה",
  imported: "יובא ללידים",
};

export const SCOUT_SALES_LEAD_SOURCE = "סוכן SCOUT";

export type ScoutSearchPayload = {
  city: string;
  region: string;
  targetType: ScoutCandidateTypeId;
  maxResults: number;
};

export type ScoutEvidenceItem = {
  field: string;
  value: string;
  sourceUrl: string;
};

export type ScoutLeadCandidateDto = {
  id: string;
  taskId: string;
  candidateType: ScoutCandidateTypeId;
  organizationName: string;
  buildingName: string;
  city: string;
  address: string;
  contactName: string;
  phone: string;
  email: string;
  publicNotes: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceSnippet: string;
  rawEvidence: ScoutEvidenceItem[];
  matchScore: number;
  scoreRationale: string;
  duplicateLeadId: string | null;
  duplicateMatchReason: string;
  reviewStatus: ScoutReviewStatusId;
  salesLeadId: string | null;
  qualifyVerdict: QualifyVerdictId | null;
  qualifyReason: string | null;
  qualifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ScoutTaskDto = {
  id: string;
  title: string;
  description: string;
  status: string;
  payload: ScoutSearchPayload;
  createdAt: string;
  updatedAt: string;
  candidateCount: number;
};

export type ScoutTaskDetailDto = ScoutTaskDto & {
  candidates: ScoutLeadCandidateDto[];
};
