import type { ProjectTypeId } from "@/lib/project-type-config";
import { PROJECT_TYPE_IDS } from "@/lib/project-type-config";

/** Legacy stages (migration 021) — synced with PROJECT_STAGE_OPTIONS in buildings-cloud. */
const LEGACY_PROJECT_STAGE_LABELS: readonly string[] = [
  "הצעת מחיר",
  "משא ומתן",
  "הזמנה",
  "תכנון",
  "ביצוע",
  "מסירה",
  "פרויקט סגור",
];

export interface ProjectWorkflowStepDefinition {
  id: string;
  label: string;
  progress: number;
}

export interface ProjectWorkflowState {
  completedSteps: Record<string, string>;
}

export const PROJECT_WORKFLOW_UNCHECK_CONFIRM_MESSAGE =
  "ביטול שלב זה יאפס גם את השלבים שבוצעו אחריו. להמשיך?";

export const PROJECT_WORKFLOWS: Record<
  ProjectTypeId,
  readonly ProjectWorkflowStepDefinition[]
> = {
  home_inspection: [
    { id: "quote", label: "הצעת מחיר", progress: 10 },
    { id: "negotiation", label: "משא ומתן", progress: 20 },
    { id: "approval", label: "אישור הצעה", progress: 35 },
    { id: "materials", label: "קבלת חומר מהלקוח", progress: 45 },
    { id: "execution", label: "ביצוע הבדיקה / העבודה", progress: 60 },
    { id: "report_prep", label: "הכנת חוות דעת", progress: 75 },
    { id: "report_sent", label: "שליחת חוות דעת", progress: 90 },
    { id: "completed", label: "הושלם", progress: 100 },
  ],
  standard: [
    { id: "quote", label: "הצעת מחיר", progress: 10 },
    { id: "negotiation", label: "משא ומתן", progress: 20 },
    { id: "approval", label: "אישור הצעה", progress: 30 },
    { id: "work_open", label: "פתיחת עבודה", progress: 40 },
    { id: "materials", label: "איסוף חומר", progress: 50 },
    { id: "execution", label: "ביצוע עבודה מקצועית", progress: 65 },
    { id: "documents", label: "הפקת מסמכים / דוח", progress: 80 },
    { id: "delivery", label: "מסירה ללקוח", progress: 90 },
    { id: "completed", label: "הושלם", progress: 100 },
  ],
};

export type ProjectWorkflowStepStatus = "completed" | "current" | "pending";

export function getProjectWorkflow(
  projectType: ProjectTypeId
): readonly ProjectWorkflowStepDefinition[] {
  return PROJECT_WORKFLOWS[projectType];
}

export function hasProjectWorkflow(projectType: ProjectTypeId): boolean {
  return PROJECT_WORKFLOWS[projectType].length > 0;
}

export function emptyProjectWorkflowState(): ProjectWorkflowState {
  return { completedSteps: {} };
}

export function parseProjectWorkflowState(
  raw: unknown
): ProjectWorkflowState | null {
  if (!raw || typeof raw !== "object") return null;
  const completedStepsRaw = (raw as Record<string, unknown>).completedSteps;
  if (!completedStepsRaw || typeof completedStepsRaw !== "object") {
    return null;
  }

  const completedSteps: Record<string, string> = {};
  for (const [stepId, value] of Object.entries(completedStepsRaw)) {
    if (typeof value === "string" && value.trim()) {
      completedSteps[stepId] = value;
    }
  }

  return { completedSteps };
}

export function serializeProjectWorkflowState(
  state: ProjectWorkflowState
): { completedSteps: Record<string, string> } {
  return { completedSteps: { ...state.completedSteps } };
}

export function isWorkflowStepCompleted(
  state: ProjectWorkflowState | null | undefined,
  stepId: string
): boolean {
  return Boolean(state?.completedSteps[stepId]);
}

export function getHighestCompletedStepIndex(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined
): number {
  if (!state) return -1;
  let highest = -1;
  steps.forEach((step, index) => {
    if (state.completedSteps[step.id]) {
      highest = index;
    }
  });
  return highest;
}

export function computeWorkflowProgress(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined
): number | null {
  const highest = getHighestCompletedStepIndex(steps, state);
  if (highest < 0) return null;
  return steps[highest]?.progress ?? null;
}

export function computeWorkflowCurrentStepLabel(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined
): string | null {
  if (!state || Object.keys(state.completedSteps).length === 0) {
    return null;
  }

  for (const step of steps) {
    if (!state.completedSteps[step.id]) {
      return step.label;
    }
  }

  return steps[steps.length - 1]?.label ?? null;
}

export function getWorkflowStepStatus(
  stepIndex: number,
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined
): ProjectWorkflowStepStatus {
  const step = steps[stepIndex];
  if (!step) return "pending";

  if (state?.completedSteps[step.id]) {
    return "completed";
  }

  const highest = getHighestCompletedStepIndex(steps, state);
  if (highest < 0 && stepIndex === 0) {
    return "current";
  }

  if (stepIndex === highest + 1) {
    return "current";
  }

  return "pending";
}

export function completeWorkflowStep(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined,
  stepId: string,
  completedAt: string = new Date().toISOString()
): ProjectWorkflowState {
  const targetIndex = steps.findIndex((step) => step.id === stepId);
  if (targetIndex < 0) {
    return state ?? emptyProjectWorkflowState();
  }

  const next: ProjectWorkflowState = {
    completedSteps: { ...(state?.completedSteps ?? {}) },
  };

  for (let index = 0; index <= targetIndex; index += 1) {
    const step = steps[index];
    if (!step) continue;
    if (!next.completedSteps[step.id]) {
      next.completedSteps[step.id] = completedAt;
    }
  }

  return next;
}

export function uncompleteWorkflowStep(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState | null | undefined,
  stepId: string
): ProjectWorkflowState {
  const targetIndex = steps.findIndex((step) => step.id === stepId);
  if (targetIndex < 0) {
    return state ?? emptyProjectWorkflowState();
  }

  const next: ProjectWorkflowState = {
    completedSteps: { ...(state?.completedSteps ?? {}) },
  };

  for (let index = targetIndex; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step) continue;
    delete next.completedSteps[step.id];
  }

  return next;
}

export function buildWorkflowBuildingPatch(
  steps: readonly ProjectWorkflowStepDefinition[],
  state: ProjectWorkflowState
): {
  projectStage: string | null;
  projectProgress: number | null;
  projectWorkflowState: ProjectWorkflowState;
} {
  const progress = computeWorkflowProgress(steps, state);
  const currentLabel = computeWorkflowCurrentStepLabel(steps, state);
  const allComplete = steps.every((step) => Boolean(state.completedSteps[step.id]));

  return {
    projectStage: allComplete
      ? (steps[steps.length - 1]?.label ?? null)
      : currentLabel,
    projectProgress: progress,
    projectWorkflowState: state,
  };
}

export function formatWorkflowStepDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function resolveProjectWorkflowProgress(
  projectType: ProjectTypeId,
  workflowState: ProjectWorkflowState | null | undefined,
  storedProgress: number | null | undefined
): number | null {
  const steps = getProjectWorkflow(projectType);
  const fromWorkflow = computeWorkflowProgress(steps, workflowState);
  if (fromWorkflow != null) return fromWorkflow;
  return storedProgress ?? null;
}

export function resolveProjectWorkflowStageLabel(
  projectType: ProjectTypeId,
  workflowState: ProjectWorkflowState | null | undefined,
  fallbackStage: string
): string {
  const steps = getProjectWorkflow(projectType);
  const fromWorkflow = computeWorkflowCurrentStepLabel(steps, workflowState);
  if (fromWorkflow) return fromWorkflow;
  return fallbackStage;
}

/** שלבי סיום שקולים — workflow "הושלם" ו-legacy "פרויקט סגור". */
export const PROJECT_COMPLETED_STAGE_LABELS = [
  "הושלם",
  "פרויקט סגור",
] as const;

export function isProjectCompletedStage(label: string | null | undefined): boolean {
  if (!label) return false;
  return (PROJECT_COMPLETED_STAGE_LABELS as readonly string[]).includes(label.trim());
}

/** האם שלב מוצג תואם למסנן (כולל סיום שקול). */
export function projectStagesMatchFilter(
  filterStage: string,
  displayedStage: string
): boolean {
  if (filterStage === displayedStage) return true;
  if (isProjectCompletedStage(filterStage) && isProjectCompletedStage(displayedStage)) {
    return true;
  }
  return false;
}

/** אפשרויות מסנן "שלב פרויקט" — workflow + legacy, ללא כפילויות. */
export function getProjectStageFilterOptions(): string[] {
  const labels = new Set<string>();

  for (const projectType of PROJECT_TYPE_IDS) {
    for (const step of PROJECT_WORKFLOWS[projectType]) {
      labels.add(step.label);
    }
  }

  for (const legacyStage of LEGACY_PROJECT_STAGE_LABELS) {
    labels.add(legacyStage);
  }

  return Array.from(labels).sort((a, b) => a.localeCompare(b, "he"));
}
