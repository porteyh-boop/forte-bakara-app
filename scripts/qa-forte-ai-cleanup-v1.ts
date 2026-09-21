/**
 * FORTE AI cleanup — safety wiring QA (static).
 */
import fs from "fs";
import path from "path";

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

console.log("\n=== FORTE AI Cleanup v1 QA ===\n");

const migration048 = read("supabase/migrations/048_scout_lead_candidates.sql");
assert(
  migration048.includes("sales_lead_id uuid references public.sales_leads (id) on delete set null"),
  "048 sales_lead FK does not cascade delete to sales_leads"
);
assert(
  migration048.includes("on delete cascade"),
  "048 task_id cascades to candidates only"
);

const migration050 = read("supabase/migrations/050_forte_ai_content_outreach_drafts.sql");
assert(
  migration050.includes("scout_lead_candidates (id) on delete cascade"),
  "050 drafts cascade with candidate not sales_leads"
);

const cleanup = read("lib/scout/scout-cleanup-server.ts");
assert(cleanup.includes("deleteScoutTaskServer"), "delete task server");
assert(cleanup.includes('status === "running"'), "blocks running task delete");
assert(cleanup.includes("deleteScoutCandidateServer"), "delete candidate server");
assert(!cleanup.includes('.from("sales_leads")'), "cleanup server does not delete sales_leads table");
assert(cleanup.includes("scout_task_deleted"), "audit scout_task_deleted");
assert(cleanup.includes("scout_candidate_deleted"), "audit candidate_deleted");

const content = read("lib/content/content-server.ts");
assert(content.includes("deleteContentOutreachDraftServer"), "delete draft server");
assert(content.includes("content_draft_deleted"), "audit content_draft_deleted");
assert(
  !content.match(/deleteContentOutreachDraftServer[\s\S]*review_status/),
  "draft delete does not touch review_status"
);

const ui = read("components/master-v2/MasterForteAiScoutSection.tsx");
assert(ui.includes("ForteV2DialogOverlay"), "confirmation dialogs");
assert(ui.includes("מחק משימה"), "delete task UI");
assert(ui.includes("מחק מועמד"), "delete candidate UI");
assert(ui.includes("מחק טיוטה"), "delete draft UI");
assert(ui.includes("נקה משימות"), "bulk task cleanup UI");
assert(!ui.includes("supabase.from"), "no client direct DB delete");

const display = read("lib/forte-ai-display-he.ts");
assert(display.includes('active: "פעיל"'), "capability active label");
assert(display.includes("FORTE_AI_AGENT_CAPABILITY_ACTIVE"), "capability map");

console.log("\n--- Summary ---");
if (failed > 0) {
  console.error(`FAILED: ${failed}\n`);
  process.exit(1);
}
console.log("PASS: Cleanup v1 QA\n");
