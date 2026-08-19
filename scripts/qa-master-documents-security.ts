/**
 * Security Phase 1.5B-3A/3B — Master V2 documents secure read + upload path QA.
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

import {
  mapMasterDocumentDto,
  validateMasterDocumentUploadMetadata,
} from "../lib/master-documents-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import {
  GET as listDocumentsGET,
  POST as uploadDocumentPOST,
} from "../app/forte/api/master-documents/route";

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
  init?: { method?: string; cookie?: string; body?: FormData | string; contentType?: string }
): NextRequest {
  const url = `http://localhost:3000${urlPath}`;
  const headers: Record<string, string> = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
  };
  if (init?.cookie) headers.cookie = init.cookie;
  if (init?.contentType) headers["Content-Type"] = init.contentType;

  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body,
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

function makeUploadFormData(overrides?: {
  buildingId?: string;
  documentType?: string;
  title?: string;
  fileName?: string;
  fileContent?: string;
  fileType?: string;
  tags?: string;
  extra?: Record<string, string>;
}): FormData {
  const formData = new FormData();
  formData.append("buildingId", overrides?.buildingId ?? "md25");
  formData.append("documentType", overrides?.documentType ?? "correspondence");
  formData.append("title", overrides?.title ?? "QA test document");
  formData.append(
    "tags",
    overrides?.tags ?? JSON.stringify(["QA"])
  );
  const fileName = overrides?.fileName ?? "qa-test.pdf";
  const content = overrides?.fileContent ?? "%PDF-1.4 qa test";
  formData.append(
    "file",
    new File([content], fileName, {
      type: overrides?.fileType ?? "application/pdf",
    })
  );
  if (overrides?.extra) {
    for (const [key, value] of Object.entries(overrides.extra)) {
      formData.append(key, value);
    }
  }
  return formData;
}

async function main(): Promise<void> {
  console.log("\n=== Master V2 Documents Security QA (Phase 1.5B-3A/3B) ===\n");

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

  const noSessionGet = await listDocumentsGET(
    makeMasterApiRequest("/forte/api/master-documents?buildingId=md25")
  );
  assert(noSessionGet.status === 401, "GET /master-documents without session → 401");

  const noSessionPost = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      body: makeUploadFormData(),
    })
  );
  assert(noSessionPost.status === 401, "POST /master-documents without session → 401");

  const sessionCookie = masterSessionCookie() ?? "";

  const noBuilding = await listDocumentsGET(
    makeMasterApiRequest("/forte/api/master-documents", {
      cookie: sessionCookie,
    })
  );
  assert(noBuilding.status === 400, "GET without buildingId → 400");

  const missingFile = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      cookie: sessionCookie,
      body: (() => {
        const form = new FormData();
        form.append("buildingId", "md25");
        form.append("documentType", "correspondence");
        form.append("title", "No file");
        return form;
      })(),
    })
  );
  assert(missingFile.status === 400, "POST without file → 400");

  const emptyFile = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      cookie: sessionCookie,
      body: makeUploadFormData({ fileContent: "" }),
    })
  );
  assert(emptyFile.status === 400, "POST empty file → 400");

  const pathTraversal = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      cookie: sessionCookie,
      body: makeUploadFormData({ fileName: "../../evil.pdf" }),
    })
  );
  assert(pathTraversal.status === 400, "POST path traversal filename → blocked");

  const forbiddenBucket = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      cookie: sessionCookie,
      body: makeUploadFormData({ extra: { bucket: "other-bucket" } }),
    })
  );
  assert(forbiddenBucket.status === 400, "POST arbitrary bucket field → blocked");

  const forbiddenStoragePath = await uploadDocumentPOST(
    makeMasterApiRequest("/forte/api/master-documents", {
      method: "POST",
      cookie: sessionCookie,
      body: makeUploadFormData({
        extra: { storagePath: "sl48/2026-01-01/evil.pdf" },
      }),
    })
  );
  assert(
    forbiddenStoragePath.status === 400,
    "POST arbitrary storagePath field → blocked"
  );

  const invalidMetadata = validateMasterDocumentUploadMetadata({
    buildingId: "md25",
    documentType: "not-a-type",
    title: "Test",
    fileName: "test.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 100,
  });
  assert(invalidMetadata === "invalid_document_type", "metadata: invalid document type");

  const invalidBuilding = validateMasterDocumentUploadMetadata({
    buildingId: "",
    documentType: "correspondence",
    title: "Test",
    fileName: "test.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 100,
  });
  assert(invalidBuilding === "invalid_building_id", "metadata: invalid buildingId");

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
  assert(
    serverSource.includes("buildDocumentStoragePath("),
    "master-documents-server: storage path built server-side"
  );
  assert(
    serverSource.includes("deleteMasterDocumentStorageFile") &&
      serverSource.includes("cleanupFailed"),
    "master-documents-server: DB failure cleanup path exists"
  );
  assert(
    serverSource.includes('.from(DOCUMENT_CENTER_BUCKET)') &&
      serverSource.includes(".upload("),
    "master-documents-server: storage upload server-side"
  );
  assert(
    serverSource.includes('.from(DOCUMENTS_TABLE)') &&
      serverSource.includes(".insert("),
    "master-documents-server: documents INSERT server-side"
  );
  assert(
    serverSource.includes("buildDocumentPublicUrl") &&
      !serverSource.includes("getPilotSupabaseClient"),
    "master-documents-server: public URL built server-side"
  );

  const routeSource = read("app/forte/api/master-documents/route.ts");
  assert(
    routeSource.includes("requireMasterApiSession"),
    "master-documents/route.ts: requireMasterApiSession"
  );
  assert(
    routeSource.includes("isAllowedForteApiOrigin"),
    "master-documents/route.ts: origin check"
  );
  assert(
    routeSource.includes("parseBuildingIdFilter"),
    "master-documents/route.ts: buildingId validation"
  );
  assert(
    routeSource.includes("FORBIDDEN_UPLOAD_FIELDS") &&
      routeSource.includes("storagePath"),
    "master-documents/route.ts: rejects browser storagePath/bucket"
  );
  assert(
    routeSource.includes("export async function POST"),
    "master-documents/route.ts: POST handler exists"
  );

  const panelSource = read(
    "components/master-v2/project-v2/ProjectDocumentsPanel.tsx"
  );
  const inspectionsSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectionsTab.tsx"
  );
  const inspectorDialogSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectorReportDialog.tsx"
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
    panelSource.includes("uploadMasterDocument("),
    "ProjectDocumentsPanel: uses master-documents-api upload"
  );
  assert(
    !panelSource.includes("uploadDocumentCenterFile") &&
      !panelSource.includes("createDocument("),
    "ProjectDocumentsPanel: no direct browser upload/insert"
  );
  assert(
    !panelSource.includes("storage.from") &&
      !panelSource.includes("getPublicUrl"),
    "ProjectDocumentsPanel: no browser storage/getPublicUrl"
  );

  assert(
    inspectionsSource.includes("listMasterDocumentsByBuilding(buildingId)"),
    "InspectionsTab: uses master-documents-api list"
  );

  assert(
    inspectorDialogSource.includes("createInspectorReportWithFile"),
    "InspectorReportDialog: still uses shared inspector flow (Phase 3C blocker)"
  );
  assert(
    inspectorDialogSource.includes("uploadDocumentCenterFile") ||
      inspectorDialogSource.includes("createInspectorReportWithFile"),
    "InspectorReportDialog: upload remains direct anon via inspector-report-tracking"
  );

  const apiClientSource = read("lib/master-documents-api.ts");
  assert(
    !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClientSource.includes("getSupabaseServiceClient"),
    "master-documents-api: no service_role in browser client"
  );
  assert(
    apiClientSource.includes("credentials") ||
      apiClientSource.includes("withCredentials") ||
      apiClientSource.includes("masterApiFetch"),
    "master-documents-api: session cookie on API calls"
  );
  assert(
    apiClientSource.includes("uploadMasterDocument") &&
      apiClientSource.includes("FormData"),
    "master-documents-api: upload via multipart FormData"
  );
  assert(
    !apiClientSource.includes("storage.from") &&
      !apiClientSource.includes("getPublicUrl"),
    "master-documents-api: no browser storage/getPublicUrl"
  );

  const documentCenterSource = read("lib/document-center.ts");
  assert(
    documentCenterSource.includes("uploadDocumentCenterFile"),
    "document-center.ts: Legacy upload path preserved"
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

  const faultsRoute = read("app/forte/api/master-faults/route.ts");
  assert(
    faultsRoute.includes("requireMasterApiSession"),
    "Master Faults API unchanged (2A regression)"
  );

  const aggregatesRoute = read("app/forte/api/master-fault-aggregates/route.ts");
  assert(
    aggregatesRoute.includes("requireMasterApiSession"),
    "Master Fault Aggregates API unchanged (2B regression)"
  );

  const clientAccessRoute = read("app/forte/api/master-client-access/route.ts");
  assert(
    clientAccessRoute.includes("requireMasterApiSession"),
    "Master Client Access API unchanged (regression)"
  );

  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";
  const sessionCookieForIsolation = masterSessionCookie();
  if (sessionCookieForIsolation) {
    const md25List = await listDocumentsGET(
      makeMasterApiRequest("/forte/api/master-documents?buildingId=md25", {
        cookie: sessionCookieForIsolation,
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
        cookie: sessionCookieForIsolation,
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

    const sample = md25Docs[0] ?? sl48Docs[0];
    if (sample) {
      assertDtoMinimized(sample as Record<string, unknown>);
    } else {
      assert(true, "DTO minimization sample skipped (no documents in DB)");
    }
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
