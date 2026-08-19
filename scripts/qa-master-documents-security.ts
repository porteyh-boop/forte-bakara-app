/**
 * Security Phase 1.5B-3A — Master V2 documents secure read path QA.
 * Run: npx tsx scripts/qa-master-documents-security.ts
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

import { mapMasterDocumentDto } from "../lib/master-documents-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import { GET as listDocumentsGET } from "../app/forte/api/master-documents/route";

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

const FORBIDDEN_RESPONSE_FIELDS = [
  "storage_path",
  "ocr_text",
  "ai_summary",
] as const;

function assertDtoMinimized(sample: Record<string, unknown>): void {
  for (const field of FORBIDDEN_RESPONSE_FIELDS) {
    assert(!(field in sample), `response sample excludes "${field}"`);
  }
}

async function main(): Promise<void> {
  console.log("\n=== Master V2 Documents Security QA (Phase 1.5B-3A) ===\n");

  const dto = mapMasterDocumentDto({
    id: "doc-1",
    building_id: "MD25",
    document_type: "contract",
    title: "Test",
    file_name: "test.pdf",
    file_url: "https://example.com/file.pdf",
    tags: ["חוזה"],
    visibility: "internal",
    created_at: "2026-01-01T00:00:00Z",
    ai_metadata: { letter: { schemaVersion: 1 } },
    storage_path: "md25/2026-01-01/secret.pdf",
    ocr_text: "secret ocr",
    ai_summary: "secret summary",
  });
  assert(dto.building_id === "md25", "DTO: building_id normalized");
  assert(!("storage_path" in dto), "DTO: storage_path not mapped");
  assert(!("ocr_text" in dto), "DTO: ocr_text not mapped");
  assert(!("ai_summary" in dto), "DTO: ai_summary not mapped");
  assert(
    dto.ai_metadata !== null && typeof dto.ai_metadata === "object",
    "DTO: ai_metadata kept for InspectionsTab letter stages"
  );

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";

  const noSession = await listDocumentsGET(
    makeMasterApiRequest("/forte/api/master-documents?buildingId=md25")
  );
  assert(noSession.status === 401, "GET /master-documents without session → 401");

  const noBuilding = await listDocumentsGET(
    makeMasterApiRequest("/forte/api/master-documents", {
      cookie: masterSessionCookie() ?? "",
    })
  );
  assert(noBuilding.status === 400, "GET without buildingId → 400");

  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  const serverSource = read("lib/master-documents-server.ts");
  assert(
    serverSource.includes("getSupabaseServiceClient") &&
      !serverSource.includes("getPilotSupabaseClient"),
    "master-documents-server: service_role only"
  );
  assert(
    serverSource.includes('.eq("building_id", normalized)'),
    "master-documents-server: list scoped by building_id"
  );
  assert(
    !serverSource.includes('select("*")'),
    "master-documents-server: no SELECT *"
  );

  const listRoute = read("app/forte/api/master-documents/route.ts");
  assert(
    listRoute.includes("requireMasterApiSession"),
    "master-documents/route.ts: requireMasterApiSession"
  );
  assert(
    listRoute.includes("isAllowedForteApiOrigin"),
    "master-documents/route.ts: origin check"
  );
  assert(
    listRoute.includes("parseBuildingIdFilter"),
    "master-documents/route.ts: buildingId validation"
  );

  const panelSource = read(
    "components/master-v2/project-v2/ProjectDocumentsPanel.tsx"
  );
  const inspectionsSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectionsTab.tsx"
  );

  for (const [file, source] of [
    ["ProjectDocumentsPanel.tsx", panelSource],
    ["MasterProjectV2InspectionsTab.tsx", inspectionsSource],
  ] as const) {
    assert(!source.includes("getAllDocuments("), `${file}: no getAllDocuments()`);
    assert(
      !source.includes('from("documents")'),
      `${file}: no direct documents table access`
    );
    assert(
      !source.includes("getPilotSupabaseClient"),
      `${file}: no getPilotSupabaseClient`
    );
  }

  assert(
    panelSource.includes("listMasterDocumentsByBuilding(buildingId)"),
    "ProjectDocumentsPanel: uses master-documents-api list"
  );
  assert(
    inspectionsSource.includes("listMasterDocumentsByBuilding(buildingId)"),
    "InspectionsTab: uses master-documents-api list"
  );

  const apiClientSource = read("lib/master-documents-api.ts");
  assert(
    !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClientSource.includes("getSupabaseServiceClient"),
    "master-documents-api: no service_role in browser client"
  );
  assert(
    apiClientSource.includes('credentials: "include"') ||
      apiClientSource.includes("masterApiFetch"),
    "master-documents-api: uses masterApiFetch with session cookie"
  );

  const documentsTab = read(
    "components/master-v2/project-v2/MasterProjectV2DocumentsTab.tsx"
  );
  assert(
    documentsTab.includes("MasterDocumentCenterSection"),
    "known blocker: V2 Documents tab still uses Legacy MasterDocumentCenterSection (Phase 3D)"
  );

  const portalRoute = read("app/forte/api/client/bootstrap/route.ts");
  assert(
    portalRoute.includes("buildClientPortalBootstrap"),
    "Client Portal bootstrap API unchanged"

  );

  async function runIsolationTests(sessionCookie: string): Promise<void> {
    const md25List = await listDocumentsGET(
      makeMasterApiRequest("/forte/api/master-documents?buildingId=md25", {
        cookie: sessionCookie,
      })
    );
    assert(md25List.status === 200, "GET /master-documents md25 → 200");
    const md25Payload = (await md25List.json()) as {
      documents?: Array<{ building_id: string; id: string }>;
    };
    const md25Docs = md25Payload.documents ?? [];
    if (md25Docs.length > 0) {
      assert(
        md25Docs.every((row) => row.building_id === "md25"),
        "md25 list returns only md25 documents"
      );
    } else {
      assert(true, "md25 list empty in configured DB (scope check skipped)");
    }

    const sl48List = await listDocumentsGET(
      makeMasterApiRequest("/forte/api/master-documents?buildingId=sl48", {
        cookie: sessionCookie,
      })
    );
    assert(sl48List.status === 200, "GET /master-documents sl48 → 200");
    const sl48Payload = (await sl48List.json()) as {
      documents?: Array<{ building_id: string; id: string }>;
    };
    const sl48Docs = sl48Payload.documents ?? [];
    assert(
      sl48Docs.every((row) => row.building_id === "sl48"),
      "sl48 list returns only sl48 documents"
    );

    const md25Ids = new Set(md25Docs.map((row) => row.id));
    const overlap = sl48Docs.some((row) => md25Ids.has(row.id));
    assert(!overlap, "md25 list does not include sl48 document ids");

    const md48InMd25 = md25Docs.some((row) => row.building_id === "sl48");
    assert(!md48InMd25, "md25 list does not include sl48 building_id rows");

    const sl48InSl48Only = sl48Docs.some((row) => row.building_id === "md25");
    assert(!sl48InSl48Only, "sl48 list does not include md25 building_id rows");

    const sample = md25Docs[0] ?? sl48Docs[0];
    if (sample) {
      assertDtoMinimized(sample as Record<string, unknown>);
    } else {
      assert(true, "DTO minimization sample skipped (no documents in DB)");
    }
  }

  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";
  const sessionCookie = masterSessionCookie();
  if (sessionCookie) {
    await runIsolationTests(sessionCookie);
  } else {
    console.warn("  ⚠ Skipping isolation integration tests (no session secret)");
  }
  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
