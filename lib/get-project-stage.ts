import {
  resolveProjectWorkflowProgress,
  resolveProjectWorkflowStageLabel,
  isProjectCompletedStage,
} from "@/lib/project-workflow";
import { normalizeProjectType } from "@/lib/project-type-config";

export interface ProjectStageContext {
  storedStage?: string | null;
  liveStartedAt?: string | null;
  projectType?: ReturnType<typeof normalizeProjectType>;
  workflowState?: import("@/lib/project-workflow").ProjectWorkflowState | null;
  storedProgress?: number | null;
}

/**
 * שלב פרויקט — אוטומטי כשיש אות אמין, אחרת project_stage שמור.
 */
export function getProjectStage(
  _buildingId: string,
  context?: ProjectStageContext
): string {
  const projectType = context?.projectType ?? "standard";
  const legacyStage = getLegacyProjectStage(context);

  return resolveProjectWorkflowStageLabel(
    projectType,
    context?.workflowState,
    legacyStage
  );
}

export function getLegacyProjectStage(context?: ProjectStageContext): string {
  if (context?.storedStage && isProjectCompletedStage(context.storedStage)) {
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

export function getProjectProgress(context?: ProjectStageContext): number | null {
  const projectType = context?.projectType ?? "standard";
  return resolveProjectWorkflowProgress(
    projectType,
    context?.workflowState,
    context?.storedProgress ?? null
  );
}
