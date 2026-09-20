/**
 * CONTENT v1 — template engine + wiring QA (no DB send, no review_status changes).
 */
import fs from "fs";
import path from "path";
import { buildContentDraftV1 } from "../lib/content/content-engine";
import type { ContentDraftInput } from "../lib/content/content-types";

let failed = 0;

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error("  ✗", label);
    failed += 1;
  } else {
    console.log("  ✓", label);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function baseInput(overrides: Partial<ContentDraftInput> = {}): ContentDraftInput {
  return {
    contactName: "יוסי כהן",
    organizationName: "ועד בית רמת אביב",
    buildingName: "רמת אביב 12",
    city: "חולון",
    candidateType: "vaad_bayit",
    candidateTypeLabel: "ועד בית",
    sourceUrl: "https://example.com/vaad",
    qualifyVerdict: "suitable",
    qualifyReason: "התאמה לשירותי FORTE.",
    publicNotes: "ניהול ועד בית — מעליות בבניין.",
    ...overrides,
  };
}

console.log("\n=== FORTE AI CONTENT v1 QA ===\n");

const migration = read("supabase/migrations/050_forte_ai_content_outreach_drafts.sql");
assert(migration.includes("scout_outreach_drafts"), "migration 050 creates scout_outreach_drafts");
assert(migration.includes("'whatsapp'"), "migration 050 channel check includes whatsapp");

const server = read("lib/content/content-server.ts");
assert(server.includes("content_draft_created"), "server records content_draft_created");
assert(server.includes('agentKey: "content"'), "server uses content agent");
assert(
  !server.match(/\.update\(\{[\s\S]*review_status/),
  "server does not change review_status"
);
assert(!server.includes("importScoutCandidate"), "server does not import sales leads");
assert(server.includes('reviewStatus === "approved"'), "server requires approved or imported");

const route = read("app/forte/api/master/ai-marketing/content/drafts/route.ts");
assert(route.includes("createContentOutreachDraftServer"), "content drafts API wired");
assert(route.includes("requireMasterApiSession"), "content API uses master session");
assert(route.includes("isAllowedForteApiOrigin"), "content API origin guard");

const ui = read("components/master-v2/MasterForteAiScoutSection.tsx");
assert(ui.includes("createContentOutreachDraft"), "SCOUT UI calls content API");
assert(ui.includes("CONTENT — הכנת פנייה"), "SCOUT UI CONTENT section");
assert(!ui.includes("שלח"), "SCOUT UI has no send button label (שלח)");

const wa = buildContentDraftV1("whatsapp", baseInput());
assert(wa.includes("שלום יוסי כהן"), "WhatsApp draft uses contact name");
assert(wa.includes("FORTE"), "WhatsApp draft mentions FORTE");
assert(!wa.includes("אנחנו"), "WhatsApp draft avoids אנחנו");

const email = buildContentDraftV1("email", baseInput());
assert(email.includes("נושא:"), "Email draft has subject line");
assert(email.includes("בברכה"), "Email draft body present");

const phone = buildContentDraftV1("phone", baseInput());
assert(phone.includes("פתיחה מוצעת"), "Phone draft opener header");
assert(phone.includes("QUALIFIER"), "Phone draft includes qualifier when present");

const minimal = buildContentDraftV1(
  "whatsapp",
  baseInput({
    contactName: "",
    organizationName: "",
    buildingName: "",
    city: "",
    qualifyVerdict: null,
    qualifyReason: null,
  })
);
assert(!minimal.includes("undefined"), "minimal input no undefined tokens");
assert(minimal.includes("FORTE"), "minimal input still produces draft");

const scoutServer = read("lib/scout/scout-server.ts");
assert(scoutServer.includes("runScoutTaskServer"), "SCOUT server entry intact");

const qualifierEngine = read("lib/qualifier/qualifier-engine.ts");
assert(qualifierEngine.includes("runQualifierRulesV1"), "QUALIFIER engine intact");

console.log("\n--- Summary ---");
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)\n`);
  process.exit(1);
}
console.log("PASS: CONTENT v1 QA\n");
