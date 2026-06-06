/** מיתוג רשמי — פורטה בקרה / FORTE */

export const BRAND_FORTE = "FORTE";
export const BRAND_APP = "פורטה בקרה";
export const BRAND_EDITOR_NAME = "יהודה פורטה";
export const BRAND_EDITOR_TITLE = "שמאות וליווי מקצועי למעליות";
export const BRAND_REPORT_TITLE = "דוח בקרת שירות מעליות";
export const BRAND_INTERNAL_ONLY = "פנימי בלבד – לא להצגה ללקוח";
export const BRAND_TAGLINE = "בקרת שירות מעליות דיגיטלית";
export const BRAND_EDITOR_FULL = `${BRAND_EDITOR_NAME} · ${BRAND_EDITOR_TITLE}`;

export const BRAND_SIGNATURE = {
  greeting: "בברכה,",
  name: BRAND_EDITOR_NAME,
  title: BRAND_EDITOR_TITLE,
  forte: BRAND_FORTE,
} as const;

/** מונחים אסורים — אין להשתמש במערכת */
export const FORBIDDEN_BRAND_TERMS = [
  "יועץ מעליות",
  "יועצת מעליות",
  "ייעוץ מעליות",
  "יועץ ושמאי מעליות",
  "יועץ ושמאי",
  "יועץ",
  "יועצת",
  "ייעוץ",
  "consultant",
  "advisor",
  "advisory",
  "consulting",
  "elevator consultant",
  "elevator advisor",
] as const;
