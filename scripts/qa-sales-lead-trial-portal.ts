/**
 * Sales lead trial portal — idempotency, win reuse, filters (no live Supabase).
 * Run: npx tsx scripts/qa-sales-lead-trial-portal.ts
 */
import {
  computeStatisticsPeriodFaultCounts,
  filterStatisticsRowsByElevatorName,
  type StatisticsFaultRow,
} from "../lib/statistics";
import {
  parseSalesLeadTrialProvisionInput,
  parseTrialProvisionRpcResult,
  simulateParallelTrialProvisions,
  simulateWinConvertWithTrial,
  type SimulatedTrialStore,
  type SimulatedWinWithTrialStore,
} from "../lib/sales-lead-trial-portal";
import { formatMasterFaultInboxBuildingLabel } from "../lib/master-fault-inbox";
import {
  canOpenSalesLeadTrialPortalForLead,
  isSyntheticSalesTrialQaLead,
  SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS,
  SALES_TRIAL_PORTAL_ENV_ENABLED,
} from "../lib/sales-lead-trial-portal-feature";

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

async function main(): Promise<void> {
  console.log("\nSales lead trial portal QA\n");

  const parsed = parseSalesLeadTrialProvisionInput({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevatorNames: [" א ", "ב"],
  });
  assert(parsed?.elevatorNames.length === 2, "parse provision input trims elevators");
  assert(
    parseSalesLeadTrialProvisionInput({ expiresAt: "", elevatorNames: ["a"] }) === null,
    "parse provision rejects empty expiry"
  );

  const rpc = parseTrialProvisionRpcResult({
    building_id: "750101",
    client_user_id: "00000000-0000-4000-8000-000000000001",
    access_token: "abc",
    already_provisioned: true,
  });
  assert(rpc?.alreadyProvisioned === true, "parse RPC already_provisioned");

  const trialStore: SimulatedTrialStore = {
    trialBuildingIdByLead: {},
    trialClientUserIdByLead: {},
    buildingIds: [],
  };
  let seq = 750100;
  const parallel = await simulateParallelTrialProvisions(
    trialStore,
    "lead-1",
    5,
    () => {
      seq += 1;
      return String(seq);
    }
  );
  const uniqueIds = new Set(parallel.map((row) => row.building_id));
  assert(uniqueIds.size === 1, "parallel trial provision returns one building id");
  assert(
    parallel.every((row) => row.already_provisioned || row.building_id === parallel[0]?.building_id),
    "parallel trial provision idempotent"
  );
  assert(trialStore.buildingIds.length === 1, "trial store keeps single building");

  const winStore: SimulatedWinWithTrialStore = {
    convertedBuildingIdByLead: {},
    trialBuildingIdByLead: { "lead-2": "750202" },
    buildingIds: ["750202"],
    isTrialByBuilding: { "750202": true },
  };
  const locks = new Map();
  const win = await simulateWinConvertWithTrial(winStore, locks, "lead-2", () => "800999");
  assert(win.from_trial === true && win.building_id === "750202", "win reuses trial building");
  assert(winStore.isTrialByBuilding["750202"] === false, "win clears is_trial flag");
  assert(winStore.buildingIds.length === 1, "win does not allocate duplicate building");

  const winStoreFresh: SimulatedWinWithTrialStore = {
    convertedBuildingIdByLead: {},
    trialBuildingIdByLead: {},
    buildingIds: [],
    isTrialByBuilding: {},
  };
  const winFresh = await simulateWinConvertWithTrial(
    winStoreFresh,
    new Map(),
    "lead-3",
    () => "800101"
  );
  assert(winFresh.from_trial === false && winFresh.building_id === "800101", "win without trial allocates new id");

  const rows: StatisticsFaultRow[] = [
    {
      created_at: new Date().toISOString(),
      fault_type: "דלת",
      elevator_name: "A",
      status: "פתוחה",
    },
    {
      created_at: new Date(Date.now() - 40 * 86400000).toISOString(),
      fault_type: "דלת",
      elevator_name: "B",
      status: "סגורה",
      closed_at: new Date().toISOString(),
    },
  ];
  const counts = computeStatisticsPeriodFaultCounts(rows, "30d");
  assert(counts.total === 1 && counts.open === 1 && counts.closed === 0, "period counts respect 30d window");
  assert(filterStatisticsRowsByElevatorName(rows, "A").length === 1, "elevator name filter");

  const inboxLabel = formatMasterFaultInboxBuildingLabel({
    building_name: "מגדלים",
    is_trial_building: true,
  });
  assert(inboxLabel.includes("ניסיון"), "inbox trial building label");

  assert(
    isSyntheticSalesTrialQaLead({
      clientName: "QA-TRIAL-PORTAL Test",
      email: "x@qa.forte.invalid",
      phone: "0500000000",
    }),
    "synthetic QA lead markers"
  );

  const qaLead = {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    trialBuildingId: null as string | null,
    clientName: "QA-TRIAL-PORTAL Test",
    email: "x@qa.forte.invalid",
    phone: "0500000000",
  };
  const prevEnabled = process.env[SALES_TRIAL_PORTAL_ENV_ENABLED];
  const prevAllowed = process.env[SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS];
  process.env[SALES_TRIAL_PORTAL_ENV_ENABLED] = "true";
  process.env[SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS] = qaLead.id;
  assert(canOpenSalesLeadTrialPortalForLead(qaLead), "can open trial when allowlisted QA lead");
  process.env[SALES_TRIAL_PORTAL_ENV_ENABLED] = "false";
  assert(!canOpenSalesLeadTrialPortalForLead(qaLead), "cannot open when feature flag off");
  if (prevEnabled === undefined) delete process.env[SALES_TRIAL_PORTAL_ENV_ENABLED];
  else process.env[SALES_TRIAL_PORTAL_ENV_ENABLED] = prevEnabled;
  if (prevAllowed === undefined) delete process.env[SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS];
  else process.env[SALES_TRIAL_PORTAL_ENV_ALLOWED_LEADS] = prevAllowed;

  console.log(`\nDone: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
