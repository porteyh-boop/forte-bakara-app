export const QUALIFY_VERDICT_IDS = ["suitable", "review", "unsuitable"] as const;

export type QualifyVerdictId = (typeof QUALIFY_VERDICT_IDS)[number];

export const QUALIFY_VERDICT_LABELS: Record<QualifyVerdictId, string> = {
  suitable: "מתאים",
  review: "לבדיקה",
  unsuitable: "לא מתאים",
};

export type QualifierCandidateInput = {
  candidateType: string;
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
  rawEvidence: { field: string; value: string; sourceUrl: string }[];
  matchScore: number;
  scoreRationale: string;
  duplicateLeadId: string | null;
  duplicateMatchReason: string;
};

export type QualifierResult = {
  verdict: QualifyVerdictId;
  reason: string;
};
