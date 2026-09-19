import type { ScoutCandidateTypeId, ScoutEvidenceItem } from "@/lib/scout/scout-types";
import { SCOUT_CANDIDATE_TYPE_LABELS } from "@/lib/scout/scout-types";
import type { ScoutSearchHit } from "@/lib/scout/scout-research-provider";

const TYPE_KEYWORDS: Record<ScoutCandidateTypeId, string[]> = {
  vaad_bayit: ["ועד", "ועד בית", "דיירים", "בית משותף"],
  building_with_elevators: ["מעלית", "מעליות", "בניין", "מגדל", "דירות"],
  management_company: ["ניהול", "נכסים", "אחזקה", "facility", "property"],
  relevant_asset: ["נכס", "מרכז", "משרדים", "מסחר"],
};

function extractContactFromSnippet(snippet: string): {
  phone: string;
  email: string;
} {
  const phoneMatch = snippet.match(/0\d[\d\-]{7,12}/);
  const emailMatch = snippet.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return {
    phone: phoneMatch?.[0]?.replace(/\D/g, "").replace(/^0/, "0") ?? "",
    email: emailMatch?.[0]?.trim() ?? "",
  };
}

export type ScoutScoredCandidateDraft = {
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
};

export function buildCandidateFromSearchHit(input: {
  hit: ScoutSearchHit;
  payloadCity: string;
  targetType: ScoutCandidateTypeId;
  hasDuplicate: boolean;
}): ScoutScoredCandidateDraft {
  const { hit, payloadCity, targetType, hasDuplicate } = input;
  const combined = `${hit.title} ${hit.snippet}`.toLowerCase();
  const keywords = TYPE_KEYWORDS[targetType];
  const typeHits = keywords.filter((k) => combined.includes(k.toLowerCase())).length;

  let score = 35 + typeHits * 12;
  if (payloadCity && combined.includes(payloadCity.trim().toLowerCase())) {
    score += 15;
  }
  if (hit.snippet.length > 80) score += 8;
  if (hit.title.length > 5) score += 5;
  if (hasDuplicate) score = Math.max(0, score - 40);

  score = Math.min(100, Math.max(0, score));

  const contacts = extractContactFromSnippet(hit.snippet);
  const orgName = hit.title.trim().slice(0, 200);

  const evidence: ScoutEvidenceItem[] = [
    { field: "organizationName", value: orgName, sourceUrl: hit.url },
    { field: "publicNotes", value: hit.snippet.slice(0, 500), sourceUrl: hit.url },
  ];
  if (contacts.phone) {
    evidence.push({
      field: "phone",
      value: contacts.phone,
      sourceUrl: hit.url,
    });
  }
  if (contacts.email) {
    evidence.push({
      field: "email",
      value: contacts.email,
      sourceUrl: hit.url,
    });
  }

  const rationaleParts = [
    `סוג יעד: ${SCOUT_CANDIDATE_TYPE_LABELS[targetType]}.`,
    `התאמת מילות מפתח: ${typeHits}/${keywords.length}.`,
    payloadCity ? `חיפוש באזור: ${payloadCity}.` : "",
    hasDuplicate ? "זוהתה כפילות מול ליד קיים — לא ייובא אוטומטית." : "",
    `מקור: ${hit.url}`,
  ].filter(Boolean);

  return {
    organizationName: orgName,
    buildingName: "",
    city: payloadCity.trim(),
    address: "",
    contactName: "",
    phone: contacts.phone,
    email: contacts.email,
    publicNotes: hit.snippet.slice(0, 1500),
    sourceUrl: hit.url,
    sourceTitle: hit.title,
    sourceSnippet: hit.snippet.slice(0, 2000),
    rawEvidence: evidence,
    matchScore: score,
    scoreRationale: rationaleParts.join(" "),
  };
}
