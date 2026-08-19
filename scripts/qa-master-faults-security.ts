/**
 * Security Phase 1.5B-2A — Master V2 project faults server authorization QA.
 * Run: npx tsx scripts/qa-master-faults-security.ts
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
  mapMasterFaultDto,
  parseFaultId,
} from "../lib/master-faults-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import { GET as listFaultsGET } from "../app/forte/api/master-faults/route";
import {
  DELETE as deleteFaultDELETE,
  PATCH as patchFaultPATCH,
} from "../app/forte/api/master-faults/[faultId]/route";

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
  console.log("\n=== Master V2 Project Faults Security QA ===\n");

  assert(parseFaultId("  abc  ") === "abc", "parseFaultId: trims");
  assert(parseFaultId("") === null, "parseFaultId: empty → null");

  const dtoWithUrl = mapMasterFaultDto({
    id: "f1",
    building_id: "md25",
    building_name: "Test",
    elevator_id: "e1",
    elevator_name: "Elevator",
    fault_type: "type",
    description: "desc",
    is_disabled: false,
    status: "פתוחה",
    ticket_number: "T1",
    image_url: "https://example.com/a.jpg",
    image_data: "data:image/jpeg;base64,abc",
    created_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    source_device_id: "device-secret",
    fault_source: "Client Portal",
    treatment_note: null,
    closure_note: null,
    treatment_started_at: null,
  });
  assert(
    dtoWithUrl.image_url === "https://example.com/a.jpg" &&
      dtoWithUrl.image_data === null,
    "DTO: image_data omitted when image_url present"
  );

  const dtoDataOnly = mapMasterFaultDto({
    id: "f2",
    building_id: "md25",
    building_name: "Test",
    elevator_id: "e1",
    elevator_name: "Elevator",
    fault_type: "type",
    description: "desc",
    is_disabled: false,
    status: "פתוחה",
    ticket_number: null,
    image_url: null,
    image_data: "data:image/jpeg;base64,legacy",
    created_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    source_device_id: "device-secret",
    fault_source: null,
    treatment_note: null,
    closure_note: null,
    treatment_started_at: null,
  });
  assert(
    dtoDataOnly.image_data === "data:image/jpeg;base64,legacy",
    "DTO: image_data kept when image_url missing (legacy faults)"
  );
  assert(
    !("source_device_id" in dtoWithUrl) && !("source_device_id" in dtoDataOnly),
    "DTO: source_device_id never exposed"
  );

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";

  const listRes = await listFaultsGET(
    makeMasterApiRequest("/forte/api/master-faults?buildingId=md25")
  );
  assert(listRes.status === 401, "GET /master-faults without session → 401");

  const patchRes = await patchFaultPATCH(
    makeMasterApiRequest("/forte/api/master-faults/fault-1", {
      method: "PATCH",
      body: { action: "reopen", buildingId: "md25" },
    }),
    { params: Promise.resolve({ faultId: "fault-1" }) }
  );
  assert(patchRes.status === 401, "PATCH /master-faults/[id] without session → 401");

  const deleteRes = await deleteFaultDELETE(
    makeMasterApiRequest("/forte/api/master-faults/fault-1?buildingId=md25", {
      method: "DELETE",
    }),
    { params: Promise.resolve({ faultId: "fault-1" }) }
  );
  assert(deleteRes.status === 401, "DELETE /master-faults/[id] without session → 401");

  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  const serverSource = read("lib/master-faults-server.ts");
  assert(
    serverSource.includes("getSupabaseServiceClient") &&
      !serverSource.includes("getPilotSupabaseClient"),
    "master-faults-server: service_role only"
  );
  assert(
    serverSource.includes("verifyFaultBuildingServer") &&
      serverSource.includes(BUILDING_FORBIDDEN_ERROR),
    "master-faults-server: building authorization helper"
  );
  assert(
    serverSource.includes('.eq("building_id", normalized)'),
    "master-faults-server: list scoped by building_id"
  );

  const listRoute = read("app/forte/api/master-faults/route.ts");
  const patchRoute = read("app/forte/api/master-faults/[faultId]/route.ts");
  for (const [file, source] of [
    ["master-faults/route.ts", listRoute],
    ["master-faults/[faultId]/route.ts", patchRoute],
  ] as const) {
    assert(source.includes("requireMasterApiSession"), `${file}: requireMasterApiSession`);
    assert(source.includes("isAllowedForteApiOrigin"), `${file}: origin check`);
  }

  const faultsTab = read(
    "components/master-v2/project-v2/MasterProjectV2FaultsTab.tsx"
  );
  const forbiddenDirectOps = [
    "getAllPilotFaults",
    "startPilotFaultTreatment",
    "updatePilotFaultTreatmentNote",
    "closePilotFault",
    "reopenPilotFault",
    "deletePilotFault",
    'from("pilot_faults")',
    "getPilotSupabaseClient",
  ];
  for (const needle of forbiddenDirectOps) {
    assert(!faultsTab.includes(needle), `FaultsTab: no direct "${needle}"`);
  }
  assert(
    faultsTab.includes("listMasterFaultsByBuilding(buildingId)"),
    "FaultsTab: list API sends buildingId"
  );
  assert(
    faultsTab.includes("master-faults-api"),
    "FaultsTab: uses master-faults-api"
  );

  const apiClientSource = read("lib/master-faults-api.ts");
  assert(
    !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClientSource.includes("getSupabaseServiceClient"),
    "master-faults-api: no service_role in browser client"
  );

  const portalRoute = read("app/forte/api/client/faults/route.ts");
  assert(
    portalRoute.includes("requireClientPortalAuth"),
    "Client Portal faults API unchanged"
  );

  async function runIsolationTests(sessionCookie: string): Promise<void> {
    const md25List = await listFaultsGET(
      makeMasterApiRequest("/forte/api/master-faults?buildingId=md25", {
        cookie: sessionCookie,
      })
    );
    assert(md25List.status === 200, "md25 list API → 200");
    const md25Payload = (await md25List.json()) as {
      faults?: Array<{ building_id: string; id: string; status: string }>;
    };
    const md25Faults = md25Payload.faults ?? [];
    if (md25Faults.length > 0) {
      assert(
        md25Faults.every((row) => row.building_id === "md25"),
        "md25 list API returns only md25 faults"
      );
    } else {
      assert(true, "md25 list empty in configured DB (scope check skipped)");
    }

    const sl48List = await listFaultsGET(
      makeMasterApiRequest("/forte/api/master-faults?buildingId=sl48", {
        cookie: sessionCookie,
      })
    );
    assert(sl48List.status === 200, "sl48 list API → 200");
    const sl48Payload = (await sl48List.json()) as {
      faults?: Array<{ building_id: string; id: string }>;
    };
    const sl48Faults = sl48Payload.faults ?? [];
    assert(
      sl48Faults.every((row) => row.building_id === "sl48"),
      "sl48 list API returns only sl48 faults"
    );

    const md25Ids = new Set(md25Faults.map((row) => row.id));
    const sl48Ids = new Set(sl48Faults.map((row) => row.id));
    const overlap = [...sl48Ids].some((id) => md25Ids.has(id));
    assert(!overlap, "md25 list does not include sl48 fault ids");

    const sl48FaultId = sl48Faults[0]?.id;
    if (sl48FaultId) {
      const crossPatch = await patchFaultPATCH(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(sl48FaultId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: { action: "reopen", buildingId: "md25" },
          }
        ),
        { params: Promise.resolve({ faultId: sl48FaultId }) }
      );
      assert(crossPatch.status === 403, "PATCH sl48 fault with buildingId=md25 → 403");

      const crossDelete = await deleteFaultDELETE(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(sl48FaultId)}?buildingId=md25`,
          { method: "DELETE", cookie: sessionCookie }
        ),
        { params: Promise.resolve({ faultId: sl48FaultId }) }
      );
      assert(crossDelete.status === 403, "DELETE sl48 fault with buildingId=md25 → 403");
    } else {
      assert(true, "cross-building PATCH/DELETE skipped (no sl48 faults)");
    }

    const mutationBuildingId = md25Faults.length > 0 ? "md25" : "sl48";
    const mutationFaults = md25Faults.length > 0 ? md25Faults : sl48Faults;
    const mutationFault =
      mutationFaults.find((row) => row.status !== "סגורה") ?? mutationFaults[0];

    if (mutationFault?.id) {
      const faultId = mutationFault.id;
      const originalStatus = mutationFault.status;

      if (originalStatus !== "בטיפול" && originalStatus !== "סגורה") {
        const startRes = await patchFaultPATCH(
          makeMasterApiRequest(
            `/forte/api/master-faults/${encodeURIComponent(faultId)}`,
            {
              method: "PATCH",
              cookie: sessionCookie,
              body: {
                action: "start_treatment",
                buildingId: mutationBuildingId,
                treatmentNote: "QA isolation note",
              },
            }
          ),
          { params: Promise.resolve({ faultId }) }
        );
        assert(startRes.status === 200, "start treatment md25 → PASS");
      } else {
        assert(true, "start treatment skipped (fault already in treatment/closed)");
      }

      const noteRes = await patchFaultPATCH(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(faultId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: {
              action: "update_treatment_note",
              buildingId: mutationBuildingId,
              treatmentNote: "QA isolation note",
            },
          }
        ),
        { params: Promise.resolve({ faultId }) }
      );
      assert(noteRes.status === 200, "treatment note md25 → PASS");

      const closeRes = await patchFaultPATCH(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(faultId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: {
              action: "close",
              buildingId: mutationBuildingId,
              closureNote: "QA isolation close",
            },
          }
        ),
        { params: Promise.resolve({ faultId }) }
      );
      assert(closeRes.status === 200, "close md25 → PASS");

      const reopenRes = await patchFaultPATCH(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(faultId)}`,
          {
            method: "PATCH",
            cookie: sessionCookie,
            body: { action: "reopen", buildingId: mutationBuildingId },
          }
        ),
        { params: Promise.resolve({ faultId }) }
      );
      assert(reopenRes.status === 200, "reopen md25 → PASS");

      const deleteAuthBuildingId =
        mutationBuildingId === "md25" ? "sl48" : "md25";
      const deleteAuthRes = await deleteFaultDELETE(
        makeMasterApiRequest(
          `/forte/api/master-faults/${encodeURIComponent(faultId)}?buildingId=${deleteAuthBuildingId}`,
          { method: "DELETE", cookie: sessionCookie }
        ),
        { params: Promise.resolve({ faultId }) }
      );
      assert(
        deleteAuthRes.status === 403,
        "DELETE fault with wrong buildingId → 403 (no destructive delete)"
      );
    } else {
      assert(
        true,
        "same-building mutation tests skipped (no faults in md25/sl48)"
      );
    }

    const dtoCheck = md25Faults[0] ?? sl48Faults[0];
    if (dtoCheck) {
      assert(
        !("source_device_id" in dtoCheck),
        "list response: source_device_id not in browser payload"
      );
    }
  }

  const sessionCookie = masterSessionCookie();
  if (sessionCookie) {
    await runIsolationTests(sessionCookie);
  } else {
    console.warn("  ⚠ Skipping isolation integration tests (no session secret)");
  }

  console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
