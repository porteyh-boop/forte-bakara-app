/**
 * Phase 1 QA — building client updates (unit + optional integration).
 * Run: npx tsx scripts/qa-building-client-updates.ts
 */
import fs from "fs";
import path from "path";
import {
  isDocumentEligibleForClientUpdateLink,
  isClientUpdateStatusId,
  isClientUpdateTypeId,
} from "../lib/building-client-updates";
import {
  parseCreateMasterBuildingClientUpdateInput,
  parsePatchMasterBuildingClientUpdateInput,
} from "../lib/building-client-updates-server";
import {
  buildClientUpdateWhatsAppUrl,
  normalizeIsraeliPhoneForWhatsApp,
} from "../lib/client-portal-update-share";

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

console.log("\n=== Building client updates QA (phase 1) ===\n");

assert(isClientUpdateTypeId("general"), "update type general valid");
assert(isClientUpdateTypeId("letter"), "update type letter valid");
assert(!isClientUpdateTypeId("chat"), "update type chat rejected");
assert(isClientUpdateStatusId("awaiting_response"), "status awaiting_response valid");
assert(!isClientUpdateStatusId("open"), "status open rejected");

assert(
  isDocumentEligibleForClientUpdateLink({
    documentBuildingId: "b1",
    updateBuildingId: "b1",
    visibility: "client",
  }),
  "document link: same building + client visibility"
);
assert(
  !isDocumentEligibleForClientUpdateLink({
    documentBuildingId: "b2",
    updateBuildingId: "b1",
    visibility: "client",
  }),
  "document link: cross-building rejected"
);
assert(
  !isDocumentEligibleForClientUpdateLink({
    documentBuildingId: "b1",
    updateBuildingId: "b1",
    visibility: "internal",
  }),
  "document link: internal visibility rejected"
);

const createOk = parseCreateMasterBuildingClientUpdateInput({
  buildingId: "demo-a",
  title: "כותרת",
  body: "תוכן",
  updateType: "general",
  status: "for_information",
  visibleToClient: true,
});
assert(createOk?.buildingId === "demo-a", "parse create: valid input");

const createBad = parseCreateMasterBuildingClientUpdateInput({
  buildingId: "demo-a",
  title: "",
  body: "x",
  updateType: "general",
  status: "for_information",
});
assert(createBad === null, "parse create: empty title rejected");

const patchOk = parsePatchMasterBuildingClientUpdateInput({
  status: "completed",
  visibleToClient: false,
});
assert(patchOk?.status === "completed", "parse patch: status");

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/046_building_client_updates.sql"
);
const migrationSql = fs.readFileSync(migrationPath, "utf8");
assert(
  migrationSql.includes("building_client_updates") &&
    migrationSql.includes("building_client_update_reads") &&
    migrationSql.includes("can_view_client_updates"),
  "migration 046 defines tables + permission column"
);
assert(
  migrationSql.includes("revoke all") &&
    migrationSql.includes("building_client_update_reads"),
  "migration 046 revokes anon/authenticated"
);

const routes = [
  "app/forte/api/master/building-client-updates/route.ts",
  "app/forte/api/master/building-client-updates/[updateId]/route.ts",
  "app/forte/api/client/building-updates/route.ts",
  "app/forte/api/client/building-updates/unread-count/route.ts",
  "app/forte/api/client/building-updates/[updateId]/read/route.ts",
  "app/forte/api/client/building-updates/[updateId]/attachment/route.ts",
];
for (const rel of routes) {
  assert(fs.existsSync(path.join(process.cwd(), rel)), `route exists: ${rel}`);
}

const listRoute = fs.readFileSync(
  path.join(process.cwd(), "app/forte/api/client/building-updates/route.ts"),
  "utf8"
);
const readRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/forte/api/client/building-updates/[updateId]/read/route.ts"
  ),
  "utf8"
);
assert(
  listRoute.includes("requiredPermission: \"can_view_client_updates\""),
  "client list checks can_view_client_updates"
);
assert(
  !listRoute.includes("markClientBuildingUpdateReadServer"),
  "client GET list does not mark read"
);
assert(
  readRoute.includes("markClientBuildingUpdateReadServer"),
  "client POST read marks read"
);

const bootstrapServer = fs.readFileSync(
  path.join(process.cwd(), "lib/client-portal-server.ts"),
  "utf8"
);
assert(
  !bootstrapServer.includes("building_client_updates"),
  "bootstrap server does not load updates list"
);

assert(
  normalizeIsraeliPhoneForWhatsApp("050-1234567") === "972501234567",
  "WhatsApp: Israeli 05… normalized"
);
assert(normalizeIsraeliPhoneForWhatsApp("") === null, "WhatsApp: empty phone rejected");
assert(
  buildClientUpdateWhatsAppUrl("0501234567", "hi")?.startsWith("https://wa.me/972501234567"),
  "WhatsApp: wa.me URL built"
);

const masterTab = fs.readFileSync(
  path.join(process.cwd(), "components/master-v2/project-v2/MasterProjectV2ClientUpdatesTab.tsx"),
  "utf8"
);
assert(masterTab.includes("visibleToClient: false"), "Master UI: default not visible");
assert(masterTab.includes("buildClientUpdateShareMessage"), "Master UI: shared message helper");
assert(
  masterTab.includes("can_view_client_updates") &&
    masterTab.includes("runGatedShareAction"),
  "Master UI: permission gate before client share actions"
);

const v2RoutesSource = fs.readFileSync(
  path.join(process.cwd(), "lib/master-project-v2-routes.ts"),
  "utf8"
);
assert(v2RoutesSource.includes('"clientUpdates"'), "V2 routes include clientUpdates tab");

const attachmentRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/forte/api/client/building-updates/[updateId]/attachment/route.ts"
  ),
  "utf8"
);
assert(
  attachmentRoute.includes("requiredPermission: \"can_view_client_updates\""),
  "client attachment checks can_view_client_updates"
);
assert(
  attachmentRoute.includes("resolveClientBuildingUpdateAttachmentServer"),
  "client attachment uses server resolver"
);

const portalContent = fs.readFileSync(
  path.join(process.cwd(), "components/ClientAccessPageContent.tsx"),
  "utf8"
);
assert(portalContent.includes('"updates"'), "client portal tab key updates");
assert(
  portalContent.includes('hash === "updates"'),
  "client portal opens tab from #updates hash"
);
assert(
  portalContent.includes("fetchClientBuildingUpdatesUnreadCount"),
  "client portal fetches unread count"
);

const updatesSection = fs.readFileSync(
  path.join(process.cwd(), "components/ClientPortalBuildingUpdatesSection.tsx"),
  "utf8"
);
assert(
  updatesSection.includes("IntersectionObserver"),
  "client updates mark-read uses IntersectionObserver"
);
assert(
  updatesSection.includes("if (!isActive") &&
    updatesSection.includes("markClientBuildingUpdateRead"),
  "client updates mark-read only when tab active"
);

const serverSource = fs.readFileSync(
  path.join(process.cwd(), "lib/building-client-updates-server.ts"),
  "utf8"
);
assert(
  serverSource.includes("resolveClientBuildingUpdateAttachmentServer"),
  "server attachment resolver exists"
);

const apiClient = fs.readFileSync(
  path.join(process.cwd(), "lib/client-portal-api-client.ts"),
  "utf8"
);
assert(
  apiClient.includes("unreadCount") && apiClient.includes("body.count"),
  "client portal API maps unreadCount from unread-count endpoint"
);
assert(
  !serverSource.includes("buildDocumentPublicUrl"),
  "attachment resolver does not expose public document URL helper"
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
