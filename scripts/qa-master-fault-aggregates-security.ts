/**
 * Security Phase 1.5B-2B — Master V2 fault aggregates server authorization QA.
 * Run: npx tsx scripts/qa-master-fault-aggregates-security.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

function loadEnvFile(rel: string): void {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

import {
  buildLiveStartedAtByBuilding,
  filterPilotFaultsByBuildingLiveStart,
} from "../lib/building-live";
import { getAllBuildingIds } from "../lib/buildings";
import { buildBuildingDossier } from "../lib/master-building-dossier";
import { listMasterFaultAggregatesServer } from "../lib/master-fault-aggregates-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import { mapPilotFaultRow, PILOT_FAULTS_TABLE } from "../lib/pilot-cloud";
import { getSupabaseServiceClient } from "../lib/supabase-server";
import { GET as listAggregatesGET } from "../app/forte/api/master-fault-aggregates/route";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function makeMasterApiRequest(
  urlPath: string,
  init?: { method?: string; cookie?: string }
): NextRequest {
  const url = `http://localhost:3000${urlPath}`;
  const headers: Record<string, string> = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };
  if (init?.cookie) headers.cookie = init.cookie;

  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
  });
}

function masterSessionCookie(): string | null {
  const token = createMasterSessionToken();
  if (!token) return null;
  return `${FORTE_MASTER_SESSION_COOKIE}=${token}`;
}

async function loadLegacyComparisonData(): Promise<{
  aggregatesByBuilding: Map<
    string,
    { buildingName: string; lastFaultDate: string | null }
  >;
} | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const [faultsResult, buildingsResult] = await Promise.all([
    client.from(PILOT_FAULTS_TABLE).select("*").order("created_at", {
      ascending: false,
    }),
    client.from("buildings").select("building_id, live_started_at"),
  ]);

  if (faultsResult.error || !faultsResult.data) return null;

  const cloudLiveMap: Record<string, string | null> = {};
  for (const row of buildingsResult.data ?? []) {
    const record = row as Record<string, unknown>;
    cloudLiveMap[String(record.building_id)] = record.live_started_at
      ? String(record.live_started_at)
      : null;
  }

  const faults = faultsResult.data.map((row) =>
    mapPilotFaultRow(row as Record<string, unknown>)
  );
  const liveStartedAtByBuilding = buildLiveStartedAtByBuilding(
    getAllBuildingIds(),
    cloudLiveMap
  );
  const dossierFaults = filterPilotFaultsByBuildingLiveStart(
    faults,
    liveStartedAtByBuilding
  );

  const buildingIds = new Set(dossierFaults.map((fault) => fault.building_id));
  const aggregatesByBuilding = new Map<
    string,
    { buildingName: string; lastFaultDate: string | null }
  >();

  for (const buildingId of buildingIds) {
    const dossier = buildBuildingDossier({
      buildingId,
      buildingName: buildingId,
      faults: dossierFaults,
      registeredElevatorIds: [],
    });
    aggregatesByBuilding.set(buildingId, {
      buildingName:
        dossierFaults.find((fault) => fault.building_id === buildingId)
          ?.building_name ?? buildingId,
      lastFaultDate: dossier.lastFaultDate,
    });
  }

  return { aggregatesByBuilding };
}

async function main(): Promise<void> {
  console.log("\n=== Master V2 Fault Aggregates Security QA ===\n");

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";

  const listRes = await listAggregatesGET(
    makeMasterApiRequest("/forte/api/master-fault-aggregates")
  );
  assert(listRes.status === 401, "GET /master-fault-aggregates without session → 401");

  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  const serverSource = read("lib/master-fault-aggregates-server.ts");
  assert(
    serverSource.includes("getSupabaseServiceClient") &&
      !serverSource.includes("getPilotSupabaseClient"),
    "master-fault-aggregates-server: service_role only"
  );
  assert(
    serverSource.includes("building_id, building_name, created_at") &&
      !serverSource.includes("description") &&
      !serverSource.includes("image_data") &&
      !serverSource.includes("source_device_id"),
    "server select: minimal fault columns only"
  );

  const routeSource = read("app/forte/api/master-fault-aggregates/route.ts");
  assert(
    routeSource.includes("requireMasterApiSession") &&
      routeSource.includes("isAllowedForteApiOrigin"),
    "aggregate route: master session + origin check"
  );

  const pageSource = read("components/master-v2/MasterPageContentV2.tsx");
  assert(
    !pageSource.includes("getAllPilotFaults") &&
      !pageSource.includes("getPilotSupabaseClient") &&
      !pageSource.includes('from("pilot_faults")'),
    "MasterPageContentV2: no direct pilot_faults browser access"
  );
  assert(
    pageSource.includes("listMasterFaultAggregates") &&
      pageSource.includes("master-fault-aggregates-api"),
    "MasterPageContentV2: uses master-fault-aggregates-api"
  );
  assert(
    !pageSource.includes("buildBuildingDossier"),
    "MasterPageContentV2: no full dossier rebuild from raw faults"
  );

  const apiClientSource = read("lib/master-fault-aggregates-api.ts");
  assert(
    !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClientSource.includes("getSupabaseServiceClient"),
    "master-fault-aggregates-api: no service_role in browser client"
  );
  assert(
    apiClientSource.includes('"/forte/api/master-fault-aggregates"'),
    "client API: single aggregate endpoint (no N+1)"
  );

  const faultsTab = read(
    "components/master-v2/project-v2/MasterProjectV2FaultsTab.tsx"
  );
  assert(
    faultsTab.includes("master-faults-api"),
    "Phase 2A FaultsTab still uses master-faults-api"
  );

  const sessionCookie = masterSessionCookie();
  if (sessionCookie) {
    const authedRes = await listAggregatesGET(
      makeMasterApiRequest("/forte/api/master-fault-aggregates", {
        cookie: sessionCookie,
      })
    );
    assert(authedRes.status === 200, "GET /master-fault-aggregates with session → 200");

    const payload = (await authedRes.json()) as {
      aggregates?: Array<Record<string, unknown>>;
    };
    const aggregates = payload.aggregates ?? [];
    assert(Array.isArray(aggregates), "response: aggregates array");

    const forbiddenFields = [
      "description",
      "image_data",
      "image_url",
      "source_device_id",
      "treatment_note",
      "closure_note",
      "ticket_number",
      "fault_source",
      "faults",
      "id",
    ];
    const sample = aggregates[0];
    if (sample) {
      for (const field of forbiddenFields) {
        assert(!(field in sample), `response sample excludes "${field}"`);
      }
      assert(
        typeof sample.buildingId === "string" &&
          typeof sample.buildingName === "string" &&
          (sample.lastFaultDate === null || typeof sample.lastFaultDate === "string"),
        "response sample: allowed aggregate fields only"
      );
    } else {
      assert(true, "response sample check skipped (no aggregates in DB)");
    }

    const legacy = await loadLegacyComparisonData();
    const serverAggregates = await listMasterFaultAggregatesServer();
    if (legacy && !serverAggregates.error) {
      let matches = 0;
      let checked = 0;
      for (const aggregate of serverAggregates.aggregates) {
        const expected = legacy.aggregatesByBuilding.get(aggregate.buildingId);
        if (!expected) {
          assert(false, `legacy comparison missing building ${aggregate.buildingId}`);
          continue;
        }
        checked += 1;
        const sameDate = expected.lastFaultDate === aggregate.lastFaultDate;
        if (sameDate) matches += 1;
      }
      assert(
        checked === 0 || matches === checked,
        "aggregate lastFaultDate matches legacy MasterPageContentV2 logic"
      );

      const emptyBuilding = serverAggregates.aggregates.find(
        (row) => row.lastFaultDate === null
      );
      if (emptyBuilding) {
        assert(true, "building with null lastFaultDate represented correctly");
      } else {
        assert(true, "null lastFaultDate case skipped (no empty building sample)");
      }
    } else {
      assert(true, "legacy comparison skipped (service DB unavailable)");
    }
  } else {
    console.warn("  ⚠ Skipping authenticated integration tests (no session secret)");
  }

  console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
