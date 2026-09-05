/**
 * Focused sales-leads display checks. In-memory only — no Supabase.
 * Run: npx tsx scripts/qa-master-sales-leads.ts
 */
import fs from "fs";
import path from "path";
import {
  applySalesLeadDraft,
  createSyntheticSalesLeads,
  emptySalesLeadDraft,
  filterSalesLeads,
  isFollowUpDueToday,
  isFollowUpOverdue,
  jerusalemCalendarDate,
  shiftCalendarDate,
  summarizeSalesLeads,
  validateSalesLeadDraft,
} from "../lib/sales-leads";

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

const frozenNow = new Date("2026-09-05T10:00:00+03:00");
const today = jerusalemCalendarDate(frozenNow);
const leads = createSyntheticSalesLeads(frozenNow);
const summary = summarizeSalesLeads(leads, today);

console.log("\n=== Sales leads display QA (synthetic, no DB) ===\n");

assert(today === "2026-09-05", "Jerusalem calendar date for frozen instant");
assert(shiftCalendarDate(today, -1) === "2026-09-04", "yesterday is a civil date shift");
assert(summary.newLeads === 2, "summary: two new leads");
assert(summary.followUpsToday === 2, "summary: two open follow-ups today (closed ignored)");
assert(summary.overdueFollowUps === 1, "summary: one open overdue follow-up");
assert(summary.pendingProposals === 1, "summary: one proposal awaiting reply");

const dueToday = filterSalesLeads(leads, "לטיפול היום", today);
assert(
  dueToday.every((lead) => isFollowUpDueToday(lead, today)) &&
    dueToday.length === 2 &&
    !dueToday.some((lead) => lead.status === "זכייה" || lead.status === "לא נסגר"),
  "filter today: open leads only"
);

const overdue = filterSalesLeads(leads, "באיחור", today);
assert(
  overdue.length === 1 &&
    overdue[0].id === "syn-lead-overdue" &&
    isFollowUpOverdue(overdue[0], today),
  "filter overdue: open lead only; closed last-week date excluded"
);

const noDate = filterSalesLeads(leads, "ללא מועד מעקב", today);
assert(
  noDate.length === 2 && noDate.every((lead) => !lead.followUpDate),
  "filter no follow-up date"
);

assert(
  filterSalesLeads(leads, "הכול", today, "דקל").some(
    (lead) => lead.id === "syn-lead-overdue"
  ),
  "search matches synthetic client name"
);

const missingName = validateSalesLeadDraft(emptySalesLeadDraft());
assert(missingName === "שם לקוח הוא שדה חובה.", "create requires client name");

const created = applySalesLeadDraft(
  {
    ...emptySalesLeadDraft(),
    clientName: "לקוח סינתטי נוסף",
    status: "חדש",
    note: "הערה ראשונה",
  },
  null,
  frozenNow
);
assert(
  created.error == null &&
    created.lead.clientName === "לקוח סינתטי נוסף" &&
    created.lead.history.some((entry) => entry.kind === "created") &&
    created.lead.history.some((entry) => entry.text === "הערה ראשונה"),
  "in-memory create adds history"
);

const sourceFiles = [
  "lib/sales-leads.ts",
  "components/master-v2/MasterSalesLeadsView.tsx",
  "app/master/sales/page.tsx",
  "components/master-v2/MasterSidebar.tsx",
  "lib/master-project-v2-routes.ts",
];
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  assert(
    !source.includes("getSupabase") &&
      !source.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !source.includes(".from(\"sales") &&
      !source.includes("createClient"),
    `${file}: no Supabase/sales cloud wiring`
  );
}

const view = fs.readFileSync(
  path.join(process.cwd(), "components/master-v2/MasterSalesLeadsView.tsx"),
  "utf8"
);
const sidebar = fs.readFileSync(
  path.join(process.cwd(), "components/master-v2/MasterSidebar.tsx"),
  "utf8"
);
const routes = fs.readFileSync(
  path.join(process.cwd(), "lib/master-project-v2-routes.ts"),
  "utf8"
);

assert(
  routes.includes('MASTER_SALES_PATH = "/master/sales"') &&
    fs.existsSync(path.join(process.cwd(), "app/master/sales/page.tsx")),
  "route /master/sales exists"
);
assert(
  /label: "פרויקטים"[\s\S]*label: "מכירות"[\s\S]*label: "עסקי"/.test(sidebar) &&
    sidebar.includes("MASTER_SALES_PATH"),
  "sidebar: מכירות after פרויקטים, before עסקי"
);
assert(
  view.includes("מכירות ולידים") &&
    view.includes("פנייה חדשה") &&
    view.includes("תצוגת הדגמה — הנתונים אינם נשמרים בענן") &&
    view.includes("השינויים מתאפסים ברענון") &&
    !view.includes("הצעת מחיר") &&
    !view.includes("המרה לפרויקט"),
  "UI copy + no quote/convert features"
);

console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
