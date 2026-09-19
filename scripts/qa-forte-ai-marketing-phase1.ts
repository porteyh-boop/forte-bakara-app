/**
 * Phase 1 QA — FORTE AI Marketing infrastructure (static + optional DB).
 * Run: npx tsx scripts/qa-forte-ai-marketing-phase1.ts
 */
import fs from "fs";
import path from "path";

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

console.log("\n=== FORTE AI Marketing — Phase 1 QA ===\n");

const migration = read("supabase/migrations/047_forte_ai_marketing.sql");
for (const table of [
  "ai_agents",
  "ai_tasks",
  "ai_actions",
  "ai_approvals",
  "marketing_content",
  "marketing_campaigns",
]) {
  assert(migration.includes(`public.${table}`), `migration 047 defines ${table}`);
}
assert(
  migration.includes("references public.sales_leads") &&
    !migration.includes("create table if not exists public.sales_leads"),
  "migration uses sales_leads FK, no duplicate leads table"
);
assert(
  migration.includes("on conflict (agent_key) do update"),
  "migration seeds 6 agents idempotently"
);

const policy = read("lib/forte-ai-marketing.ts");
assert(
  policy.includes("actionTypeRequiresApproval") &&
    policy.includes("publish_content") &&
    policy.includes("send_email"),
  "approval policy covers external actions"
);

const server = read("lib/forte-ai-marketing-server.ts");
assert(
  server.includes("recordAiActionServer") &&
    server.includes("ai_approvals") &&
    server.includes("requires_approval"),
  "server records actions + approvals"
);

const view = read("components/master-v2/MasterForteAiView.tsx");
assert(view.includes("FORTE AI") && view.includes("סוכני שיווק"), "Master AI view RTL shell");
assert(view.includes("אישורים הממתינים ליהודה"), "approvals section for יהודה");

const sidebar = read("components/master-v2/MasterSidebar.tsx");
assert(
  sidebar.includes("FORTE AI") && sidebar.includes("MASTER_FORTE_AI_PATH"),
  "sidebar link FORTE AI"
);

const routes = read("lib/master-project-v2-routes.ts");
assert(routes.includes('MASTER_FORTE_AI_PATH = "/master/ai"'), "route /master/ai");

assert(
  fs.existsSync(path.join(process.cwd(), "app/master/ai/page.tsx")) &&
    fs.existsSync(
      path.join(process.cwd(), "app/forte/api/master/ai-marketing/dashboard/route.ts")
    ),
  "page + dashboard API route exist"
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
