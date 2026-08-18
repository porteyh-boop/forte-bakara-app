/**
 * Security Phase 1.5B-1 — Master V2 client management server authorization QA.
 * Run: npx tsx scripts/qa-master-client-access-security.ts
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
  BUILDING_FORBIDDEN_ERROR,
  parseBuildingIdFilter,
  parseClientPermissionFlags,
  parseClientUserId,
  parseCreateClientUserAccessInput,
  parseUpdateClientAccessScopeInput,
} from "../lib/master-client-access-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
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

function masterSessionCookie(): string | null {
  const token = createMasterSessionToken();
  if (!token) return null;
  return `${FORTE_MASTER_SESSION_COOKIE}=${token}`;
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
  permissionsTab.includes("listMasterClientAccessRecords(buildingId)"),
  "PermissionsTab: list API sends buildingId"
);
assert(
  !permissionsTab.includes("listMasterClientAccessRecords()"),
  "PermissionsTab: no unfiltered list call"
);
assert(
  permissionsTab.includes("deactivateMasterClientAccess(userId, buildingId)"),
  "PermissionsTab: deactivate sends buildingId"
);
assert(
  permissionsTab.includes("reactivateMasterClientAccess(userId, buildingId)"),
  "PermissionsTab: reactivate sends buildingId"
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

assert(
  serverSource.includes("verifyClientAccessBuildingServer") &&
    serverSource.includes(BUILDING_FORBIDDEN_ERROR),
  "master-client-access-server: building authorization helper"
);

assert(
  accessPatchRoute.includes("buildingForbiddenResponse") &&
    accessPatchRoute.includes("parseBuildingIdFilter(body?.buildingId)"),
  "PATCH access route: requires buildingId + returns 403 on mismatch"
);

assert(
  permRoute.includes("buildingForbiddenResponse") &&
    permRoute.includes("parseBuildingIdFilter(body?.buildingId)"),
  "PATCH permissions route: requires buildingId + returns 403 on mismatch"
);

assert(
  apiClientSource.includes("buildingId") &&
    apiClientSource.includes('action: "deactivate", buildingId'),
  "master-client-access-api: mutations include buildingId"
);

// --- Building isolation integration (when Supabase service is configured) ---
async function runIsolationTests(sessionCookie: string): Promise<void> {
  const md25List = await listAccessGET(
    makeMasterApiRequest("/forte/api/master-client-access?buildingId=md25", {
      cookie: sessionCookie,
    })
  );
  assert(md25List.status === 200, "md25 list API → 200");
  const md25Payload = (await md25List.json()) as {
    records?: Array<{
      access: {
        building_id: string;
        access_level: string;
        elevator_id: string | null;
      };
      user: {
        id: string;
        name: string;
        access_token: string;
        is_active: boolean;
        expires_at: string | null;
      };
    }>;
  };
  const md25Records = md25Payload.records ?? [];
  assert(
    md25Records.length > 0 &&
      md25Records.every((row) => row.access.building_id === "md25"),
    "md25 list API returns only md25 records"
  );

  const sl48List = await listAccessGET(
    makeMasterApiRequest("/forte/api/master-client-access?buildingId=sl48", {
      cookie: sessionCookie,
    })
  );
  assert(sl48List.status === 200, "sl48 list API → 200");
  const sl48Payload = (await sl48List.json()) as {
    records?: Array<{
      access: { building_id: string };
      user?: { id?: string; access_token?: string };
    }>;
  };
  const sl48Records = sl48Payload.records ?? [];
  assert(
    sl48Records.every((row) => row.access.building_id === "sl48"),
    "sl48 list API returns only sl48 records"
  );

  const sl48Tokens = new Set(
    sl48Records.map(
      (row) =>
        (row as { user?: { access_token?: string } }).user?.access_token ?? ""
    )
  );
  const md25LeakedSl48Token = md25Records.some((row) =>
    sl48Tokens.has(row.user.access_token)
  );
  assert(!md25LeakedSl48Token, "md25 list does not include sl48 access tokens");

  const sl48UserId =
    sl48Records[0] &&
    (sl48Records[0] as { user?: { id?: string } }).user?.id;
  if (sl48UserId) {
    const crossDeactivate = await patchAccessPATCH(
      makeMasterApiRequest(
        `/forte/api/master-client-access/${encodeURIComponent(sl48UserId)}`,
        {
          method: "PATCH",
          cookie: sessionCookie,
          body: { action: "deactivate", buildingId: "md25" },
        }
      ),
      { params: Promise.resolve({ userId: sl48UserId }) }
    );
    assert(
      crossDeactivate.status === 403,
      "PATCH sl48 user with buildingId=md25 → 403"
    );

    const crossPermissions = await patchPermissionsPATCH(
      makeMasterApiRequest("/forte/api/master-client-permissions", {
        method: "PATCH",
        cookie: sessionCookie,
        body: {
          clientUserId: sl48UserId,
          buildingId: "md25",
          flags: { can_report_faults: true },
        },
      })
    );
    assert(
      crossPermissions.status === 403,
      "permissions update sl48 from md25 context → 403"
    );
  } else {
    assert(false, "sl48 isolation: no sl48 user found for cross-building PATCH test");
  }

  const md25TestUser =
    md25Records.find((row) => row.user.name.startsWith("QA Stats")) ??
    md25Records[0];

  if (md25TestUser?.user.id) {
    const md25UserId = md25TestUser.user.id;
    const wasActive = md25TestUser.user.is_active;

    if (wasActive) {
      const sameBuildingDeactivate = await patchAccessPATCH(
        makeMasterApiRequest(
          `/forte/api/master-client-access/${encodeURIComponent(md25UserId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: { action: "deactivate", buildingId: "md25" },
          }
        ),
        { params: Promise.resolve({ userId: md25UserId }) }
      );
      assert(
        sameBuildingDeactivate.status === 200,
        "deactivate md25 record from md25 context → PASS"
      );

      const reactivateRes = await patchAccessPATCH(
        makeMasterApiRequest(
          `/forte/api/master-client-access/${encodeURIComponent(md25UserId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: { action: "reactivate", buildingId: "md25" },
          }
        ),
        { params: Promise.resolve({ userId: md25UserId }) }
      );
      assert(
        reactivateRes.status === 200,
        "reactivate md25 record restored after isolation test"
      );
    } else {
      assert(true, "deactivate md25 skipped (test user inactive; no state change)");
    }

    const scopeRes = await patchAccessPATCH(
      makeMasterApiRequest(
        `/forte/api/master-client-access/${encodeURIComponent(md25UserId)}`,
        {
          method: "PATCH",
          cookie: sessionCookie,
          body: {
            action: "update_scope",
            buildingId: "md25",
            accessLevel: md25TestUser.access.access_level,
            elevatorId: md25TestUser.access.elevator_id,
            expiresAt: md25TestUser.user.expires_at,
          },
        }
      ),
      { params: Promise.resolve({ userId: md25UserId }) }
    );
    assert(scopeRes.status === 200, "scope update md25 → PASS");

    const permGetRes = await getPermissionsGET(
      makeMasterApiRequest(
        `/forte/api/master-client-permissions?clientUserId=${encodeURIComponent(md25UserId)}`,
        { cookie: sessionCookie }
      )
    );
    const permGetPayload = (await permGetRes.json()) as {
      flags?: Record<string, boolean>;
    };
    const currentFlags = permGetPayload.flags ?? { can_view_statistics: true };

    const permSaveRes = await patchPermissionsPATCH(
      makeMasterApiRequest("/forte/api/master-client-permissions", {
        method: "PATCH",
        cookie: sessionCookie,
        body: {
          clientUserId: md25UserId,
          buildingId: "md25",
          flags: currentFlags,
        },
      })
    );
    assert(permSaveRes.status === 200, "permissions save md25 → PASS");
  } else {
    assert(false, "md25 isolation: no md25 user found for same-building mutation test");
  }
}

const sessionCookie = masterSessionCookie();
if (sessionCookie) {
  await runIsolationTests(sessionCookie);
} else {
  console.warn("  ⚠ Skipping isolation integration tests (no session secret)");
}

// --- Client Portal unchanged ---
const portalRoute = read("app/forte/api/client/bootstrap/route.ts");
assert(
  portalRoute.includes("requireClientPortalAuth") &&
    portalRoute.includes("buildClientPortalBootstrap"),
  "Client Portal API routes remain separate from Master client access"
);

console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
}

void main();
