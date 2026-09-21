/**
 * Sales lead cleanup V1 — static guards + protection logic (no production deletes).
 * Run: npx tsx scripts/qa-sales-leads-cleanup-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  assessSalesLeadProtection,
  mapLeadProtectionFromSalesLead,
} from "../lib/sales-leads-cleanup-server";
import { isSalesLeadDeletableForUi } from "../lib/sales-leads";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

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

console.log("Sales lead cleanup V1 QA\n");

const view = read("components/master-v2/MasterSalesLeadsView.tsx");
const api = read("lib/sales-leads-api.ts");
const cleanupServer = read("lib/sales-leads-cleanup-server.ts");
const leadRoute = read("app/forte/api/master-sales-leads/[leadId]/route.ts");
const cleanupRoute = read("app/forte/api/master-sales-leads/cleanup/route.ts");

assert(leadRoute.includes("export async function DELETE"), "DELETE handler on lead route");
assert(cleanupRoute.includes("requireMasterApiSession"), "cleanup route uses master session");
assert(cleanupRoute.includes("isAllowedForteApiOrigin"), "cleanup route uses origin guard");
assert(cleanupServer.includes("deleteSalesLeadServer"), "server delete helper exists");
assert(cleanupServer.includes("lead_protected"), "server lead_protected guard");
assert(
  !view.includes('.from("sales_leads")'),
  "sales view does not use direct Supabase delete"
);
assert(api.includes("method: \"DELETE\""), "client API uses DELETE endpoint");
assert(view.includes("נקה לידים"), "bulk cleanup UI label");
assert(view.includes("למחוק את הליד?"), "delete confirmation title");

assert(
  assessSalesLeadProtection({
    status: "חדש",
    converted_building_id: "",
    trial_building_id: "",
    trial_client_user_id: "",
  }).deletable,
  "new lead without links is deletable"
);

assert(
  !assessSalesLeadProtection({
    status: "זכייה",
    converted_building_id: "",
    trial_building_id: "",
    trial_client_user_id: "",
  }).deletable,
  "won status blocked"
);

assert(
  !assessSalesLeadProtection({
    status: "חדש",
    converted_building_id: "b1",
    trial_building_id: "",
    trial_client_user_id: "",
  }).deletable,
  "converted building blocked"
);

assert(
  !assessSalesLeadProtection({
    status: "לא נסגר",
    converted_building_id: "",
    trial_building_id: "tb1",
    trial_client_user_id: "",
  }).deletable,
  "trial building blocked"
);

const uiMatch = mapLeadProtectionFromSalesLead({
  status: "משא ומתן",
  convertedBuildingId: null,
  trialBuildingId: null,
  trialClientUserId: null,
});
assert(
  uiMatch.deletable === isSalesLeadDeletableForUi({
    id: "x",
    clientName: "",
    buildingName: "",
    city: "",
    address: "",
    contactName: "",
    phone: "",
    email: "",
    needDescription: "",
    serviceType: "",
    serviceTypeOther: "",
    status: "משא ומתן",
    source: "",
    sourceDetail: "",
    contactChannel: "",
    estimatedValue: null,
    nextAction: "",
    followUpDate: null,
    convertedBuildingId: null,
    trialBuildingId: null,
    trialClientUserId: null,
    contactId: null,
    createdAt: "",
    updatedAt: "",
    history: [],
  }),
  "UI hint matches server protection for open lead"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
