import type { ContentChannelId, ContentDraftInput } from "@/lib/content/content-types";

const SIGNATURE = "יהודה פורטה";

function openingLine(input: ContentDraftInput): string {
  const contact = input.contactName.trim();
  if (contact) return `שלום ${contact}, שמי ${SIGNATURE}.`;
  return `שלום, שמי ${SIGNATURE}.`;
}

function serviceAudienceLine(input: ContentDraftInput): string {
  switch (input.candidateType) {
    case "management_company":
      return "אני מעניק שירותי ליווי מקצועי לחברות ניהול ולוועדי בתים מול חברות המעליות.";
    case "building_with_elevators":
      return "אני מעניק שירותי ליווי מקצועי לוועדי בתים, בניינים וחברות ניהול מול חברות המעליות.";
    default:
      return "אני מעניק שירותי ליווי מקצועי לוועדי בתים וחברות ניהול מול חברות המעליות.";
  }
}

function optionalContextLine(input: ContentDraftInput): string | null {
  const city = input.city.trim();
  const building = input.buildingName.trim();
  const org = input.organizationName.trim();
  const typeLabel = input.candidateTypeLabel.trim();

  if (org && city) {
    return `פניתי אליך בקשר ל${typeLabel || "ניהול המעליות"} — ${org}, ${city}.`;
  }
  if (building && city) {
    return `פניתי אליך בקשר ל${typeLabel || "ניהול המעליות"} — ${building}, ${city}.`;
  }
  if (org) {
    return `פניתי אליך בקשר ל${typeLabel || "ניהול המעליות"} — ${org}.`;
  }
  if (city) {
    return `פניתי אליך בקשר ל${typeLabel || "ניהול המעליות"} ב${city}.`;
  }
  return null;
}

const VALUE_PARAGRAPH =
  "אשמח לשוחח בקצרה ולהבין כיצד מתנהל אצלכם תחום המעליות והאם אוכל לסייע בבדיקת השירות, תקלות חוזרות, חוזי שירות והצעות מחיר.";

/**
 * Template-based CONTENT v1 — replaceable with LLM later (same input/output types).
 * Customer-facing text only: no brand FORTE, no QUALIFIER/score/source/rationale.
 */
export function buildContentDraftV1(
  channel: ContentChannelId,
  input: ContentDraftInput
): string {
  const context = optionalContextLine(input);

  if (channel === "whatsapp") {
    const lines = [openingLine(input), "", serviceAudienceLine(input), ""];
    if (context) {
      lines.push(context, "");
    }
    lines.push(VALUE_PARAGRAPH, "", SIGNATURE);
    return lines.join("\n").trim();
  }

  if (channel === "email") {
    const subjectParts = ["פנייה"];
    if (input.organizationName.trim()) subjectParts.push(`— ${input.organizationName.trim()}`);
    else if (input.city.trim()) subjectParts.push(`— ${input.city.trim()}`);
    const subject = `${subjectParts.join(" ")} | ${SIGNATURE}`;

    const body = [openingLine(input), "", serviceAudienceLine(input), ""];
    if (context) {
      body.push(context, "");
    }
    body.push(VALUE_PARAGRAPH, "", "בברכה,", SIGNATURE);
    return `נושא: ${subject}\n\n${body.join("\n")}`.trim();
  }

  const phoneLines = [
    "פתיחה מוצעת לשיחה:",
    "",
    `• ${openingLine(input)}`,
    `• ${serviceAudienceLine(input)}`,
  ];
  if (context) {
    phoneLines.push(`• ${context}`);
  }
  phoneLines.push(
    `• ${VALUE_PARAGRAPH}`,
    `• חתימה: ${SIGNATURE}`
  );
  return phoneLines.join("\n");
}
