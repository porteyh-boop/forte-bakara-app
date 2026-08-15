export const MASTER_PROJECTS_V2_LIST_PATH = "/master?ui=v2";
export const MASTER_PROJECT_V2_NEW_PATH = "/master/project-v2/new";

export function buildMasterProjectV2Path(
  buildingId: string,
  tab?: string
): string {
  const params = new URLSearchParams({ buildingId });
  if (tab) params.set("tab", tab);
  return `/master/project-v2?${params.toString()}`;
}

export function buildMasterProjectV2FaultPath(
  buildingId: string,
  faultId?: string
): string {
  const params = new URLSearchParams({ buildingId, tab: "faults" });
  if (faultId) params.set("faultId", faultId);
  return `/master/project-v2?${params.toString()}`;
}

export function buildMasterProjectV2LetterPrefillPath(input: {
  buildingId: string;
  inspectorDocId: string;
  letterStage: "letter_1" | "letter_2" | "letter_3";
}): string {
  const params = new URLSearchParams({
    buildingId: input.buildingId,
    tab: "letters",
    inspectorDocId: input.inspectorDocId,
    letterStage: input.letterStage,
  });
  return `/master/project-v2?${params.toString()}`;
}

export const PROJECT_V2_TAB_IDS = [
  "details",
  "letters",
  "inspections",
  "faults",
  "contacts",
  "documents",
  "tasks",
  "reports",
  "ai",
  "permissions",
  "settings",
] as const;

export type ProjectV2TabId = (typeof PROJECT_V2_TAB_IDS)[number];

export function isProjectV2TabId(value: string | null): value is ProjectV2TabId {
  return Boolean(value && PROJECT_V2_TAB_IDS.includes(value as ProjectV2TabId));
}
