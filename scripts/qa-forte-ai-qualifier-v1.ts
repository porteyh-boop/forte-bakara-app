/**
 * QUALIFIER v1 — rule engine + wiring QA (no DB, no sales import).
 */
import fs from "fs";
import path from "path";
import { runQualifierRulesV1 } from "../lib/qualifier/qualifier-engine";
import type { QualifierCandidateInput } from "../lib/qualifier/qualifier-types";

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

function baseCandidate(
  overrides: Partial<QualifierCandidateInput> = {}
): QualifierCandidateInput {
  return {
    candidateType: "vaad_bayit",
    organizationName: "ועד בית רמת אביב",
    buildingName: "",
    city: "חולון",
    address: "",
    contactName: "",
    phone: "0501234567",
    email: "",
    publicNotes:
      "ניהול ועד בית ואחזקת מעליות בבניין משותף בחולון — שירותי ניהול מקצועיים.",
    sourceUrl: "https://example.com/vaad-holon",
    sourceTitle: "ועד בית חולון",
    sourceSnippet: "ועד בית בחולון — ניהול בניין משותף",
    rawEvidence: [
      { field: "organizationName", value: "ועד בית", sourceUrl: "https://example.com/vaad-holon" },
      { field: "publicNotes", value: "ניהול ועד", sourceUrl: "https://example.com/vaad-holon" },
    ],
    matchScore: 72,
    scoreRationale: "התאמת מילות מפתח. חיפוש באזור: חולון.",
    duplicateLeadId: null,
    duplicateMatchReason: "",
    ...overrides,
  };
}

console.log("\n=== FORTE AI QUALIFIER v1 QA ===\n");

const migration = read("supabase/migrations/049_forte_ai_qualifier_v1.sql");
assert(migration.includes("'qualifier'"), "migration 049 adds qualifier agent_key");
assert(migration.includes("qualify_verdict"), "migration 049 qualify_verdict column");
assert(migration.includes("qualifier_completed") === false, "migration 049 does not require action type in DB");

const server = read("lib/qualifier/qualifier-server.ts");
assert(server.includes("qualifier_completed"), "server records qualifier_completed");
assert(server.includes("qualify_verdict"), "server updates qualify fields");
assert(
  !server.match(/\.update\(\{[\s\S]*review_status/),
  "server update payload does not change review_status"
);
assert(!server.includes("createSalesLeadServer"), "server does not import sales leads");

const route = read(
  "app/forte/api/master/ai-marketing/qualifier/candidates/[candidateId]/run/route.ts"
);
assert(route.includes("runQualifierOnCandidateServer"), "qualifier run API wired");
assert(route.includes("requireMasterApiSession"), "qualifier API uses master session");

const ui = read("components/master-v2/MasterForteAiScoutSection.tsx");
assert(ui.includes("runQualifierOnCandidate"), "SCOUT UI calls qualifier API");
assert(ui.includes("QUALIFY_VERDICT_LABELS"), "SCOUT UI shows qualifier labels");

const suitable = runQualifierRulesV1(baseCandidate());
assert(suitable.verdict === "suitable", "suitable candidate → suitable");

const review = runQualifierRulesV1(
  baseCandidate({
    matchScore: 48,
    phone: "",
    email: "",
    publicNotes: "ועד בית — מידע חלקי.",
    rawEvidence: [
      { field: "organizationName", value: "ועד", sourceUrl: "https://example.com/x" },
    ],
  })
);
assert(review.verdict === "review", "weak evidence → review");

const unsuitableDup = runQualifierRulesV1(
  baseCandidate({
    duplicateLeadId: "11111111-1111-1111-1111-111111111111",
    duplicateMatchReason: "טלפון זהה",
  })
);
assert(unsuitableDup.verdict === "unsuitable", "duplicate → unsuitable");

const unsuitableGeneric = runQualifierRulesV1(
  baseCandidate({
    candidateType: "vaad_bayit",
    organizationName: "מדריך משפטי",
    city: "",
    publicNotes: "מדריך כללי על חוק המקרקעין — כל זכות אינה ייעוץ משפטי.",
    sourceTitle: "חוק המקרקעין",
    sourceSnippet: "מדריך כללי — כל זכות.",
    scoreRationale: "מדריך.",
    matchScore: 40,
    rawEvidence: [
      { field: "organizationName", value: "מדריך", sourceUrl: "https://example.com/g" },
    ],
  })
);
assert(unsuitableGeneric.verdict === "unsuitable", "generic article → unsuitable");

const weakEvidence = runQualifierRulesV1(
  baseCandidate({
    matchScore: 42,
    rawEvidence: [],
    publicNotes: "",
    organizationName: "חברה",
  })
);
assert(
  weakEvidence.verdict === "review" || weakEvidence.verdict === "unsuitable",
  "insufficient evidence → review or unsuitable"
);

const rerun1 = runQualifierRulesV1(baseCandidate());
const rerun2 = runQualifierRulesV1(baseCandidate());
assert(
  rerun1.verdict === rerun2.verdict && rerun1.reason === rerun2.reason,
  "rerun QUALIFIER is deterministic"
);

console.log(`\nResult: ${failed === 0 ? "PASS" : "FAIL"} (${failed} failed)\n`);
process.exit(failed === 0 ? 0 : 1);
