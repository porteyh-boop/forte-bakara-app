import { BRAND_EDITOR_NAME } from "./brand";
import {
  createDocument,
  deleteDocument,
  filterDocuments,
  getAllDocuments,
  getDocumentById,
  uploadDocumentCenterFile,
  type DocumentRecord,
} from "./document-center";
import { deleteInspectorLetterPreparedEvidence } from "./document-inspector-notifications";
import { createMasterLetterDocFile } from "./master-letter-export";
import {
  buildMasterLetterAiMetadata,
  parseMasterLetterMetadata,
  type MasterLetterDossierSection,
  type MasterLetterInspectorFollowUpMetadata,
  type MasterLetterRecipientSnapshot,
  type MasterLetterStoredMetadata,
} from "./master-letter-metadata";
import {
  getProjectV2SectionTag,
} from "./project-v2-document-sections";
import {
  getMasterLetterTemplate,
  MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
  MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
  MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
  MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
  MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
  MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
  MASTER_LETTER_TEMPLATES,
  type MasterLetterTemplateId,
} from "./master-letter-templates";

export {
  MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
  MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
  MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
  MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
  MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
  MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
  MASTER_LETTER_TEMPLATES,
  getMasterLetterTemplate,
  getDefaultMasterLetterTemplateId,
} from "./master-letter-templates";
export type { MasterLetterTemplateId } from "./master-letter-templates";

export const MASTER_LETTER_TAG = "מכתב" as const;

export type MasterLetterFieldValue = string | number | boolean;

export interface MasterLetterBuildingContext {
  buildingId: string;
  buildingName: string;
  address?: string | null;
  city?: string | null;
  managementCompany?: string | null;
}

export type { MasterLetterDossierSection } from "./master-letter-metadata";
export {
  getMasterLetterListDisplay,
  parseMasterLetterMetadata,
} from "./master-letter-metadata";

export interface MasterLetterDraftInput {
  templateId: MasterLetterTemplateId;
  subject: string;
  building: MasterLetterBuildingContext;
  elevatorId?: string | null;
  elevatorName?: string | null;
  customNote?: string;
  letterDate?: string;
  templateFields?: Record<string, MasterLetterFieldValue>;
  recipients?: MasterLetterRecipientSnapshot[];
  cc?: MasterLetterRecipientSnapshot[];
  section?: MasterLetterDossierSection;
  inspectorFollowUp?: MasterLetterInspectorFollowUpMetadata | null;
}

export interface SaveMasterLetterInput extends MasterLetterDraftInput {
  title: string;
}

export interface SaveMasterLetterResult {
  document: DocumentRecord | null;
  error: string | null;
}

function formatLetterDate(isoDate?: string): string {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatInputDate(value: MasterLetterFieldValue | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.includes("-")) {
    const [year, month, day] = raw.split("-");
    if (year && month && day) return `${day}.${month}.${year}`;
  }
  return raw;
}

function fieldString(
  fields: Record<string, MasterLetterFieldValue> | undefined,
  key: string
): string {
  return String(fields?.[key] ?? "").trim();
}

function fieldNumber(
  fields: Record<string, MasterLetterFieldValue> | undefined,
  key: string
): number {
  const value = Number(fields?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function fieldBoolean(
  fields: Record<string, MasterLetterFieldValue> | undefined,
  key: string
): boolean {
  const value = fields?.[key];
  return value === true || value === "true";
}

function resolveElevatorCompanyName(
  fields: Record<string, MasterLetterFieldValue> | undefined
): string {
  const company = fieldString(fields, "elevator_company");
  if (company === "אחר") {
    return fieldString(fields, "elevator_company_other");
  }
  return company;
}

function buildingAddressLine(building: MasterLetterBuildingContext): string {
  const fromProfile = [building.address, building.city].filter(Boolean).join(", ");
  if (fromProfile) return fromProfile;
  return building.buildingName;
}

function defaultRecipient(building: MasterLetterBuildingContext): string {
  return building.managementCompany?.trim()
    ? `לכבוד ${building.managementCompany.trim()}`
    : "לכבוד ועד הבית / חברת הניהול";
}

function resolvePrimaryAddressee(
  input: MasterLetterDraftInput,
  fallback: string
): string {
  const first = input.recipients?.[0];
  return first?.addresseeLine?.trim() || fallback;
}

function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.filter(Boolean).join("\n\n").trim();
}

function buildBuildingFollowUpBody(input: MasterLetterDraftInput): string {
  const dateLabel = formatLetterDate(input.letterDate);
  const addressLine = buildingAddressLine(input.building);
  const recipient = resolvePrimaryAddressee(input, defaultRecipient(input.building));
  const elevatorLine = input.elevatorName?.trim()
    ? `המכתב מתייחס למעלית: ${input.elevatorName.trim()}.`
    : "";
  const customNote = input.customNote?.trim() ? input.customNote.trim() : "";

  return joinParagraphs([
    recipient,
    `${input.building.buildingName}${addressLine ? ` · ${addressLine}` : ""}`,
    "שלום רב,",
    `בהמשך לבקרת שירות המעליות בבניין ${input.building.buildingName}, מועבר מכתב מעקב מיום ${dateLabel}.`,
    "המכתב נועד לתיעוד מצב השירות, לתיאום המשך טיפול ולשמירה על רצף הבקרה המקצועית.",
    elevatorLine,
    customNote,
    "נשמח לקבל עדכון על ביצוע הפעולות הנדרשות.",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ]);
}

function buildInspectorFindingsBody(input: MasterLetterDraftInput): string {
  const fields = input.templateFields;
  const buildingAddress = buildingAddressLine(input.building);
  const defectCount = fieldNumber(fields, "defect_count");
  const companyName = resolveElevatorCompanyName(fields);
  const inspectionDate = formatInputDate(fields?.inspection_date);
  const has45DayItems = fieldBoolean(fields, "has_45_day_items");
  const reportAttached = fieldBoolean(fields, "report_attached");
  const recipientType = fieldString(fields, "recipient_type");

  let defectSentence: string;
  if (defectCount === 0) {
    defectSentence = "בדוח הבדיקה לא נמצאו ליקויים.";
  } else if (defectCount === 1) {
    defectSentence =
      "בדוח הבדיקה נמצא ליקוי אחד המחייב טיפול על ידי חברת המעליות.";
  } else {
    defectSentence = `בדוח הבדיקה נמצאו ${defectCount} ליקויים המחייבים טיפול על ידי חברת המעליות.`;
  }

  const ccLines: string[] = [];
  if (recipientType === "ועד בית") ccLines.push("ועד הבית");
  else if (recipientType === "חברת ניהול") ccLines.push("חברת הניהול");
  else if (recipientType === "שניהם") {
    ccLines.push("ועד הבית");
    ccLines.push("חברת הניהול");
  }

  const paragraphs = [
    resolvePrimaryAddressee(
      input,
      companyName ? `לכבוד חברת ${companyName}` : "לכבוד חברת המעליות"
    ),
    `${input.building.buildingName} · ${buildingAddress}`,
    ccLines.length > 0 ? `העתק: ${ccLines.join(" · ")}` : "",
    "שלום רב,",
    `בהמשך לקבלת דוח הבדיקה התקופתית של הבודק המוסמך, אשר נערך ביום ${inspectionDate}, הועבר לבדיקתנו, ולאחר בחינת ממצאיו, להלן התייחסותנו.`,
    defectSentence,
    reportAttached
      ? "דוח הבדיקה המלא מצורף למכתב זה."
      : "דוח הבדיקה המלא יועבר בנפרד.",
    defectCount > 0
      ? "נבקש לפעול לתיקון כלל הליקויים המפורטים בדוח הבדיקה, בהתאם ללוחות הזמנים שנקבעו על ידי הבודק המוסמך, ולהודיע לנו עם השלמת הטיפול, לצורך המשך המעקב."
      : "",
    has45DayItems
      ? "אי ביצוע ההערות במועד עלול להביא לנקיטת צעדי אכיפה מצד הגורמים המוסמכים, לרבות דרישה להשבתת המעלית או הוצאת צו הפסקת שימוש עד להשלמת תיקון הליקויים ואישור תקינות המעלית."
      : "",
    input.customNote?.trim() ?? "",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ];

  return joinParagraphs(paragraphs);
}

function buildElevatorCompanyResponseBody(input: MasterLetterDraftInput): string {
  const fields = input.templateFields;
  const companyName = resolveElevatorCompanyName(fields);
  const issueTopic = fieldString(fields, "issue_topic");
  const responseDeadline = formatInputDate(fields?.response_deadline);
  const issueDetails = fieldString(fields, "issue_details");
  const addressLine = buildingAddressLine(input.building);

  return joinParagraphs([
    resolvePrimaryAddressee(
      input,
      companyName ? `לכבוד חברת ${companyName}` : "לכבוד חברת המעליות"
    ),
    `${input.building.buildingName} · ${addressLine}`,
    "שלום רב,",
    `בהמשך לבקרת שירות המעליות בבניין ${input.building.buildingName}, אנו פונים אליכם בנושא: ${issueTopic}.`,
    issueDetails,
    `נבקש להעביר התייחסותכם המלאה עד ליום ${responseDeadline}, לרבות פירוט הפעולות המתוכננות לטיפול בנושא.`,
    input.elevatorName?.trim()
      ? `הפנייה מתייחסת למעלית: ${input.elevatorName.trim()}.`
      : "",
    input.customNote?.trim() ?? "",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ]);
}

function buildVisitSummaryBody(input: MasterLetterDraftInput): string {
  const fields = input.templateFields;
  const visitDate = formatInputDate(fields?.visit_date);
  const findings = fieldString(fields, "findings");
  const conclusions = fieldString(fields, "conclusions");
  const recommendations = fieldString(fields, "recommendations");
  const addressLine = buildingAddressLine(input.building);

  return joinParagraphs([
    resolvePrimaryAddressee(input, defaultRecipient(input.building)),
    `${input.building.buildingName} · ${addressLine}`,
    "שלום רב,",
    `להלן סיכום הביקור המקצועי שבוצע בבניין ${input.building.buildingName} ביום ${visitDate}.`,
    input.elevatorName?.trim()
      ? `הביקור התמקד במעלית: ${input.elevatorName.trim()}.`
      : "",
    `ממצאים:\n${findings}`,
    `מסקנות:\n${conclusions}`,
    `המלצות:\n${recommendations}`,
    input.customNote?.trim() ?? "",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ]);
}

function buildPriceProposalReviewBody(input: MasterLetterDraftInput): string {
  const fields = input.templateFields;
  const vendorName = fieldString(fields, "vendor_name");
  const proposalDate = formatInputDate(fields?.proposal_date);
  const proposalAmount = fieldString(fields, "proposal_amount");
  const assessment = fieldString(fields, "assessment");
  const recommendation = fieldString(fields, "recommendation");
  const addressLine = buildingAddressLine(input.building);

  return joinParagraphs([
    resolvePrimaryAddressee(input, defaultRecipient(input.building)),
    `${input.building.buildingName} · ${addressLine}`,
    "שלום רב,",
    `להלן התייחסותנו להצעת המחיר שהתקבלה מ${vendorName} ביום ${proposalDate}, בסך ${proposalAmount} ₪.`,
    `חוות דעת:\n${assessment}`,
    `המלצה: ${recommendation}.`,
    input.customNote?.trim() ?? "",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ]);
}

function buildRecurringFaultsBody(input: MasterLetterDraftInput): string {
  const fields = input.templateFields;
  const companyName = resolveElevatorCompanyName(fields);
  const faultDescription = fieldString(fields, "fault_description");
  const recurrenceCount = fieldNumber(fields, "recurrence_count");
  const actionRequested = fieldString(fields, "action_requested");
  const addressLine = buildingAddressLine(input.building);

  return joinParagraphs([
    resolvePrimaryAddressee(
      input,
      companyName ? `לכבוד חברת ${companyName}` : "לכבוד חברת המעליות"
    ),
    `${input.building.buildingName} · ${addressLine}`,
    "שלום רב,",
    `בהמשך לבקרת שירות המעליות בבניין ${input.building.buildingName}, אנו מעלים את תשומת לבכם לתקלה חוזרת שדווחה ${recurrenceCount} פעמים.`,
    input.elevatorName?.trim()
      ? `התקלה מתייחסת למעלית: ${input.elevatorName.trim()}.`
      : "",
    `תיאור התקלה:\n${faultDescription}`,
    `פעולה מבוקשת:\n${actionRequested}`,
    input.customNote?.trim() ?? "",
    `בברכה,\n${BRAND_EDITOR_NAME}`,
  ]);
}

export function buildMasterLetterBody(input: MasterLetterDraftInput): string {
  switch (input.templateId) {
    case MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS:
      return buildInspectorFindingsBody(input);
    case MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE:
      return buildElevatorCompanyResponseBody(input);
    case MASTER_LETTER_TEMPLATE_VISIT_SUMMARY:
      return buildVisitSummaryBody(input);
    case MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW:
      return buildPriceProposalReviewBody(input);
    case MASTER_LETTER_TEMPLATE_RECURRING_FAULTS:
      return buildRecurringFaultsBody(input);
    case MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP:
    default:
      return buildBuildingFollowUpBody(input);
  }
}

function buildDefaultSubject(input: MasterLetterDraftInput): string {
  const template = getMasterLetterTemplate(input.templateId);
  const addressLine = buildingAddressLine(input.building);

  switch (input.templateId) {
    case MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS:
      return `${template?.defaultSubject ?? "סקירת דוח בודק"} — ${addressLine}`;
    case MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE: {
      const topic = fieldString(input.templateFields, "issue_topic");
      return topic
        ? `${template?.defaultSubject ?? "דרישה להתייחסות"} — ${topic}`
        : template?.defaultSubject ?? "דרישה להתייחסות";
    }
    case MASTER_LETTER_TEMPLATE_VISIT_SUMMARY:
      return `${template?.defaultSubject ?? "סיכום ביקור"} — ${input.building.buildingName}`;
    case MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW:
      return `${template?.defaultSubject ?? "התייחסות להצעת מחיר"} — ${input.building.buildingName}`;
    case MASTER_LETTER_TEMPLATE_RECURRING_FAULTS:
      return `${template?.defaultSubject ?? "תקלות חוזרות"} — ${input.building.buildingName}`;
    case MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP:
    default:
      return template?.defaultSubject ?? "מכתב";
  }
}

export function buildMasterLetterPreview(input: MasterLetterDraftInput): {
  subject: string;
  bodyText: string;
} {
  const subject = input.subject.trim() || buildDefaultSubject(input);
  return {
    subject,
    bodyText: buildMasterLetterBody(input),
  };
}

export async function listMasterLetters(): Promise<{
  letters: DocumentRecord[];
  error: string | null;
}> {
  const { documents, error } = await getAllDocuments();
  if (error) {
    return { letters: [], error };
  }

  const letters = filterDocuments(documents, { tags: [MASTER_LETTER_TAG] }).sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return { letters, error: null };
}

export async function saveMasterLetterToDocumentCenter(
  input: SaveMasterLetterInput
): Promise<SaveMasterLetterResult> {
  if (typeof window === "undefined") {
    return { document: null, error: "שמירת מכתב זמינה מהדפדפן בלבד." };
  }

  const buildingId = input.building.buildingId.trim();
  if (!buildingId) {
    return { document: null, error: "יש לבחור בניין קיים." };
  }

  const title = input.title.trim();
  if (!title) {
    return { document: null, error: "יש להזין כותרת למכתב." };
  }

  const preview = buildMasterLetterPreview(input);
  const template = getMasterLetterTemplate(input.templateId);
  const section = input.section ?? "general";
  const recipients = input.recipients ?? [];
  const cc = input.cc ?? [];
  const file = await createMasterLetterDocFile({
    subject: preview.subject,
    bodyText: preview.bodyText,
    buildingId,
    title,
    letterDate: input.letterDate,
    recipients,
    cc,
  });

  const upload = await uploadDocumentCenterFile(file, buildingId);
  if (!upload.ok) {
    return { document: null, error: upload.error };
  }

  const tags: string[] = [MASTER_LETTER_TAG];
  if (section === "inspections") {
    tags.push(getProjectV2SectionTag("inspections"));
  } else if (section === "faults") {
    tags.push(getProjectV2SectionTag("faults"));
  }

  const letterMetadata: MasterLetterStoredMetadata = {
    schemaVersion: 1,
    templateId: input.templateId,
    subject: preview.subject,
    section,
    recipients,
    cc,
    templateFields: input.templateFields,
    customNote: input.customNote?.trim() || null,
    letterDate: input.letterDate ?? null,
    elevatorId: input.elevatorId?.trim() || null,
    elevatorName: input.elevatorName?.trim() || null,
    bodyText: preview.bodyText,
    generatedAt: new Date().toISOString(),
    inspectorFollowUp: input.inspectorFollowUp ?? null,
  };

  const create = await createDocument({
    buildingId,
    elevatorId: input.elevatorId?.trim() || null,
    documentType: "correspondence",
    title,
    description: [template?.label, preview.subject].filter(Boolean).join(" · "),
    fileName: file.name,
    fileUrl: upload.fileUrl,
    storagePath: upload.storagePath,
    mimeType: upload.contentType,
    fileSizeBytes: file.size,
    tags,
    visibility: "internal",
    aiMetadata: buildMasterLetterAiMetadata(letterMetadata),
  });

  if (!create.document) {
    return {
      document: null,
      error: create.error ?? "שמירת המכתב במאגר המסמכים נכשלה.",
    };
  }

  return { document: create.document, error: null };
}

export async function deleteSavedMasterLetter(documentId: string): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const document = await getDocumentById(documentId);
  if (!document) {
    return { ok: false, error: "המכתב לא נמצא." };
  }

  if (!document.tags?.includes(MASTER_LETTER_TAG)) {
    return { ok: false, error: "מסמך זה אינו מכתב שמור." };
  }

  const followUp = parseMasterLetterMetadata(document)?.inspectorFollowUp;

  const deleted = await deleteDocument(documentId);
  if (!deleted) {
    return { ok: false, error: "מחיקת המכתב נכשלה." };
  }

  if (followUp?.reportDocumentId && followUp.letterStage) {
    const stage = followUp.letterStage;
    if (stage === "letter_1" || stage === "letter_2" || stage === "letter_3") {
      await deleteInspectorLetterPreparedEvidence({
        documentId: followUp.reportDocumentId,
        letterStage: stage,
      });
    }
  }

  return { ok: true, error: null };
}
