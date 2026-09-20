import type {
  QualifierCandidateInput,
  QualifierResult,
  QualifyVerdictId,
} from "@/lib/qualifier/qualifier-types";

const TYPE_SIGNALS: Record<string, string[]> = {
  vaad_bayit: ["ועד", "ועד בית", "ועד-בית", "בית משותף", "דיירים"],
  building_with_elevators: ["מעלית", "מעליות", "בניין", "מגדל"],
  management_company: ["ניהול", "אחזקה", "נכסים", "facility", "property"],
  relevant_asset: ["נכס", "מרכז", "משרדים", "מסחר"],
};

const GENERIC_CONTENT_MARKERS = [
  "מושג",
  "חוק המקרקעין",
  "כל זכות",
  "מדריך",
  "החוק, החובה",
  "wikipedia",
];

const FORTE_SERVICE_MARKERS = [
  "מעלית",
  "מעליות",
  "ועד",
  "ניהול",
  "בית משותף",
  "בניין",
  "אחזקה",
  "נכסים",
];

function combinedText(c: QualifierCandidateInput): string {
  return [
    c.organizationName,
    c.buildingName,
    c.publicNotes,
    c.sourceTitle,
    c.sourceSnippet,
    c.scoreRationale,
  ]
    .join(" ")
    .toLowerCase();
}

function hasValidPublicSource(c: QualifierCandidateInput): boolean {
  const url = c.sourceUrl.trim();
  return url.startsWith("http://") || url.startsWith("https://");
}

function typeSignalHits(c: QualifierCandidateInput): number {
  const text = combinedText(c);
  const keywords = TYPE_SIGNALS[c.candidateType] ?? TYPE_SIGNALS.vaad_bayit;
  return keywords.filter((k) => text.includes(k.toLowerCase())).length;
}

function cityMatchesSearch(c: QualifierCandidateInput): boolean {
  const city = c.city.trim();
  if (!city) return true;
  return combinedText(c).includes(city.toLowerCase());
}

function evidenceCount(c: QualifierCandidateInput): number {
  return Array.isArray(c.rawEvidence) ? c.rawEvidence.length : 0;
}

function isGenericNonLeadContent(c: QualifierCandidateInput): boolean {
  const text = combinedText(c);
  const hasGeneric = GENERIC_CONTENT_MARKERS.some((m) =>
    text.includes(m.toLowerCase())
  );
  if (!hasGeneric) return false;
  const hasLeadSignal = FORTE_SERVICE_MARKERS.some((m) =>
    text.includes(m.toLowerCase())
  );
  return hasGeneric && !hasLeadSignal;
}

function hasActionableContact(c: QualifierCandidateInput): boolean {
  return Boolean(c.phone.trim() || c.email.trim() || c.contactName.trim());
}

/**
 * Rule-based QUALIFIER v1 — deterministic, no external AI.
 */
export function runQualifierRulesV1(
  candidate: QualifierCandidateInput
): QualifierResult {
  if (candidate.duplicateLeadId) {
    const detail = candidate.duplicateMatchReason.trim();
    return {
      verdict: "unsuitable",
      reason: detail
        ? `כפילות ברורה מול ליד קיים: ${detail}`
        : "כפילות ברורה מול ליד קיים — לא מומלץ כמועמד חדש.",
    };
  }

  if (!hasValidPublicSource(candidate)) {
    return {
      verdict: "unsuitable",
      reason: "מקור ציבורי לא תקין או חסר — לא ניתן לאמת את המועמד.",
    };
  }

  if (isGenericNonLeadContent(candidate)) {
    return {
      verdict: "unsuitable",
      reason:
        "תוצאה כללית או מאמר/הסבר — לא נראה כליד ממשי לשירותי FORTE.",
    };
  }

  const typeHits = typeSignalHits(candidate);
  const cityOk = cityMatchesSearch(candidate);
  const evidenceN = evidenceCount(candidate);
  const score = candidate.matchScore;

  if (!cityOk && candidate.city.trim()) {
    return {
      verdict: "unsuitable",
      reason: `העיר/אזור החיפוש (${candidate.city.trim()}) לא משתקפים במקור — כנראה לא רלוונטי.`,
    };
  }

  if (score < 38 && typeHits === 0) {
    return {
      verdict: "unsuitable",
      reason:
        "ציון SCOUT נמוך ואין התאמה לסוג היעד — לא קשור לשירותי FORTE.",
    };
  }

  const strongSuitable =
    score >= 52 &&
    typeHits >= 1 &&
    cityOk &&
    evidenceN >= 2 &&
    hasValidPublicSource(candidate) &&
    !isGenericNonLeadContent(candidate);

  if (strongSuitable) {
    return {
      verdict: "suitable",
      reason: buildSuitableReason(candidate, typeHits, evidenceN),
    };
  }

  const clearlyWeak =
    evidenceN < 2 ||
    typeHits === 0 ||
    score < 45 ||
    (!hasActionableContact(candidate) &&
      candidate.publicNotes.trim().length < 60);

  if (clearlyWeak) {
    return {
      verdict: "review",
      reason: buildReviewReason(candidate, typeHits, evidenceN),
    };
  }

  if (score >= 45 && typeHits >= 1) {
    return {
      verdict: "review",
      reason:
        "נראה רלוונטי חלקית — חסרים פרטים או ראיות חלשות לקבלת החלטה סופית.",
    };
  }

  return {
    verdict: "unsuitable",
    reason:
      "לא נמצאה התאמה מספקת ליעד החיפוש או לשירותי FORTE על בסיס המקור.",
  };
}

function buildSuitableReason(
  c: QualifierCandidateInput,
  typeHits: number,
  evidenceN: number
): string {
  const parts = [
    "מקור ציבורי תקין,",
    `התאמה לסוג היעד (${typeHits} סימנים),`,
    c.city.trim() ? `אזור ${c.city.trim()} מופיע במקור,` : "",
    `${evidenceN} ראיות בשדות,`,
    `ציון SCOUT ${c.matchScore}.`,
  ].filter(Boolean);
  return parts.join(" ").replace(/,\s*$/, ".");
}

function buildReviewReason(
  c: QualifierCandidateInput,
  typeHits: number,
  evidenceN: number
): string {
  const gaps: string[] = [];
  if (evidenceN < 2) gaps.push("מעט ראיות ממקור");
  if (typeHits === 0) gaps.push("לא ברור אם ועד/חברת ניהול/בניין");
  if (!hasActionableContact(c)) gaps.push("חסרים פרטי קשר");
  if (c.matchScore < 50) gaps.push(`ציון SCOUT בינוני (${c.matchScore})`);
  if (gaps.length === 0) {
    gaps.push("מידע חלקי — נדרשת בדיקה ידנית");
  }
  return gaps.join("; ") + ".";
}

export function isQualifyVerdictId(value: string): value is QualifyVerdictId {
  return value === "suitable" || value === "review" || value === "unsuitable";
}
