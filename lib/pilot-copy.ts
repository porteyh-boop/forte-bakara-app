/** נוסחי פיילוט — ללא רמז על שליחה לגורם חיצוני */

export const REPORT_SAVED_HEADLINE = "הדיווח נקלט במערכת פורטה בקרה.";

export const REPORT_SAVED_BODY =
  "הדיווח נשמר במערכת פורטה בקרה לצורכי תיעוד, מעקב ובקרת שירות.";

export const REPORT_SAVED_INFO =
  "המידע נשמר לצורכי תיעוד, מעקב ובקרת שירות.";

export const REPORT_MAINTENANCE_RESPONSIBILITY =
  "האחריות לדיווח התקלה לגורם התחזוקה הינה בהתאם לנוהלי הבניין.";

export const CLIENT_PORTAL_FAULT_SUBMIT_ERROR =
  "לא הצלחנו לשלוח את הדיווח. הפרטים נשמרו במסך וניתן לנסות שוב.";

export const REPORT_PAGE_SUBTITLE =
  "מלאו את פרטי התקלה — הדיווח יישמר במערכת לצורכי תיעוד, מעקב ובקרת שירות.";

/** ביטויים אסורים בממשק המשתמש — לבדיקות QA */
export const FORBIDDEN_EXTERNAL_REPORT_PHRASES = [
  "יועבר ישירות",
  "יועבר לחברת",
  "הדיווח יועבר",
  "הדיווח נשלח",
  "נשלח בהצלחה",
  "הועבר לחברת",
  "נפתח לטיפול",
  "נקלט לטיפול",
  "פתחה קריאה",
  "העבירה דיווח",
] as const;
