import type { ProjectV2TabId } from "@/lib/master-project-v2-routes";

export const PROJECT_TYPE_IDS = ["standard", "home_inspection"] as const;
export type ProjectTypeId = (typeof PROJECT_TYPE_IDS)[number];

export const DEFAULT_PROJECT_TYPE: ProjectTypeId = "standard";

export const PROJECT_TYPE_LABELS: Record<ProjectTypeId, string> = {
  standard: "פרויקט רגיל",
  home_inspection: "בדק בית",
};

export const PROJECT_V2_TAB_LABELS: Record<ProjectV2TabId, string> = {
  details: "פרטי הפרויקט",
  letters: "מכתבים",
  inspections: "בדיקות",
  faults: "תקלות",
  contacts: "אנשי קשר",
  documents: "מסמכים",
  tasks: "משימות",
  reports: "דוחות",
  ai: "AI Assistant",
  permissions: "הרשאות",
  settings: "הגדרות",
};

interface ProjectTypeConfigEntry {
  label: string;
  tabs: readonly ProjectV2TabId[];
  showTypeInList: boolean;
}

export const PROJECT_TYPE_CONFIG: Record<ProjectTypeId, ProjectTypeConfigEntry> = {
  standard: {
    label: PROJECT_TYPE_LABELS.standard,
    tabs: [
      "details",
      "letters",
      "inspections",
      "faults",
      "contacts",
      "tasks",
      "reports",
      "ai",
      "permissions",
      "settings",
    ],
    showTypeInList: false,
  },
  home_inspection: {
    label: PROJECT_TYPE_LABELS.home_inspection,
    tabs: ["details", "contacts", "documents"],
    showTypeInList: true,
  },
};

export function normalizeProjectType(value: unknown): ProjectTypeId {
  if (typeof value === "string" && PROJECT_TYPE_IDS.includes(value as ProjectTypeId)) {
    return value as ProjectTypeId;
  }
  return DEFAULT_PROJECT_TYPE;
}

export function getProjectTypeLabel(type: ProjectTypeId): string {
  return PROJECT_TYPE_CONFIG[type].label;
}

export function getTabsForProjectType(type: ProjectTypeId): readonly ProjectV2TabId[] {
  return PROJECT_TYPE_CONFIG[type].tabs;
}

export function isTabAllowedForProjectType(
  type: ProjectTypeId,
  tab: ProjectV2TabId | "details"
): boolean {
  if (tab === "details") return true;
  return getTabsForProjectType(type).includes(tab);
}

export function resolveAllowedProjectV2Tab(
  type: ProjectTypeId,
  tab: ProjectV2TabId | "details" | null,
  options?: { faultId?: string | null }
): ProjectV2TabId | "details" {
  if (options?.faultId && isTabAllowedForProjectType(type, "faults")) {
    return "faults";
  }
  if (tab === "documents" && !isTabAllowedForProjectType(type, "documents")) {
    return "details";
  }
  if (tab && tab !== "details" && isTabAllowedForProjectType(type, tab)) {
    return tab;
  }
  return "details";
}

export function shouldShowProjectTypeInList(type: ProjectTypeId): boolean {
  return PROJECT_TYPE_CONFIG[type].showTypeInList;
}

export function getProjectNumberLabel(type: ProjectTypeId): string {
  return type === "home_inspection" ? "מספר הזמנה" : "מספר פרויקט";
}
