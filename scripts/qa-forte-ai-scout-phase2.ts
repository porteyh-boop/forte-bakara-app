/**
 * Phase 2 QA — FORTE AI SCOUT (static + unit-style logic).
 * Run: npx tsx scripts/qa-forte-ai-scout-phase2.ts
 */
import fs from "fs";
import path from "path";
import { findDuplicateSalesLead } from "../lib/scout/scout-duplicate";
import { buildCandidateFromSearchHit } from "../lib/scout/scout-scoring";
import type { SalesLead } from "../lib/sales-leads";

let passed = 0;
let failed = 0;

function ok(label: string): void {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function bad(label: string, detail?: string): void {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) ok(label);
  else bad(label, detail);
}

console.log("\n=== FORTE AI SCOUT — Phase 2 QA ===\n");

const migration = read("supabase/migrations/048_scout_lead_candidates.sql");
assert(migration.includes("scout_lead_candidates"), "migration 048 defines scout_lead_candidates");
assert(
  migration.includes("references public.sales_leads") &&
    !migration.toLowerCase().includes("alter table public.sales_leads"),
  "048 FK to sales_leads only — no sales_leads schema change"
);
assert(migration.includes("raw_evidence"), "raw_evidence jsonb column");
assert(migration.includes("source_url"), "source_url required");

const provider = read("lib/scout/scout-research-provider.ts");
assert(provider.includes("ScoutResearchProvider"), "ScoutResearchProvider interface");
assert(provider.includes("createSerperScoutResearchProvider"), "Serper factory wired");
assert(
  fs.existsSync(path.join(process.cwd(), "lib/scout/scout-serper-provider.ts")),
  "scout-serper-provider.ts exists"
);

const runner = read("lib/scout/scout-runner.ts");
assert(runner.includes("getScoutResearchProvider"), "runner uses research provider");
assert(runner.includes("buildCandidateFromSearchHit"), "runner separates scoring layer");
assert(
  !runner.match(/whatsapp|resend|send_email|outreach/i),
  "runner has no outreach/email/whatsapp"
);

const server = read("lib/scout/scout-server.ts");
assert(server.includes("duplicate_lead_id"), "server persists duplicate info");
assert(server.includes("createSalesLeadServer"), "import uses existing sales lead creator");
assert(server.includes("duplicate_blocked"), "import blocks duplicates");

const apiPaths = [
  "app/forte/api/master/ai-marketing/scout/tasks/route.ts",
  "app/forte/api/master/ai-marketing/scout/tasks/[taskId]/run/route.ts",
  "app/forte/api/master/ai-marketing/scout/candidates/[candidateId]/import/route.ts",
];
for (const p of apiPaths) {
  assert(fs.existsSync(path.join(process.cwd(), p)), `API route ${p}`);
}

const view = read("components/master-v2/MasterForteAiView.tsx");
assert(view.includes("MasterForteAiScoutSection"), "Master AI view embeds SCOUT section");

const envExample = read(".env.example");
assert(
  envExample.includes("SCOUT_WEB_SEARCH_PROVIDER") &&
    envExample.includes("SCOUT_WEB_SEARCH_API_KEY"),
  ".env.example documents SCOUT env vars (no secrets)"
);

const salesSources = read("lib/sales-leads.ts");
assert(salesSources.includes("סוכן SCOUT"), "SCOUT source label in SALES_LEAD_SOURCES");

// --- duplicate logic ---
const mockLead: SalesLead = {
  id: "lead-1",
  clientName: "ועד בית הרimon",
  buildingName: "",
  address: "",
  city: "תל אביב",
  contactName: "",
  phone: "0501234567",
  email: "vaad@example.com",
  needDescription: "",
  serviceType: "",
  serviceTypeOther: "",
  source: "אחר",
  sourceDetail: "",
  contactChannel: "",
  status: "חדש",
  estimatedValue: null,
  nextAction: "",
  followUpDate: null,
  history: [],
  contactId: null,
  convertedBuildingId: null,
  trialBuildingId: null,
  trialClientUserId: null,
  createdAt: "",
  updatedAt: "",
};

const dupPhone = findDuplicateSalesLead(
  {
    organizationName: "משהו אחר",
    buildingName: "",
    city: "חיפה",
    phone: "050-123-4567",
    email: "",
  },
  [mockLead]
);
assert(dupPhone.duplicateLeadId === "lead-1", "duplicate by phone");

const dupOrg = findDuplicateSalesLead(
  {
    organizationName: "ועד בית הרimon",
    buildingName: "",
    city: "תל אביב",
    phone: "",
    email: "",
  },
  [mockLead]
);
assert(dupOrg.duplicateLeadId === "lead-1", "duplicate by org+city");

const noDup = findDuplicateSalesLead(
  {
    organizationName: "חברה לא קשורה",
    buildingName: "",
    city: "באר שבע",
    phone: "",
    email: "",
  },
  [mockLead]
);
assert(noDup.duplicateLeadId === null, "no duplicate when unrelated");

// --- scoring layer ---
const draft = buildCandidateFromSearchHit({
  hit: {
    url: "https://example.com/vaad",
    title: "ועד בית דוגמה תל אביב",
    snippet: "ועד בית בניין עם מעלית. פרטים ציבוריים בלבד.",
  },
  payloadCity: "תל אביב",
  targetType: "vaad_bayit",
  hasDuplicate: false,
});
assert(draft.sourceUrl === "https://example.com/vaad", "candidate keeps source URL");
assert(draft.rawEvidence.every((e) => e.sourceUrl === draft.sourceUrl), "evidence cites source");
assert(draft.matchScore >= 0 && draft.matchScore <= 100, "score in range");

const draftDup = buildCandidateFromSearchHit({
  hit: {
    url: "https://example.com/x",
    title: "ועד בית",
    snippet: "ועד בית",
  },
  payloadCity: "תל אביב",
  targetType: "vaad_bayit",
  hasDuplicate: true,
});
assert(draftDup.matchScore < draft.matchScore, "duplicate lowers score");

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
