/**
 * Security Phase 1 — static + unit QA for Client Portal server authorization.
 * Run: npx tsx scripts/qa-client-portal-security.ts
 */
import fs from "fs";
import path from "path";
import {
  assertRequestedBuildingMatchesToken,
  isElevatorAuthorizedForClientAccess,
} from "../lib/client-portal-api-auth";

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

console.log("\n=== Client Portal Security QA ===\n");

// --- Auth helper unit tests ---
assert(
  assertRequestedBuildingMatchesToken(undefined, "building-a") === null,
  "building mismatch: omitted buildingId → allowed"
);
assert(
  assertRequestedBuildingMatchesToken("building-a", "building-a") === null,
  "building mismatch: matching buildingId → allowed"
);
assert(
  assertRequestedBuildingMatchesToken("building-b", "building-a") !== null,
  "building mismatch: wrong buildingId → 403"
);

assert(
  isElevatorAuthorizedForClientAccess("e1", ["e1", "e2"], "building", null),
  "elevator auth: building-level access to authorized elevator"
);
assert(
  !isElevatorAuthorizedForClientAccess("e3", ["e1", "e2"], "building", null),
  "elevator auth: building-level rejects foreign elevator"
);
assert(
  isElevatorAuthorizedForClientAccess("e1", ["e1"], "elevator", "e1"),
  "elevator auth: locked elevator matches"
);
assert(
  !isElevatorAuthorizedForClientAccess("e2", ["e1", "e2"], "elevator", "e1"),
  "elevator auth: locked elevator rejects other elevator in same building"
);

// --- Portal components must not call Supabase directly ---
const portalFiles = [
  "components/ClientAccessPageContent.tsx",
  "components/ClientAccessReportForm.tsx",
  "components/ClientPortalStatisticsSection.tsx",
  "components/FeedbackForm.tsx",
];

const forbiddenInPortal = [
  "getPilotSupabaseClient",
  "getClientAccessByToken",
  "getAllDocuments",
  "getPilotFaultsForBuilding",
  "savePilotFeedback",
  "saveClientPortalFault",
  "from(\"client_users\")",
  "from('client_users')",
];

for (const file of portalFiles) {
  const source = read(file);
  for (const needle of forbiddenInPortal) {
    assert(
      !source.includes(needle),
      `${file}: no direct Supabase call "${needle}"`
    );
  }
  assert(
    source.includes("client-portal-api-client") ||
      file === "components/FeedbackForm.tsx",
    `${file}: uses client-portal-api-client (or FeedbackForm dual-path)`
  );
}

const pageContent = read("components/ClientAccessPageContent.tsx");
assert(
  pageContent.includes("fetchClientPortalBootstrap") &&
    !pageContent.includes("getClientPermissionsOrDefaults") &&
    !pageContent.includes("resolveClientPortalBuilding"),
  "ClientAccessPageContent: bootstrap via server API only"
);

const reportForm = read("components/ClientAccessReportForm.tsx");
assert(
  reportForm.includes("submitClientPortalFault") &&
    reportForm.includes("token: string"),
  "ClientAccessReportForm: fault submit via server API with token"
);

// --- API routes exist ---
const apiRoutes = [
  "app/forte/api/client/bootstrap/route.ts",
  "app/forte/api/client/faults/route.ts",
  "app/forte/api/client/feedback/route.ts",
  "app/forte/api/client/activity/route.ts",
  "app/forte/api/client/statistics/route.ts",
];

for (const route of apiRoutes) {
  assert(fs.existsSync(path.join(process.cwd(), route)), `${route} exists`);
  const source = read(route);
  assert(
    source.includes("requireClientPortalAuth"),
    `${route}: requireClientPortalAuth`
  );
  assert(
    source.includes("assertClientPortalOrigin"),
    `${route}: origin check`
  );
}

const faultsRoute = read("app/forte/api/client/faults/route.ts");
assert(
  faultsRoute.includes("assertRequestedBuildingMatchesToken"),
  "faults route: building mismatch guard"
);

// --- DTO minimization (no financial / internal fields in bootstrap type) ---
const dtoSource = read("lib/client-portal-dto.ts");
const forbiddenDtoFields = [
  "order_amount",
  "order_date",
  "payment_terms",
  "next_payment_date",
  "project_payments",
  "access_token",
  "internal",
];

for (const field of forbiddenDtoFields) {
  assert(!dtoSource.includes(field), `DTO: no sensitive field "${field}"`);
}

// Structural check on bootstrap shape (compile-time via DTO fields)
assert(
  dtoSource.includes("ClientPortalBuildingDto") &&
    dtoSource.includes("buildingCode") &&
    !dtoSource.includes("order_amount"),
  "Bootstrap DTO: building subset without financial fields"
);

// --- Server layer uses service role ---
const serverSource = read("lib/client-portal-server.ts");
assert(
  serverSource.includes("getSupabaseServiceClient") &&
    !serverSource.includes("getPilotSupabaseClient"),
  "client-portal-server: service_role only"
);

assert(
  serverSource.includes('.eq("visibility", "client")'),
  "documents: server filters visibility=client in SQL"
);

// --- Migration prepared but documented ---
const migrationPath = "supabase/migrations/034_client_portal_lockdown_rls.sql";
assert(fs.existsSync(path.join(process.cwd(), migrationPath)), "RLS migration 034 exists");
const migrationSql = read(migrationPath);
assert(
  migrationSql.includes("revoke all on table public.client_users") &&
    migrationSql.includes("pilot_faults") &&
    migrationSql.includes("do NOT run"),
  "RLS migration: revokes anon + deployment warning"
);
assert(
  !migrationSql.includes("buildings") ||
    migrationSql.includes("buildings / elevators remain open"),
  "RLS migration: buildings/elevators explicitly deferred"
);

// --- Master / project_payments untouched ---
assert(
  read("supabase/migrations/033_project_financial.sql").includes(
    "revoke all on table public.project_payments"
  ),
  "project_payments: existing anon revoke unchanged"
);

console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
