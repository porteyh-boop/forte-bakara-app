import { getExpertAnalytics } from "./analytics";
import { getFeedbackStats } from "./feedback-stats";
import { getFaultLifecycleStats } from "./fault-stats";
import { DEFAULT_BUILDING_ID, getBuildingDataset } from "./buildings";
import type { BuildingDataContext, ExpertAnalytics, PilotFeedback } from "./types";

export interface ExpertPdfReportData {
  generatedAt: string;
  building: {
    name: string;
    address: string;
    city: string;
    elevatorCount: number;
    elevatorCompany: string;
    managementCompany: string;
  };
  faultSummary: {
    total: number;
    open: number;
    closed: number;
  };
  lifecycleStats: ReturnType<typeof getFaultLifecycleStats>;
  analytics: ExpertAnalytics;
  feedbackSummary: ReturnType<typeof getFeedbackStats>;
}

export function getExpertPdfData(
  ctxOrId?: BuildingDataContext | string,
  feedback: PilotFeedback[] = []
): ExpertPdfReportData {
  const ctx =
    typeof ctxOrId === "string"
      ? getBuildingDataset(ctxOrId)
      : ctxOrId ?? getBuildingDataset(DEFAULT_BUILDING_ID);
  const analytics = getExpertAnalytics(ctx);
  const lifecycleStats = getFaultLifecycleStats(ctx, ctx.faults);
  const open = lifecycleStats.openFaults;
  const closed = lifecycleStats.closedFaults;
  const feedbackSummary = getFeedbackStats(feedback);

  return {
    generatedAt: new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
    building: {
      name: ctx.building.name,
      address: ctx.building.address,
      city: ctx.building.city,
      elevatorCount: ctx.building.elevatorCount,
      elevatorCompany: ctx.building.elevatorCompany,
      managementCompany: ctx.building.managementCompany,
    },
    faultSummary: {
      total: ctx.faults.length,
      open,
      closed,
    },
    lifecycleStats,
    analytics,
    feedbackSummary,
  };
}
