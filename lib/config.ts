import type { UserRole } from "./types";

/**
 * תפקיד במערכת (דמו):
 * ברירת מחדל: "client" — תצוגת לקוח / ועד בית (לפריסת דמו ציבורית)
 * לבדיקה פנימית: הגדר NEXT_PUBLIC_APP_ROLE=expert ב-Vercel או מקומית
 */
export const APP_ROLE: UserRole =
  process.env.NEXT_PUBLIC_APP_ROLE === "expert" ? "expert" : "client";
