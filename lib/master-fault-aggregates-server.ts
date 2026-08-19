import { isAfterLiveStart } from "@/lib/building-live";
import { parseBuildingIdFilter } from "@/lib/master-client-access-server";
import { PILOT_FAULTS_TABLE } from "@/lib/pilot-cloud";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export interface MasterFaultAggregateDto {
  buildingId: string;
  buildingName: string;
  lastFaultDate: string | null;
}

interface FaultAggregateRow {
  building_id: string;
  building_name: string;
  created_at: string;
}

async function loadLiveStartedAtByBuilding(): Promise<
  Record<string, string | null>
> {
  const client = getSupabaseServiceClient();
  if (!client) return {};

  const { data, error } = await client
    .from("buildings")
    .select("building_id, live_started_at");

  if (error || !data) return {};

  const map: Record<string, string | null> = {};
  for (const row of data) {
    const record = row as Record<string, unknown>;
    const buildingId = parseBuildingIdFilter(String(record.building_id ?? ""));
    if (!buildingId) continue;
    map[buildingId] = record.live_started_at
      ? String(record.live_started_at)
      : null;
  }
  return map;
}

function aggregateFaultRows(
  rows: FaultAggregateRow[],
  liveStartedAtByBuilding: Record<string, string | null>
): MasterFaultAggregateDto[] {
  const map = new Map<string, MasterFaultAggregateDto>();

  for (const row of rows) {
    const buildingId = parseBuildingIdFilter(row.building_id);
    if (!buildingId) continue;

    const liveStartedAt = liveStartedAtByBuilding[buildingId];
    if (liveStartedAt && !isAfterLiveStart(row.created_at, liveStartedAt)) {
      continue;
    }

    const buildingName = row.building_name?.trim() || buildingId;
    const existing = map.get(buildingId);
    if (!existing) {
      map.set(buildingId, {
        buildingId,
        buildingName,
        lastFaultDate: row.created_at,
      });
      continue;
    }

    if (
      !existing.lastFaultDate ||
      new Date(row.created_at).getTime() >
        new Date(existing.lastFaultDate).getTime()
    ) {
      existing.lastFaultDate = row.created_at;
    }
    if (existing.buildingName === existing.buildingId && buildingName) {
      existing.buildingName = buildingName;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.buildingName.localeCompare(b.buildingName, "he")
  );
}

export async function listMasterFaultAggregatesServer(): Promise<{
  aggregates: MasterFaultAggregateDto[];
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { aggregates: [], error: "supabase_service_unconfigured" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { aggregates: [], error: "supabase_service_unconfigured" };
  }

  const [liveStartedAtByBuilding, faultsResult] = await Promise.all([
    loadLiveStartedAtByBuilding(),
    client
      .from(PILOT_FAULTS_TABLE)
      .select("building_id, building_name, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (faultsResult.error) {
    return { aggregates: [], error: faultsResult.error.message };
  }

  const rows = (faultsResult.data ?? []).map((row) => {
    const record = row as Record<string, unknown>;
    return {
      building_id: String(record.building_id ?? ""),
      building_name: String(record.building_name ?? ""),
      created_at: String(record.created_at ?? new Date().toISOString()),
    };
  });

  return {
    aggregates: aggregateFaultRows(rows, liveStartedAtByBuilding),
    error: null,
  };
}
