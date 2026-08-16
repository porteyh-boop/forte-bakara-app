"use client";

import { useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import {
  ForteV2Panel,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { updateCloudBuilding, type CloudBuildingRow } from "@/lib/buildings-cloud";
import { normalizeProjectType } from "@/lib/project-type-config";
import {
  PROJECT_WORKFLOW_UNCHECK_CONFIRM_MESSAGE,
  buildWorkflowBuildingPatch,
  completeWorkflowStep,
  formatWorkflowStepDate,
  getProjectWorkflow,
  getWorkflowStepStatus,
  hasProjectWorkflow,
  uncompleteWorkflowStep,
  type ProjectWorkflowState,
} from "@/lib/project-workflow";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

interface ProjectWorkflowProgressProps {
  cloudRow: CloudBuildingRow;
  onSaved?: (row: CloudBuildingRow) => void;
}

export default function ProjectWorkflowProgress({
  cloudRow,
  onSaved,
}: ProjectWorkflowProgressProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();
  const projectType = normalizeProjectType(cloudRow.project_type);

  if (!hasProjectWorkflow(projectType)) {
    return null;
  }

  const steps = getProjectWorkflow(projectType);
  const workflowState = cloudRow.project_workflow_state;
  const displayProgress = cloudRow.project_progress;
  const [savingStepId, setSavingStepId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persistWorkflowState(nextState: ProjectWorkflowState) {
    if (!guardSensitiveAction()) return;

    const patch = buildWorkflowBuildingPatch(steps, nextState);
    setSavingStepId("saving");
    setError(null);

    const updated = await updateCloudBuilding(cloudRow.id, {
      projectStage: patch.projectStage,
      projectProgress: patch.projectProgress,
      projectWorkflowState: patch.projectWorkflowState,
    });

    setSavingStepId(null);

    if (!updated) {
      setError("שמירת התקדמות הפרויקט נכשלה.");
      return;
    }

    onSaved?.(updated);
  }

  async function handleToggle(stepId: string, currentlyCompleted: boolean) {
    if (!cloudReady || savingStepId) return;

    if (currentlyCompleted) {
      const confirmed = window.confirm(PROJECT_WORKFLOW_UNCHECK_CONFIRM_MESSAGE);
      if (!confirmed) return;
      const nextState = uncompleteWorkflowStep(steps, workflowState, stepId);
      await persistWorkflowState(nextState);
      return;
    }

    const nextState = completeWorkflowStep(steps, workflowState, stepId);
    await persistWorkflowState(nextState);
  }

  const progressPercent = displayProgress ?? 0;
  const currentStepLabel =
    patchLabelFromRow(cloudRow) ??
    steps.find(
      (_, index) =>
        getWorkflowStepStatus(index, steps, workflowState) === "current"
    )?.label ??
    (Object.keys(workflowState?.completedSteps ?? {}).length > 0
      ? steps[steps.length - 1]?.label
      : null) ??
    "—";

  return (
    <ForteV2Panel className="mt-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold text-forte-text">התקדמות הפרויקט</h3>
          <p className="text-xs text-forte-text-secondary mt-1">
            סמנו שלבים שהושלמו — האחוז והשלב הנוכחי מתעדכנים אוטומטית.
          </p>
        </div>

        <div className="rounded-lg border border-forte-border bg-forte-blue-light/20 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-forte-text">
              התקדמות: {displayProgress == null ? "—" : `${displayProgress}%`}
            </p>
            <p className="text-xs text-forte-text-secondary">
              שלב נוכחי: {currentStepLabel}
            </p>
          </div>
          <div
            className="h-2 rounded-full bg-forte-border/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={displayProgress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-forte-primary transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        {error && (
          <MasterProjectV2StatusBanner tone="error">{error}</MasterProjectV2StatusBanner>
        )}

        {!cloudReady && (
          <MasterProjectV2StatusBanner tone="warning">
            Supabase לא מוגדר — לא ניתן לעדכן שלבים.
          </MasterProjectV2StatusBanner>
        )}

        <ol className="space-y-2">
          {steps.map((step, index) => {
            const status = getWorkflowStepStatus(index, steps, workflowState);
            const completedAt = workflowState?.completedSteps[step.id];
            const isCompleted = status === "completed";

            return (
              <li
                key={step.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  status === "current"
                    ? "border-forte-primary/40 bg-forte-primary/5"
                    : "border-forte-border/70 bg-white"
                }`}
              >
                <label className="flex items-start gap-3 flex-1 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    disabled={!cloudReady || Boolean(savingStepId)}
                    onChange={() => void handleToggle(step.id, isCompleted)}
                    className="mt-1 h-5 w-5 shrink-0 accent-forte-primary"
                    aria-label={`${step.label}${isCompleted ? " — הושלם" : ""}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`text-sm font-medium ${
                          isCompleted
                            ? "text-forte-text"
                            : status === "current"
                              ? "text-forte-primary"
                              : "text-forte-text-secondary"
                        }`}
                      >
                        {statusIcon(status)} {step.label}
                      </span>
                      {status === "current" && !isCompleted && (
                        <span className="text-[11px] text-forte-primary font-medium">
                          בתהליך
                        </span>
                      )}
                    </span>
                    {completedAt && (
                      <span className="block text-[11px] text-forte-text-secondary mt-0.5">
                        {formatWorkflowStepDate(completedAt)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
      </div>
    </ForteV2Panel>
  );
}

function statusIcon(status: "completed" | "current" | "pending"): string {
  if (status === "completed") return "✓";
  if (status === "current") return "●";
  return "○";
}

function patchLabelFromRow(row: CloudBuildingRow): string | null {
  if (row.project_stage?.trim()) {
    return row.project_stage.trim();
  }
  return null;
}
