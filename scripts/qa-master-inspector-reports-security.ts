/**
 * Security Phase 1.5B-3D-A/3D-B/3D-C — Master V2 inspector report secure create/read/close/delete QA.
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
  BUILDING_FORBIDDEN_ERROR,
  closeMasterInspectorReportServer,
  deleteMasterInspectorReportServer,
  listMasterInspectorReportsByBuildingServer,
  validateMasterInspectorReportCreateMetadata,
} from "../lib/master-inspector-reports-server";
import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import {
  GET as listInspectorReportsGET,
  POST as createInspectorReportPOST,
} from "../app/forte/api/master-inspector-reports/route";
import {
  DELETE as deleteInspectorReportDELETE,
  PATCH as closeInspectorReportPATCH,
} from "../app/forte/api/master-inspector-reports/[reportId]/route";

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
  console.log(
    "\n=== Master V2 Inspector Reports Security QA (Phase 1.5B-3D-A/3D-B/3D-C) ===\n"
  );

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
  assert(
    routeSource.includes("export async function GET") &&
      routeSource.includes("listMasterInspectorReportsByBuildingServer"),
    "master-inspector-reports route: GET list handler"
  );

  const inspectionsTabSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectionsTab.tsx"
  );
  const followUpPopupSource = read(
    "components/master-v2/project-v2/MasterProjectV2InspectorFollowUpPopup.tsx"
  );
  const documentsPanelSource = read(
    "components/master-v2/project-v2/ProjectDocumentsPanel.tsx"
  );

  assert(
    inspectionsTabSource.includes("listMasterInspectorReports(buildingId)"),
    "InspectionsTab: uses scoped listMasterInspectorReports"
  );
  assert(
    !inspectionsTabSource.includes("getAllInspectorReports("),
    "InspectionsTab: no getAllInspectorReports"
  );
  assert(
    !inspectionsTabSource.includes("listAllDocumentInspectorMeta("),
    "InspectionsTab: no listAllDocumentInspectorMeta"
  );
  assert(
    !inspectionsTabSource.includes("listAllDocumentInspectorNotifications("),
    "InspectionsTab: no global notifications read"
  );
  assert(
    !inspectionsTabSource.includes("listMasterDocumentsByBuilding("),
    "InspectionsTab: no master-documents list for follow-up stages"
  );
  assert(
    inspectionsTabSource.includes("closeMasterInspectorReport("),
    "InspectionsTab: uses closeMasterInspectorReport API"
  );
  assert(
    inspectionsTabSource.includes("deleteMasterInspectorReport("),
    "InspectionsTab: uses deleteMasterInspectorReport API"
  );
  assert(
    !inspectionsTabSource.includes("closeInspectorReport("),
    "InspectionsTab: no direct closeInspectorReport"
  );
  assert(
    !inspectionsTabSource.includes("deleteInspectorReport("),
    "InspectionsTab: no direct deleteInspectorReport"
  );

  assert(
    followUpPopupSource.includes("listMasterInspectorReports(buildingId)"),
    "FollowUpPopup: uses scoped listMasterInspectorReports"
  );
  assert(
    !followUpPopupSource.includes("getAllInspectorReports("),
    "FollowUpPopup: no getAllInspectorReports"
  );
  assert(
    !followUpPopupSource.includes("listAllDocumentInspectorNotifications("),
    "FollowUpPopup: no global notifications read"
  );
  assert(
    !followUpPopupSource.includes("getAllDocuments("),
    "FollowUpPopup: no getAllDocuments"
  );

  assert(
    !documentsPanelSource.includes("listAllDocumentInspectorMeta("),
    "ProjectDocumentsPanel: no global listAllDocumentInspectorMeta"
  );
  assert(
    documentsPanelSource.includes("listMasterInspectorReports(buildingId)") ||
      documentsPanelSource.includes("inspectorMetaDocumentIds"),
    "ProjectDocumentsPanel: scoped inspector meta ids"
  );

  assert(
    apiClientSource.includes("listMasterInspectorReports") &&
      apiClientSource.includes("masterApiFetch"),
    "master-inspector-reports-api: list via masterApiFetch"
  );
  assert(
    apiClientSource.includes("closeMasterInspectorReport") &&
      apiClientSource.includes("deleteMasterInspectorReport"),
    "master-inspector-reports-api: close/delete via masterApiFetch"
  );
  assert(
    !apiClientSource.includes("closeInspectorReport") &&
      !apiClientSource.includes("deleteInspectorReport"),
    "master-inspector-reports-api: no legacy close/delete"
  );
  assert(
    serverSource.includes("listMasterInspectorReportsByBuildingServer") &&
      serverSource.includes("INSPECTOR_META_READ_COLUMNS") &&
      serverSource.includes("LEGACY_INSPECTOR_REPORT_READ_COLUMNS"),
    "master-inspector-reports-server: scoped list column projections"
  );
  assert(
    serverSource.includes("closeMasterInspectorReportServer") &&
      serverSource.includes("deleteMasterInspectorReportServer") &&
      serverSource.includes("verifyInspectorReportBuildingServer"),
    "master-inspector-reports-server: scoped close/delete + building verify"
  );
  assert(
    serverSource.includes(BUILDING_FORBIDDEN_ERROR),
    "master-inspector-reports-server: building_forbidden error"
  );

  const reportRouteSource = read(
    "app/forte/api/master-inspector-reports/[reportId]/route.ts"
  );
  assert(
    reportRouteSource.includes("export async function PATCH") &&
      reportRouteSource.includes("export async function DELETE") &&
      reportRouteSource.includes("closeMasterInspectorReportServer") &&
      reportRouteSource.includes("deleteMasterInspectorReportServer"),
    "master-inspector-reports/[reportId] route: PATCH close + DELETE"
  );
  assert(
    reportRouteSource.includes("forbidden_field"),
    "master-inspector-reports/[reportId] route: forbidden storage fields"
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

  console.log("\n--- GET list API route ---");

  const getNoSession = await listInspectorReportsGET(
    makeMasterApiRequest("/forte/api/master-inspector-reports?buildingId=md25", {
      method: "GET",
    })
  );
  assert(getNoSession.status === 401, "GET without Master session → 401");

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";
  const sessionCookie = masterSessionCookie();

  const getNoBuilding = await listInspectorReportsGET(
    makeMasterApiRequest("/forte/api/master-inspector-reports", {
      method: "GET",
      cookie: sessionCookie ?? undefined,
    })
  );
  assert(getNoBuilding.status === 400, "GET without buildingId → 400");

  const getBadOrigin = await listInspectorReportsGET(
    makeMasterApiRequest("/forte/api/master-inspector-reports?buildingId=md25", {
      method: "GET",
      cookie: sessionCookie ?? undefined,
      origin: "https://evil.example",
    })
  );
  assert(getBadOrigin.status === 403, "GET invalid origin → 403");

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
  const listDtoInterface = serverSource.slice(
    serverSource.indexOf("export interface MasterInspectorReportListItemDto"),
    serverSource.indexOf("export interface MasterInspectorNotificationDto")
  );
  for (const field of FORBIDDEN_RESPONSE_FIELDS) {
    assert(!dtoInterface.includes(field), `create DTO excludes "${field}"`);
    assert(!listDtoInterface.includes(field), `list DTO excludes "${field}"`);
  }

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    sessionCookie
  ) {
    console.log("\n--- GET building isolation (integration) ---");

    const invalidBuildingGet = await listInspectorReportsGET(
      makeMasterApiRequest("/forte/api/master-inspector-reports?buildingId=", {
        method: "GET",
        cookie: sessionCookie,
      })
    );
    assert(invalidBuildingGet.status === 400, "GET invalid buildingId → 400");

    const md25Get = await listInspectorReportsGET(
      makeMasterApiRequest("/forte/api/master-inspector-reports?buildingId=md25", {
        method: "GET",
        cookie: sessionCookie,
      })
    );
    assert(md25Get.status === 200, "GET md25 → 200");
    const md25Payload = (await md25Get.json()) as Record<string, unknown>;
    const md25Reports = (md25Payload.reports ?? []) as Array<Record<string, unknown>>;
    const md25Notifications = (md25Payload.notifications ?? []) as Array<
      Record<string, unknown>
    >;
    const md25Prepared = (md25Payload.preparedLetterStages ?? []) as Array<
      Record<string, unknown>
    >;

    assert(
      md25Reports.every((row) => String(row.building_id).toLowerCase() === "md25"),
      "md25 GET reports scoped to md25"
    );

    const sl48Get = await listInspectorReportsGET(
      makeMasterApiRequest("/forte/api/master-inspector-reports?buildingId=sl48", {
        method: "GET",
        cookie: sessionCookie,
      })
    );
    assert(sl48Get.status === 200, "GET sl48 → 200");
    const sl48Payload = (await sl48Get.json()) as Record<string, unknown>;
    const sl48Reports = (sl48Payload.reports ?? []) as Array<Record<string, unknown>>;

    assert(
      sl48Reports.every((row) => String(row.building_id).toLowerCase() === "sl48"),
      "sl48 GET reports scoped to sl48"
    );

    const md25Ids = new Set(md25Reports.map((row) => String(row.id)));
    const sl48Ids = new Set(sl48Reports.map((row) => String(row.id)));
    const overlap = [...md25Ids].filter((id) => sl48Ids.has(id));
    assert(overlap.length === 0, "md25 response does not include sl48 report ids");

    const md25FileUrls = md25Reports
      .map((row) => String(row.file_url ?? ""))
      .filter(Boolean);
    const sl48FileUrls = new Set(
      sl48Reports.map((row) => String(row.file_url ?? "")).filter(Boolean)
    );
    assert(
      md25FileUrls.every((url) => !sl48FileUrls.has(url)),
      "md25 response does not include sl48 file_url values"
    );

    const md25Serialized = JSON.stringify(md25Payload);
    for (const sl48Report of sl48Reports) {
      const sl48Id = String(sl48Report.id ?? "");
      if (sl48Id) {
        assert(!md25Serialized.includes(sl48Id), "md25 response excludes sl48 report id");
      }
    }

    assert(
      !md25Serialized.includes("storage_path"),
      "GET response excludes storage_path"
    );
    assert(
      !md25Serialized.includes("ai_summary") && !md25Serialized.includes('"ocr_text"'),
      "GET response excludes OCR/summary fields"
    );
    assert(
      !md25Serialized.includes('"ai_metadata"'),
      "GET response excludes full ai_metadata"
    );

    const md25Server = await listMasterInspectorReportsByBuildingServer("md25");
    assert(md25Server.error === null, "server list md25 succeeds");
    assert(
      md25Server.reports.every((row) => row.building_id === "md25"),
      "server list md25 scoped"
    );

    const qaArtifactId = "2246c38a-dbc2-47bf-b7f4-469624b104e3";
    const hasQaArtifact = md25Server.reports.some(
      (row) => row.document_id === qaArtifactId || row.id === qaArtifactId
    );
    assert(hasQaArtifact, "md25 list includes preserved QA artifact report");

    assert(
      md25Prepared.every((row) => typeof row.reportDocumentId === "string"),
      "preparedLetterStages slim DTO shape"
    );
    assert(
      md25Notifications.every((row) => typeof row.document_id === "string"),
      "notifications slim DTO shape"
    );
  } else {
    console.warn("  ⚠ Skipping GET integration tests (service not configured)");
  }

  const qaArtifactId = "2246c38a-dbc2-47bf-b7f4-469624b104e3";

  console.log("\n--- Close/Delete API route (Phase 3D-C) ---");

  const patchNoSession = await closeInspectorReportPATCH(
    makeMasterApiRequest(
      `/forte/api/master-inspector-reports/${qaArtifactId}`,
      { method: "PATCH" }
    ),
    { params: Promise.resolve({ reportId: qaArtifactId }) }
  );
  assert(patchNoSession.status === 401, "PATCH close without Master session → 401");

  const deleteNoSession = await deleteInspectorReportDELETE(
    makeMasterApiRequest(
      `/forte/api/master-inspector-reports/${qaArtifactId}?buildingId=md25`,
      { method: "DELETE" }
    ),
    { params: Promise.resolve({ reportId: qaArtifactId }) }
  );
  assert(deleteNoSession.status === 401, "DELETE without Master session → 401");

  if (sessionCookie) {
    const crossBuildingCloseWithBody = await closeInspectorReportPATCH(
      new NextRequest(
        `http://localhost:3000/forte/api/master-inspector-reports/${qaArtifactId}`,
        {
          method: "PATCH",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: sessionCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "close",
            buildingId: "sl48",
            closureNotes: "QA cross-building close attempt",
          }),
        }
      ),
      { params: Promise.resolve({ reportId: qaArtifactId }) }
    );
    assert(
      crossBuildingCloseWithBody.status === 403,
      "cross-building close → 403 (QA artifact preserved)"
    );

    const crossBuildingDelete = await deleteInspectorReportDELETE(
      makeMasterApiRequest(
        `/forte/api/master-inspector-reports/${qaArtifactId}?buildingId=sl48`,
        {
          method: "DELETE",
          cookie: sessionCookie,
        }
      ),
      { params: Promise.resolve({ reportId: qaArtifactId }) }
    );
    assert(
      crossBuildingDelete.status === 403,
      "cross-building delete → 403 (QA artifact preserved)"
    );

    const forbiddenStorageField = await closeInspectorReportPATCH(
      new NextRequest(
        `http://localhost:3000/forte/api/master-inspector-reports/${qaArtifactId}`,
        {
          method: "PATCH",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: sessionCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "close",
            buildingId: "md25",
            storage_path: "evil/path.pdf",
          }),
        }
      ),
      { params: Promise.resolve({ reportId: qaArtifactId }) }
    );
    assert(forbiddenStorageField.status === 400, "browser-supplied storage_path on close → 400");

    const notFoundClose = await closeInspectorReportPATCH(
      new NextRequest(
        "http://localhost:3000/forte/api/master-inspector-reports/00000000-0000-4000-8000-000000000099",
        {
          method: "PATCH",
          headers: {
            host: "localhost:3000",
            origin: "http://localhost:3000",
            cookie: sessionCookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "close",
            buildingId: "md25",
          }),
        }
      ),
      { params: Promise.resolve({ reportId: "00000000-0000-4000-8000-000000000099" }) }
    );
    assert(notFoundClose.status === 404, "close missing report → 404");

    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const crossBuildingServerClose = await closeMasterInspectorReportServer(
        qaArtifactId,
        "sl48"
      );
      assert(
        crossBuildingServerClose.error === BUILDING_FORBIDDEN_ERROR,
        "server close cross-building → building_forbidden"
      );
      assert(
        !crossBuildingServerClose.ok,
        "server close cross-building returns not ok"
      );

      const crossBuildingServerDelete = await deleteMasterInspectorReportServer(
        qaArtifactId,
        "sl48"
      );
      assert(
        crossBuildingServerDelete.error === BUILDING_FORBIDDEN_ERROR,
        "server delete cross-building → building_forbidden"
      );

      const md25After = await listMasterInspectorReportsByBuildingServer("md25");
      const qaStillPresent = md25After.reports.some(
        (row) => row.document_id === qaArtifactId || row.id === qaArtifactId
      );
      assert(qaStillPresent, "QA artifact still present after auth-only close/delete tests");
      const qaReport = md25After.reports.find(
        (row) => row.document_id === qaArtifactId || row.id === qaArtifactId
      );
      assert(
        qaReport?.status === "open",
        "QA artifact still open after auth-only close/delete tests"
      );
    } else {
      assert(true, "server close/delete integration skipped (service not configured)");
    }
  } else {
    console.warn("  ⚠ Skipping close/delete route tests (no session secret)");
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
