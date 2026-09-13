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
  parseSalesLeadTrialProvisionBody,
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

  const parsedOne = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: " א ", floorsCount: 10 }],
  });
  assert(
    parsedOne.ok && parsedOne.input.elevators[0]?.name === "א",
    "parse provision trims elevator name"
  );

  const parsedTwo = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [
      { name: "מעלית נוסעים", floorsCount: 18 },
      { name: "מעלית שירות", floorsCount: 20 },
    ],
  });
  assert(
    parsedTwo.ok &&
      parsedTwo.input.elevators.length === 2 &&
      parsedTwo.input.elevators[0]?.floorsCount === 18 &&
      parsedTwo.input.elevators[1]?.floorsCount === 20,
    "parse two elevators with distinct floorsCount"
  );

  assert(
    parseSalesLeadTrialProvisionInput({ expiresAt: "", elevators: [{ name: "a", floorsCount: 1 }] }) ===
      null,
    "parse provision rejects empty expiry"
  );

  const missingElevators = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [],
  });
  assert(
    !missingElevators.ok && missingElevators.error === "missing_elevators",
    "missing elevators array rejected"
  );

  const zeroFloors = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: "א", floorsCount: 0 }],
  });
  assert(!zeroFloors.ok && zeroFloors.error === "invalid_floors_count", "floorsCount 0 blocked");

  const negativeFloors = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: "א", floorsCount: -3 }],
  });
  assert(
    !negativeFloors.ok && negativeFloors.error === "invalid_floors_count",
    "negative floorsCount blocked"
  );

  const emptyFloors = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: "א", floorsCount: "" }],
  });
  assert(!emptyFloors.ok && emptyFloors.error === "invalid_floors_count", "empty floorsCount blocked");

  const nonIntegerFloors = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: "א", floorsCount: 1.5 }],
  });
  assert(
    !nonIntegerFloors.ok && nonIntegerFloors.error === "invalid_floors_count",
    "non-integer floorsCount blocked"
  );

  const emptyName = parseSalesLeadTrialProvisionBody({
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    elevators: [{ name: "  ", floorsCount: 5 }],
  });
  assert(!emptyName.ok && emptyName.error === "invalid_elevator_name", "empty elevator name blocked");

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

  const regularLead = {
    trialBuildingId: null as string | null,
    buildingName: "בניין לדוגמה",
  };
  assert(
    canOpenSalesLeadTrialPortalForLead(regularLead),
    "can open trial for regular lead with building name"
  );
  assert(
    !canOpenSalesLeadTrialPortalForLead({
      trialBuildingId: "750101",
      buildingName: "בניין לדוגמה",
    }),
    "cannot open when trial building already exists"
  );
  assert(
    !canOpenSalesLeadTrialPortalForLead({
      trialBuildingId: null,
      buildingName: "",
    }),
    "cannot open without building name"
  );

  console.log(`\nDone: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

void main();
