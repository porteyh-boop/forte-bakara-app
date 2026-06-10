import type { CloudBuildingRow } from "./buildings-cloud";

export type MasterBuildingSourceTag = "ענן" | "דמו" | "מדיווחים";

export interface MasterBuildingEntry {
  buildingId: string;
  name: string;
  city: string | null;
  sources: MasterBuildingSourceTag[];
  cloudRow: CloudBuildingRow | null;
  liveStartedAt: string | null;
  isCloudActive: boolean;
}

export interface FaultBuildingSummary {
  buildingId: string;
  buildingName: string;
}

function upsertEntry(
  map: Map<string, MasterBuildingEntry>,
  buildingId: string
): MasterBuildingEntry {
  const existing = map.get(buildingId);
  if (existing) return existing;

  const entry: MasterBuildingEntry = {
    buildingId,
    name: buildingId,
    city: null,
    sources: [],
    cloudRow: null,
    liveStartedAt: null,
    isCloudActive: true,
  };
  map.set(buildingId, entry);
  return entry;
}

function addSource(
  entry: MasterBuildingEntry,
  source: MasterBuildingSourceTag
): void {
  if (!entry.sources.includes(source)) {
    entry.sources.push(source);
  }
}

export function formatMasterBuildingSources(
  sources: MasterBuildingSourceTag[]
): string {
  return sources.length > 0 ? sources.join(" · ") : "—";
}

export function buildMasterBuildingList(params: {
  cloudBuildings: CloudBuildingRow[];
  demoBuildingIds: string[];
  resolveDemoName: (buildingId: string) => string;
  resolveDemoCity: (buildingId: string) => string | null;
  faultBuildings: FaultBuildingSummary[];
}): MasterBuildingEntry[] {
  const {
    cloudBuildings,
    demoBuildingIds,
    resolveDemoName,
    resolveDemoCity,
    faultBuildings,
  } = params;

  const map = new Map<string, MasterBuildingEntry>();

  for (const id of demoBuildingIds) {
    const entry = upsertEntry(map, id);
    addSource(entry, "דמו");
    entry.name = resolveDemoName(id);
    entry.city = resolveDemoCity(id);
  }

  for (const row of cloudBuildings) {
    const entry = upsertEntry(map, row.building_id);
    addSource(entry, "ענן");
    entry.cloudRow = row;
    entry.name = row.name;
    entry.city = row.city;
    entry.liveStartedAt = row.live_started_at ?? null;
    entry.isCloudActive = row.is_active;
  }

  for (const fault of faultBuildings) {
    const entry = upsertEntry(map, fault.buildingId);
    addSource(entry, "מדיווחים");
    if (entry.name === fault.buildingId && fault.buildingName.trim()) {
      entry.name = fault.buildingName.trim();
    }
  }

  const sourceOrder: MasterBuildingSourceTag[] = ["ענן", "דמו", "מדיווחים"];
  for (const entry of map.values()) {
    entry.sources.sort(
      (a, b) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b)
    );
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "he")
  );
}

export function summarizeFaultBuildings(
  faults: { building_id: string; building_name: string }[]
): FaultBuildingSummary[] {
  const map = new Map<string, FaultBuildingSummary>();
  for (const fault of faults) {
    if (!fault.building_id) continue;
    const existing = map.get(fault.building_id);
    if (existing) continue;
    map.set(fault.building_id, {
      buildingId: fault.building_id,
      buildingName: fault.building_name,
    });
  }
  return Array.from(map.values());
}
