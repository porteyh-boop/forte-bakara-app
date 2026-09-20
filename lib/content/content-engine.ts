import type { ContentChannelId, ContentDraftInput } from "@/lib/content/content-types";
import { QUALIFY_VERDICT_LABELS, type QualifyVerdictId } from "@/lib/qualifier/qualifier-types";

function greetingName(input: ContentDraftInput): string {
  const contact = input.contactName.trim();
  if (contact) return contact;
  const org = input.organizationName.trim() || input.buildingName.trim();
  return org || "שלום";
}

function forteServiceHint(input: ContentDraftInput): string {
  switch (input.candidateType) {
    case "vaad_bayit":
      return "ייצוג האינטרסים של ועד הבית מול חברת המעליות — ליווי מקצועי, שקיפות ותיאום מול הספק.";
    case "building_with_elevators":
      return "ליווי מקצועי לתחזוקת המעליות בבניין וייצוג הדיירים מול חברת המעליות.";
    case "management_company":
      return "ייעוץ וליווי לניהול נכסים בנושאי מעליות ושירות ללקוחותיכם.";
    case "relevant_asset":
      return "ייעוץ מקצועי בנושאי מעליות ואחזקה לנכס.";
    default:
      return "ייעוץ וליווי מקצועי בנושאי מעליות.";
  }
}

function qualifierLine(input: ContentDraftInput): string {
  if (!input.qualifyVerdict) return "";
  const label =
    input.qualifyVerdict in QUALIFY_VERDICT_LABELS
      ? QUALIFY_VERDICT_LABELS[input.qualifyVerdict as QualifyVerdictId]
      : input.qualifyVerdict;
  const reason = (input.qualifyReason ?? "").trim();
  return reason
    ? `הערכת QUALIFIER: ${label} — ${reason}`
    : `הערכת QUALIFIER: ${label}.`;
}

function locationPhrase(input: ContentDraftInput): string {
  const city = input.city.trim();
  const building = input.buildingName.trim();
  const org = input.organizationName.trim();
  if (building && city) return `${building} ב${city}`;
  if (org && city) return `${org} (${city})`;
  if (city) return city;
  return org || building;
}

/**
 * Template-based CONTENT v1 — replaceable with LLM later (same input/output types).
 */
export function buildContentDraftV1(
  channel: ContentChannelId,
  input: ContentDraftInput
): string {
  const name = greetingName(input);
  const place = locationPhrase(input);
  const service = forteServiceHint(input);
  const qual = qualifierLine(input);
  const typeLabel = input.candidateTypeLabel.trim();

  if (channel === "whatsapp") {
    const lines = [
      `שלום ${name},`,
      "",
      place
        ? `פניתי אליך בקשר ל${typeLabel} — ${place}.`
        : `פניתי אליך בקשר ל${typeLabel}.`,
      "",
      `אני פונה מטעם FORTE. אני מלווה ${typeLabel === "ועד בית" ? "ועדי בתים" : "לקוחות"} בייצוג מול חברות המעליות — ${service}`,
      "",
      "אשמח לשוחח בקצרה ולהבין אם רלевантי עבורכם.",
    ];
    if (qual) lines.push("", qual);
    return lines.join("\n").trim();
  }

  if (channel === "email") {
    const subject = place
      ? `פנייה מ-FORTE — ${typeLabel}, ${place}`
      : `פנייה מ-FORTE — ${typeLabel}`;
    const body = [
      `שלום ${name},`,
      "",
      place
        ? `אני פונה אליך בנוגע ל${typeLabel} ${place}.`
        : `אני פונה אליך בנוגע ל${typeLabel}.`,
      "",
      `אני מייצגת את FORTE. ${service}`,
      "",
      "אשמח לתאם שיחה קצרה לפי נוחותך.",
      "",
      "בברכה,",
      "FORTE",
    ];
    if (qual) body.splice(body.length - 2, 0, "", qual);
    return `נושא: ${subject}\n\n${body.join("\n")}`.trim();
  }

  // phone opener
  const phoneLines = [
    "פתיחה מוצעת לשיחה:",
    "",
    `• שלום ${name}, מדבר/ת מטעם FORTE.`,
    place
      ? `• הפנייה בנוגע ל${typeLabel} — ${place}.`
      : `• הפנייה בנוגע ל${typeLabel}.`,
    `• ${service}`,
    "• שאלה: האם נושא המעליות / הספק הנוכחי רלוונטי לשיחה אצלכם?",
    "• הצעה: שיחה קצרה (10–15 דקות) ללא התחייבות.",
  ];
  if (qual) phoneLines.push(`• ${qual}`);
  return phoneLines.join("\n");
}
