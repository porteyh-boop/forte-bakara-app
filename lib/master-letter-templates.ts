export const ELEVATOR_COMPANY_OPTIONS = [
  "אלקטרה",
  "קונה",
  "שינדלר",
  "טיב",
  "צום",
  "כפיר",
  "ישראליפט",
  "אחר",
] as const;

export type MasterLetterFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "textarea";

export interface MasterLetterTemplateField {
  id: string;
  label: string;
  type: MasterLetterFieldType;
  required?: boolean;
  placeholder?: string;
  options?: readonly string[];
  showIf?: { fieldId: string; value: string };
}

export const MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP = "building_follow_up" as const;
export const MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS = "inspector_findings" as const;
export const MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE =
  "elevator_company_response" as const;
export const MASTER_LETTER_TEMPLATE_VISIT_SUMMARY = "visit_summary" as const;
export const MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW = "price_proposal_review" as const;
export const MASTER_LETTER_TEMPLATE_RECURRING_FAULTS = "recurring_faults" as const;

export type MasterLetterTemplateId =
  | typeof MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP
  | typeof MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS
  | typeof MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE
  | typeof MASTER_LETTER_TEMPLATE_VISIT_SUMMARY
  | typeof MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW
  | typeof MASTER_LETTER_TEMPLATE_RECURRING_FAULTS;

export interface MasterLetterTemplateDefinition {
  id: MasterLetterTemplateId;
  label: string;
  description: string;
  defaultSubject: string;
  fields: MasterLetterTemplateField[];
}

export const MASTER_LETTER_TEMPLATES: MasterLetterTemplateDefinition[] = [
  {
    id: MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
    label: "אי ביצוע הערות בודק מוסמך",
    description: "מכתב דרישה לביצוע תיקונים שנמצאו בדוח בודק מוסמך ולא טופלו.",
    defaultSubject: "סקירת דוח בדיקה תקופתית של הבודק המוסמך למעליות",
    fields: [
      {
        id: "defect_count",
        label: "מספר ליקויים בדוח",
        type: "number",
        required: true,
      },
      {
        id: "elevator_company",
        label: "חברת המעליות / חברת השירות",
        type: "select",
        options: ELEVATOR_COMPANY_OPTIONS,
        required: true,
      },
      {
        id: "elevator_company_other",
        label: "שם חברת המעליות / השירות",
        type: "text",
        required: true,
        showIf: { fieldId: "elevator_company", value: "אחר" },
      },
      {
        id: "recipient_type",
        label: "שלח העתק ל:",
        type: "select",
        options: ["ועד בית", "חברת ניהול", "שניהם", "ללא"],
        required: true,
      },
      {
        id: "inspection_date",
        label: "תאריך הבדיקה",
        type: "date",
        required: true,
      },
      {
        id: "has_45_day_items",
        label: "האם קיימות הערות לביצוע תוך 45 יום?",
        type: "boolean",
        required: true,
      },
      {
        id: "report_attached",
        label: "האם הדוח צורף למכתב?",
        type: "boolean",
        required: true,
      },
    ],
  },
  {
    id: MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
    label: "דרישה להתייחסות מחברת מעליות",
    description: "פנייה רשמית לחברת המעליות לקבלת עמדה ותגובה בנושא ספציפי.",
    defaultSubject: "דרישה להתייחסות — חברת המעליות",
    fields: [
      {
        id: "elevator_company",
        label: "חברת המעליות / חברת השירות",
        type: "select",
        options: ELEVATOR_COMPANY_OPTIONS,
        required: true,
      },
      {
        id: "elevator_company_other",
        label: "שם חברת המעליות / השירות",
        type: "text",
        required: true,
        showIf: { fieldId: "elevator_company", value: "אחר" },
      },
      {
        id: "issue_topic",
        label: "נושא הפנייה",
        type: "text",
        required: true,
      },
      {
        id: "response_deadline",
        label: "מועד לתגובה",
        type: "date",
        required: true,
      },
      {
        id: "issue_details",
        label: "פירוט הנושא",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
    label: "סיכום ביקור מקצועי",
    description: "מכתב סיכום לאחר ביקור בשטח — ממצאים, מסקנות והמלצות.",
    defaultSubject: "סיכום ביקור מקצועי — בקרת שירות מעליות",
    fields: [
      {
        id: "visit_date",
        label: "תאריך הביקור",
        type: "date",
        required: true,
      },
      {
        id: "findings",
        label: "ממצאים",
        type: "textarea",
        required: true,
      },
      {
        id: "conclusions",
        label: "מסקנות",
        type: "textarea",
        required: true,
      },
      {
        id: "recommendations",
        label: "המלצות",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
    label: "התייחסות להצעת מחיר",
    description: "בחינה מקצועית של הצעת מחיר שהתקבלה ומתן חוות דעת.",
    defaultSubject: "התייחסות להצעת מחיר — בקרת שירות מעליות",
    fields: [
      {
        id: "vendor_name",
        label: "שם הספק / חברת המעליות",
        type: "text",
        required: true,
      },
      {
        id: "proposal_date",
        label: "תאריך ההצעה",
        type: "date",
        required: true,
      },
      {
        id: "proposal_amount",
        label: "סכום ההצעה (₪)",
        type: "text",
        required: true,
      },
      {
        id: "assessment",
        label: "חוות דעת מקצועית",
        type: "textarea",
        required: true,
      },
      {
        id: "recommendation",
        label: "המלצה",
        type: "select",
        options: ["לאשר את ההצעה", "לדרוש עדכון / הנחה", "לדחות את ההצעה"],
        required: true,
      },
    ],
  },
  {
    id: MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
    label: "תקלות חוזרות",
    description: "מכתב בנושא תקלות המתרחשות שוב ושוב ודורשות טיפול מהותי.",
    defaultSubject: "תקלות חוזרות — דרישה לטיפול מהותי",
    fields: [
      {
        id: "elevator_company",
        label: "חברת המעליות / חברת השירות",
        type: "select",
        options: ELEVATOR_COMPANY_OPTIONS,
        required: true,
      },
      {
        id: "elevator_company_other",
        label: "שם חברת המעליות / השירות",
        type: "text",
        required: true,
        showIf: { fieldId: "elevator_company", value: "אחר" },
      },
      {
        id: "fault_description",
        label: "תיאור התקלה החוזרת",
        type: "textarea",
        required: true,
      },
      {
        id: "recurrence_count",
        label: "מספר הופעות / דיווחים",
        type: "number",
        required: true,
      },
      {
        id: "action_requested",
        label: "פעולה מבוקשת",
        type: "textarea",
        required: true,
      },
    ],
  },
  {
    id: MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
    label: "מכתב מעקב לבניין",
    description: "מכתב מעקב כללי לבקרת שירות מעליות בבניין.",
    defaultSubject: "מכתב מעקב — בקרת שירות מעליות",
    fields: [],
  },
];

export function getMasterLetterTemplate(
  templateId: MasterLetterTemplateId
): MasterLetterTemplateDefinition | undefined {
  return MASTER_LETTER_TEMPLATES.find((template) => template.id === templateId);
}

export function getDefaultMasterLetterTemplateId(): MasterLetterTemplateId {
  return MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS;
}
