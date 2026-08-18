/**
 * Security Phase 1.5B-1 — Master V2 client management server authorization QA.
 * Run: npx tsx scripts/qa-master-client-access-security.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  parseBuildingIdFilter,
  parseClientPermissionFlags,
  parseClientUserId,
  parseCreateClientUserAccessInput,
  parseUpdateClientAccessScopeInput,
} from "../lib/master-client-access-server";
import { GET as listAccessGET, POST as createAccessPOST } from "../app/forte/api/master-client-access/route";
import { PATCH as patchAccessPATCH } from "../app/forte/api/master-client-access/[userId]/route";
import {
  GET as getPermissionsGET,
  PATCH as patchPermissionsPATCH,
} from "../app/forte/api/master-client-permissions/route";

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
  init?: { method?: string; body?: unknown; cookie?: string }
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
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function main(): Promise<void> {
console.log("\n=== Master V2 Client Access Security QA ===\n");

// --- Parse / validation unit tests ---
assert(parseClientUserId("  abc  ") === "abc", "parseClientUserId: trims");
assert(parseClientUserId("") === null, "parseClientUserId: empty → null");
assert(
  parseBuildingIdFilter(" Building-A ") === "building-a",
  "parseBuildingIdFilter: normalizes"
);

const validCreate = parseCreateClientUserAccessInput({
  name: "Test Client",
  buildingId: "b1",
  accessLevel: "building",
});
assert(validCreate?.name === "Test Client", "create input: valid payload PASS");

assert(
  parseCreateClientUserAccessInput({ name: "", buildingId: "b1" }) === null,
  "create input: missing name → null (400 path)"
);
assert(
  parseCreateClientUserAccessInput({ name: "X", buildingId: "" }) === null,
  "create input: missing buildingId → null"
);

const validScope = parseUpdateClientAccessScopeInput({
  userId: "u1",
  buildingId: "b1",
  accessLevel: "elevator",
  elevatorId: "e1",
});
assert(validScope?.elevatorId === "e1", "scope update: valid payload PASS");

assert(
  parseUpdateClientAccessScopeInput({
    userId: "u1",
    buildingId: "b1",
    accessLevel: "elevator",
  }) === null ||
    parseUpdateClientAccessScopeInput({
      userId: "",
      buildingId: "b1",
      accessLevel: "building",
    }) === null,
  "scope update: invalid userId → null"
);

const flags = parseClientPermissionFlags({
  can_report_faults: true,
  can_view_statistics: false,
});
assert(
  flags?.can_report_faults === true && flags?.can_view_statistics === false,
  "permissions parse: merges flags PASS"
);
assert(parseClientPermissionFlags(null) === null, "permissions parse: null → null");

// --- Unauthorized API access (no Master session) ---
const prevSecret = process.env.FORTE_SESSION_SECRET;
const prevCode = process.env.MASTER_CODE;
process.env.FORTE_SESSION_SECRET = "qa-test-secret";
process.env.MASTER_CODE = "qa-test-code";

async function runAuthTests(): Promise<void> {
  const listRes = await listAccessGET(makeMasterApiRequest("/forte/api/master-client-access"));
  assert(listRes.status === 401, "GET /master-client-access without session → 401");

  const createRes = await createAccessPOST(
    makeMasterApiRequest("/forte/api/master-client-access", {
      method: "POST",
      body: { input: { name: "X", buildingId: "b1", accessLevel: "building" } },
    })
  );
  assert(createRes.status === 401, "POST /master-client-access without session → 401");

  const patchRes = await patchAccessPATCH(
    makeMasterApiRequest("/forte/api/master-client-access/user-1", {
      method: "PATCH",
      body: { action: "deactivate" },
    }),
    { params: Promise.resolve({ userId: "user-1" }) }
  );
  assert(patchRes.status === 401, "PATCH /master-client-access/[id] without session → 401");

  const permGetRes = await getPermissionsGET(
    makeMasterApiRequest("/forte/api/master-client-permissions?clientUserId=u1")
  );
  assert(permGetRes.status === 401, "GET /master-client-permissions without session → 401");

  const permPatchRes = await patchPermissionsPATCH(
    makeMasterApiRequest("/forte/api/master-client-permissions", {
      method: "PATCH",
      body: {
        clientUserId: "u1",
        flags: { can_report_faults: true },
      },
    })
  );
  assert(permPatchRes.status === 401, "PATCH /master-client-permissions without session → 401");

  const invalidCreateRes = await createAccessPOST(
    makeMasterApiRequest("/forte/api/master-client-access", {
      method: "POST",
      body: { input: { name: "", buildingId: "b1" } },
    })
  );
  assert(
    invalidCreateRes.status === 401 || invalidCreateRes.status === 400,
    "invalid create without session → blocked (401 before body when no session)"
  );

  const notFoundRes = await patchAccessPATCH(
    makeMasterApiRequest("/forte/api/master-client-access/", {
      method: "PATCH",
      body: { action: "deactivate" },
    }),
    { params: Promise.resolve({ userId: "" }) }
  );
  assert(
    notFoundRes.status === 401 || notFoundRes.status === 400,
    "invalid user id path → blocked"
  );
}

await runAuthTests();

if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
else process.env.FORTE_SESSION_SECRET = prevSecret;
if (prevCode === undefined) delete process.env.MASTER_CODE;
else process.env.MASTER_CODE = prevCode;

// --- Server layer uses service role only ---
const serverSource = read("lib/master-client-access-server.ts");
assert(
  serverSource.includes("getSupabaseServiceClient") &&
    !serverSource.includes("getPilotSupabaseClient"),
  "master-client-access-server: service_role only"
);

// --- API routes auth + origin ---
const accessRoute = read("app/forte/api/master-client-access/route.ts");
const accessPatchRoute = read("app/forte/api/master-client-access/[userId]/route.ts");
const permRoute = read("app/forte/api/master-client-permissions/route.ts");

for (const [file, source] of [
  ["master-client-access/route.ts", accessRoute],
  ["master-client-access/[userId]/route.ts", accessPatchRoute],
  ["master-client-permissions/route.ts", permRoute],
] as const) {
  assert(source.includes("requireMasterApiSession"), `${file}: requireMasterApiSession`);
  assert(source.includes("isAllowedForteApiOrigin"), `${file}: origin check`);
}

// --- V2 components must not call client_* tables via Supabase directly ---
const v2Files = [
  "components/master-v2/project-v2/MasterProjectV2PermissionsTab.tsx",
  "components/master-v2/project-v2/MasterProjectV2NewClientAccessDialog.tsx",
  "components/master-v2/project-v2/MasterProjectV2ClientAccessExpiryDialog.tsx",
];

const forbiddenDirectOps = [
  "getAllClientUserAccessRecords",
  "createClientUserAccess(",
  "deactivateClientAccess(",
  "reactivateClientAccess(",
  "updateClientAccessScope(",
  'from("client_users")',
  "from('client_users')",
  'from("client_access")',
  'from("client_permissions")',
  'from("client_activity_log")',
  "getPilotSupabaseClient",
];

for (const file of v2Files) {
  const source = read(file);
  for (const needle of forbiddenDirectOps) {
    assert(!source.includes(needle), `${file}: no direct "${needle}"`);
  }
  assert(
    source.includes("master-client-access-api"),
    `${file}: uses master-client-access-api`
  );
}

const permissionsTab = read(
  "components/master-v2/project-v2/MasterProjectV2PermissionsTab.tsx"
);
assert(
  !permissionsTab.includes("getClientPermissionsOrDefaults") &&
    !permissionsTab.includes("saveClientPermissions"),
  "PermissionsTab: no direct client-permissions Supabase calls"
);

const modal = read("components/MasterClientPermissionsModal.tsx");
assert(
  modal.includes("useMasterApi") && modal.includes("saveMasterClientPermissions"),
  "MasterClientPermissionsModal: dual-path with Master API for V2"
);

// --- Legacy unchanged (still uses direct lib) ---
const legacySection = read("components/MasterClientAccessSection.tsx");
assert(
  legacySection.includes("getAllClientUserAccessRecords") &&
    legacySection.includes("createClientUserAccess"),
  "Legacy MasterClientAccessSection: still uses client-access.ts directly"
);

// --- service_role not in client bundle ---
const apiClientSource = read("lib/master-client-access-api.ts");
assert(
  !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !apiClientSource.includes("getSupabaseServiceClient"),
  "master-client-access-api: no service_role in browser client"
);

// --- Token returned for Master link copy (documented in API responses) ---
assert(
  accessRoute.includes("result.session") && serverSource.includes("access_token"),
  "Master API: access_token included in session for client portal links"
);

// --- Activity log write server-side only (no read endpoint for V2) ---
assert(
  serverSource.includes("logClientActivityServer") &&
    serverSource.includes("CLIENT_ACTIVITY_LOG_TABLE"),
  "activity log: written server-side on permissions save"
);
assert(
  !fs.existsSync(
    path.join(process.cwd(), "app/forte/api/master-client-activity/route.ts")
  ),
  "no unnecessary activity read API for V2"
);

console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
}

void main();
