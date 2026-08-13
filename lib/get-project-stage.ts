import type { ProjectStage } from "@/lib/buildings-cloud";

export interface ProjectStageContext {
  storedStage?: ProjectStage | null;
  liveStartedAt?: string | null;
}

/**
 * שלב פרויקט — אוטומטי כשיש אות אמין, אחרת project_stage שמור.
 */
export function getProjectStage(
  _buildingId: string,
  context?: ProjectStageContext
): string {
  if (context?.storedStage === "פרויקט סגור") {
    return context.storedStage;
  }

  if (context?.liveStartedAt) {
    if (
      !context.storedStage ||
      context.storedStage === "הצעת מחיר" ||
      context.storedStage === "משא ומתן"
    ) {
      return "ביצוע";
    }
  }

  if (context?.storedStage) {
    return context.storedStage;
  }

  return "לא נקבע";
}
