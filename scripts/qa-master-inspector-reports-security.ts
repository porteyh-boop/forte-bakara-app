/**
 * Security Phase 1.5B-3D-A — Master V2 inspector report secure create QA.
 * Run: npx tsx scripts/qa-master-inspector-reports-security.ts
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
  INSPECTOR_REPORT_MAX_FILE_BYTES,
  validateInspectorReportFile,
} from "../lib/inspector-report-tracking";
import {
  validateMasterInspectorReportCreateMetadata,
} from "../lib/master-inspector-reports-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import { POST as createInspectorReportPOST } from "../app/forte/api/master-inspector-reports/route";

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
  init?: {
    method?: string;
    cookie?: string;
    body?: FormData;
    origin?: string;
  }
): NextRequest {
  const url = `http://localhost:3000${urlPath}`;
  const headers: Record<string, string> = {
    host: "localhost:3000",
    origin: init?.origin ?? "http://localhost:3000",
  };
  if (init?.cookie) headers.cookie = init.cookie;

  return new NextRequest(url, {
    method: init?.method ?? "POST",
    headers,
    body: init?.body,
  });
}

function masterSessionCookie(): string | null {
  const token = createMasterSessionToken();
  if (!token) return null;
  return `${FORTE_MASTER_SESSION_COOKIE}=${token}`;
}

function makeInspectorFormData(overrides?: {
  buildingId?: string;
  documentName?: string;
  reportDate?: string;
  hasRemarks?: string;
  fileName?: string;
  fileContent?: string | Uint8Array;
  fileType?: string;
  extra?: Record<string, string>;
}): FormData {
  const formData = new FormData();
  formData.append("buildingId", overrides?.buildingId ?? "md25");
  formData.append("documentName", overrides?.documentName ?? "QA inspector report");
  formData.append("reportDate", overrides?.reportDate ?? "2026-08-19");
  formData.append("hasRemarks", overrides?.hasRemarks ?? "false");
  const fileName = overrides?.fileName ?? "qa-inspector.pdf";
  const content = overrides?.fileContent ?? "%PDF-1.4 qa inspector test";
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

const FORBIDDEN_RESPONSE_FIELDS = [
  "storage_path",
  "ocr_text",
  "ai_summary",
  "ai_metadata",
] as const;

async function main(): Promise<void> {
  console.log("\n=== Master V2 Inspector Reports Security QA (Phase 1.5B-3D-A) ===\n");

  console.log("--- Static wiring ---");

  const dialogSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectorReportDialog.tsx"
  );
  assert(
    dialogSource.includes("createMasterInspectorReport"),
    "InspectorReportDialog: uses createMasterInspectorReport"
  );
  assert(
    !dialogSource.includes("createInspectorReportWithFile"),
    "InspectorReportDialog: no createInspectorReportWithFile"
  );
  assert(
    !dialogSource.includes("uploadDocumentCenterFile"),
    "InspectorReportDialog: no direct Storage upload"
  );
  assert(
    !dialogSource.includes('.from("documents")') &&
      !dialogSource.includes("document_inspector_meta"),
    "InspectorReportDialog: no direct Supabase table access"
  );

  const apiClientSource = read("lib/master-inspector-reports-api.ts");
  assert(
    !apiClientSource.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClientSource.includes("getSupabaseServiceClient"),
    "master-inspector-reports-api: no service_role in browser client"
  );
  assert(
    apiClientSource.includes("FormData") &&
      apiClientSource.includes("withCredentials"),
    "master-inspector-reports-api: multipart + session cookie"
  );
  assert(
    !apiClientSource.includes("storage.from") &&
      !apiClientSource.includes("getPublicUrl"),
    "master-inspector-reports-api: no browser storage/getPublicUrl"
  );

  const serverSource = read("lib/master-inspector-reports-server.ts");
  assert(
    serverSource.includes("DOCUMENT_CENTER_BUCKET") &&
      serverSource.includes("buildDocumentStoragePath") &&
      serverSource.includes("DOCUMENT_INSPECTOR_META_TABLE"),
    "master-inspector-reports-server: storage + documents + meta"
  );
  assert(
    serverSource.includes("INSPECTOR_REPORT_MAX_FILE_BYTES") &&
      serverSource.includes("validateInspectorReportFile"),
    "master-inspector-reports-server: 20MB inspector file limit"
  );
  assert(
    serverSource.includes("deleteInspectorReportStorageFile") &&
      serverSource.includes("deleteInspectorReportDocumentRow"),
    "master-inspector-reports-server: cleanup helpers present"
  );
  assert(
    serverSource.includes("verifyElevatorBelongsToBuildingServer"),
    "master-inspector-reports-server: elevator/building verification"
  );

  const routeSource = read("app/forte/api/master-inspector-reports/route.ts");
  assert(
    routeSource.includes("requireMasterApiSession") &&
      routeSource.includes("isAllowedForteApiOrigin") &&
      routeSource.includes("forbidden_field"),
    "master-inspector-reports route: auth + origin + forbidden fields"
  );

  const legacyTracking = read("lib/inspector-report-tracking.ts");
  assert(
    legacyTracking.includes("createInspectorReportWithFile"),
    "Legacy inspector-report-tracking preserved"
  );

  console.log("\n--- Server validation ---");

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "",
      documentName: "Test",
      reportDate: "2026-08-19",
      hasRemarks: false,
      fileName: "test.pdf",
      fileSizeBytes: 100,
    }) === "invalid_building_id",
    "validation: invalid buildingId → invalid_building_id"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "",
      reportDate: "2026-08-19",
      hasRemarks: false,
      fileName: "test.pdf",
      fileSizeBytes: 100,
    }) === "missing_title",
    "validation: missing title → missing_title"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "Test",
      reportDate: "not-a-date",
      hasRemarks: false,
      fileName: "test.pdf",
      fileSizeBytes: 100,
    }) === "invalid_report_date",
    "validation: invalid reportDate → invalid_report_date"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "Test",
      reportDate: "2026-08-19",
      hasRemarks: false,
      nextInspectionDate: "bad-date",
      fileName: "test.pdf",
      fileSizeBytes: 100,
    }) === "invalid_next_inspection_date",
    "validation: invalid nextInspectionDate → invalid_next_inspection_date"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "Test",
      reportDate: "2026-08-19",
      hasRemarks: "maybe",
      fileName: "test.pdf",
      fileSizeBytes: 100,
    }) === "invalid_has_remarks",
    "validation: invalid hasRemarks → invalid_has_remarks"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "Test",
      reportDate: "2026-08-19",
      hasRemarks: false,
      fileName: "test.exe",
      mimeType: "application/x-msdownload",
      fileSizeBytes: 100,
    }) !== null,
    "validation: invalid file type blocked"
  );

  assert(
    validateMasterInspectorReportCreateMetadata({
      buildingId: "md25",
      documentName: "Test",
      reportDate: "2026-08-19",
      hasRemarks: false,
      fileName: "big.pdf",
      mimeType: "application/pdf",
      fileSizeBytes: INSPECTOR_REPORT_MAX_FILE_BYTES + 1,
    }) !== null,
    "validation: file >20MB blocked"
  );

  assert(
    validateInspectorReportFile({
      name: "big.pdf",
      type: "application/pdf",
      size: INSPECTOR_REPORT_MAX_FILE_BYTES + 1,
    }) !== null,
    "validateInspectorReportFile: 20MB ceiling enforced"
  );

  console.log("\n--- API route ---");

  const noSession = await createInspectorReportPOST(
    makeMasterApiRequest("/forte/api/master-inspector-reports", {
      body: makeInspectorFormData(),
    })
  );
  assert(noSession.status === 401, "POST without Master session → 401");

  const badOrigin = await createInspectorReportPOST(
    makeMasterApiRequest("/forte/api/master-inspector-reports", {
      body: makeInspectorFormData(),
      cookie: masterSessionCookie() ?? undefined,
      origin: "https://evil.example",
    })
  );
  assert(badOrigin.status === 403, "invalid origin → 403");

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";
  const sessionCookie = masterSessionCookie();

  if (sessionCookie) {
    const invalidBuildingForm = new FormData();
    invalidBuildingForm.append("buildingId", "");
    invalidBuildingForm.append("documentName", "Test");
    invalidBuildingForm.append("reportDate", "2026-08-19");
    invalidBuildingForm.append("hasRemarks", "false");
    invalidBuildingForm.append(
      "file",
      new File(["%PDF-1.4"], "qa-inspector.pdf", { type: "application/pdf" })
    );
    const invalidBuilding = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: invalidBuildingForm,
      })
    );
    assert(invalidBuilding.status === 400, "invalid buildingId → 400");

    const missingFileForm = new FormData();
    missingFileForm.append("buildingId", "md25");
    missingFileForm.append("documentName", "Test");
    missingFileForm.append("reportDate", "2026-08-19");
    missingFileForm.append("hasRemarks", "false");
    const missingFile = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: missingFileForm,
      })
    );
    assert(missingFile.status === 400, "missing file → 400");

    const invalidType = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          fileName: "bad.exe",
          fileType: "application/x-msdownload",
        }),
      })
    );
    assert(invalidType.status === 400, "invalid file type → 400");

    const oversized = new Uint8Array(INSPECTOR_REPORT_MAX_FILE_BYTES + 1024);
    oversized.fill(37);
    const tooLarge = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          fileName: "too-big.pdf",
          fileType: "application/pdf",
          fileContent: oversized,
        }),
      })
    );
    assert(tooLarge.status === 400, "file >20MB → 400");

    const forbiddenBucket = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          extra: { bucket: "inspector-reports" },
        }),
      })
    );
    assert(forbiddenBucket.status === 400, "browser-supplied bucket → 400 forbidden_field");

    const forbiddenPath = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          extra: { storage_path: "sl48/2026-08-19/evil.pdf" },
        }),
      })
    );
    assert(forbiddenPath.status === 400, "browser-supplied storage_path → 400");

    const forbiddenUrl = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          extra: { file_url: "https://evil.example/file.pdf" },
        }),
      })
    );
    assert(forbiddenUrl.status === 400, "browser-supplied file_url → 400");

    const invalidDate = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({ reportDate: "2026-99-99" }),
      })
    );
    assert(invalidDate.status === 400, "invalid reportDate → 400");

    const invalidMetadata = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({ hasRemarks: "maybe" }),
      })
    );
    assert(invalidMetadata.status === 400, "invalid hasRemarks → 400");

    const invalidElevator = await createInspectorReportPOST(
      makeMasterApiRequest("/forte/api/master-inspector-reports", {
        cookie: sessionCookie,
        body: makeInspectorFormData({
          extra: { elevatorId: "nonexistent-elevator-id-qa" },
        }),
      })
    );
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      assert(
        invalidElevator.status === 502 || invalidElevator.status === 400,
        "invalid elevator for building rejected when service configured"
      );
    } else {
      assert(true, "invalid elevator integration skipped (service not configured)");
    }
  } else {
    console.warn("  ⚠ Skipping authenticated route tests (no session secret)");
  }

  console.log("\n--- Response DTO shape (static) ---");
  const dtoInterface = serverSource.slice(
    serverSource.indexOf("export interface MasterInspectorReportDto"),
    serverSource.indexOf("export interface MasterInspectorReportCreateResult")
  );
  for (const field of FORBIDDEN_RESPONSE_FIELDS) {
    assert(!dtoInterface.includes(field), `DTO interface excludes "${field}"`);
  }

  console.log("\n--- Regression: other security suites untouched ---");
  assert(
    read("app/forte/api/master-documents/route.ts").includes(
      "requireMasterApiSession"
    ),
    "Master Documents API unchanged"
  );
  assert(
    read("app/forte/api/master-faults/route.ts").includes(
      "requireMasterApiSession"
    ),
    "Master Faults API unchanged"
  );

  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  console.log(`\n=== Security QA סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
