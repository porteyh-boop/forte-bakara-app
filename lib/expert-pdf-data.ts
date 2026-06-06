import { getExpertAnalytics } from "./analytics";
import { building, faults } from "./data";
import type { ExpertAnalytics } from "./types";

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
  analytics: ExpertAnalytics;
}

export function getExpertPdfData(): ExpertPdfReportData {
  const analytics = getExpertAnalytics();
  const open = faults.filter((f) => f.status !== "טופלה").length;
  const closed = faults.filter((f) => f.status === "טופלה").length;

  return {
    generatedAt: new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
    building: {
      name: building.name,
      address: building.address,
      city: building.city,
      elevatorCount: building.elevatorCount,
      elevatorCompany: building.elevatorCompany,
      managementCompany: building.managementCompany,
    },
    faultSummary: {
      total: faults.length,
      open,
      closed,
    },
    analytics,
  };
}
