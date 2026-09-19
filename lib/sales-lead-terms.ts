/** Active terms / privacy document version (stored on public-form leads). */
export const PUBLIC_SALES_LEAD_TERMS_VERSION = "2026-09";

export const PUBLIC_SALES_LEAD_TERMS_DISPLAY_DATE = "ספטמבר 2026";

export const PUBLIC_SALES_LEAD_TERMS_LINK_LABEL =
  "תנאי השימוש ומדיניות הפרטיות";

export const PUBLIC_SALES_LEAD_TERMS_CHECKBOX_PREFIX =
  "קראתי ואני מאשר/ת את ";

export const PUBLIC_SALES_LEAD_TERMS_CHECKBOX_SUFFIX =
  ", לרבות שמירת הפרטים שמסרתי לצורך טיפול בפנייה ויצירת קשר עמי.";

export const PUBLIC_SALES_LEAD_TERMS_VALIDATION_ERROR =
  "יש לאשר את תנאי השימוש ומדיניות הפרטיות לפני שליחת הפנייה.";

export function isPublicSalesLeadTermsAccepted(value: unknown): boolean {
  return value === true;
}
