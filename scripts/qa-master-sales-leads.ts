/**
 * Sales leads persistence QA — domain, UI copy, filters, history, close.
 * Run: npx tsx scripts/qa-master-sales-leads.ts
 */
import fs from "fs";
import path from "path";
import {
  applySalesLeadDraft,
  emptySalesLeadDraft,
  filterSalesLeads,
  isFollowUpDueToday,
  isFollowUpOverdue,
  jerusalemCalendarDate,
  shiftCalendarDate,
  summarizeSalesLeads,
  validateSalesLeadDraft,
  SALES_LEAD_CREATED_HISTORY_TEXT,
  type SalesLead,
  type SalesLeadDraft,
} from "../lib/sales-leads";
import {
  mapSalesLeadHistoryRow,
  mapSalesLeadRow,
  parseSalesLeadDraft,
  parseSalesLeadId,
} from "../lib/sales-leads-server";

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

function fixtureLead(
  overrides: Partial<SalesLead> & Pick<SalesLead, "id" | "status" | "followUpDate">
): SalesLead {
  return {
    clientName: overrides.clientName ?? overrides.id,
    buildingName: overrides.buildingName ?? "",
    address: "",
    city: "",
    contactName: overrides.contactName ?? "",
    phone: "",
    email: "",
    needDescription: "",
    serviceType: overrides.serviceType ?? "",
    source: "",
    sourceDetail: "",
    contactChannel: "",
    estimatedValue: overrides.estimatedValue ?? null,
    nextAction: overrides.nextAction ?? "",
    history: overrides.history ?? [],
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: "2026-08-01T08:00:00.000Z",
    ...overrides,
  };
}

const frozenNow = new Date("2026-09-05T10:00:00+03:00");
const today = jerusalemCalendarDate(frozenNow);
const yesterday = shiftCalendarDate(today, -1);
const lastWeek = shiftCalendarDate(today, -7);

const leads: SalesLead[] = [
  fixtureLead({
    id: "lead-new-today",
    clientName: "לקוח חדש",
    status: "חדש",
    followUpDate: today,
  }),
  fixtureLead({
    id: "lead-overdue",
    clientName: "לקוח דקל",
    status: "נוצר קשר",
    followUpDate: yesterday,
  }),
  fixtureLead({
    id: "lead-no-date",
    clientName: "לקוח בלי מעקב",
    status: "בירור-פגישה",
    followUpDate: null,
  }),
  fixtureLead({
    id: "lead-proposal",
    clientName: "לקוח הצעה",
    status: "הצעה נשלחה",
    followUpDate: shiftCalendarDate(today, 1),
  }),
  fixtureLead({
    id: "lead-won",
    clientName: "לקוח שנסגר בזכייה",
    status: "זכייה",
    followUpDate: today,
  }),
  fixtureLead({
    id: "lead-lost",
    clientName: "לקוח שלא נסגר",
    status: "לא נסגר",
    followUpDate: lastWeek,
  }),
  fixtureLead({
    id: "lead-new-nodate",
    clientName: "פנייה חדשה בלי תאריך",
    status: "חדש",
    followUpDate: null,
  }),
];

const summary = summarizeSalesLeads(leads, today);

console.log("\n=== Sales leads persistence QA ===\n");

assert(today === "2026-09-05", "Jerusalem calendar date for frozen instant");
assert(shiftCalendarDate(today, -1) === "2026-09-04", "yesterday is a civil date shift");
assert(summary.newLeads === 2, "summary: two new leads");
assert(summary.followUpsToday === 1, "summary: one open follow-up today (closed ignored)");
assert(summary.overdueFollowUps === 1, "summary: one open overdue follow-up");
assert(summary.pendingProposals === 1, "summary: one proposal awaiting reply");

const dueToday = filterSalesLeads(leads, "לטיפול היום", today);
assert(
  dueToday.every((lead) => isFollowUpDueToday(lead, today)) &&
    dueToday.length === 1 &&
    !dueToday.some((lead) => lead.status === "זכייה" || lead.status === "לא נסגר"),
  "filter today: open leads only"
);

const overdue = filterSalesLeads(leads, "באיחור", today);
assert(
  overdue.length === 1 &&
    overdue[0].id === "lead-overdue" &&
    isFollowUpOverdue(overdue[0], today),
  "filter overdue: open lead only; closed last-week date excluded"
);

const noDate = filterSalesLeads(leads, "ללא מועד מעקב", today);
assert(
  noDate.length === 2 && noDate.every((lead) => !lead.followUpDate),
  "filter no follow-up date"
);

assert(
  filterSalesLeads(leads, "הכול", today, "דקל").some((lead) => lead.id === "lead-overdue"),
  "search matches client name"
);

assert(
  validateSalesLeadDraft(emptySalesLeadDraft()) === "שם לקוח הוא שדה חובה.",
  "create requires client name"
);

const created = applySalesLeadDraft(
  {
    ...emptySalesLeadDraft(),
    clientName: "לקוח חדש לבדיקה",
    status: "חדש",
    note: "הערה ראשונה",
  },
  null,
  frozenNow
);
assert(
  created.error == null &&
    created.lead.clientName === "לקוח חדש לבדיקה" &&
    created.newHistory.some((entry) => entry.kind === "created") &&
    created.newHistory.some((entry) => entry.text === "הערה ראשונה") &&
    created.lead.history.some((entry) => entry.text === SALES_LEAD_CREATED_HISTORY_TEXT),
  "create adds created history + note"
);
assert(
  !created.lead.history.some((entry) => entry.text.includes("הדגמה")) &&
    !created.lead.id.startsWith("syn-lead"),
  "create history has no demo copy"
);

const edited = applySalesLeadDraft(
  {
    ...emptySalesLeadDraft(),
    clientName: "לקוח דקל",
    status: "משא ומתן",
    followUpDate: today,
    note: "עודכן מועד מעקב",
  },
  leads.find((lead) => lead.id === "lead-overdue") ?? null,
  frozenNow
);
assert(
  edited.error == null &&
    edited.lead.id === "lead-overdue" &&
    edited.lead.status === "משא ומתן" &&
    edited.lead.followUpDate === today &&
    edited.newHistory.some((entry) => entry.kind === "status") &&
    edited.newHistory.some((entry) => entry.text === "עודכן מועד מעקב"),
  "edit updates status, follow-up date, and history"
);

const closed = applySalesLeadDraft(
  {
    ...emptySalesLeadDraft(),
    clientName: "לקוח דקל",
    status: "זכייה",
    followUpDate: today,
  },
  edited.lead,
  frozenNow
);
const afterClose = [...leads.filter((lead) => lead.id !== "lead-overdue"), closed.lead];
assert(
  closed.error == null &&
    closed.lead.status === "זכייה" &&
    filterSalesLeads(afterClose, "לטיפול היום", today).every(
      (lead) => lead.id !== "lead-overdue"
    ) &&
    !isFollowUpDueToday(closed.lead, today),
  "closing a lead removes it from open follow-up filters"
);

assert(
  parseSalesLeadId("4ba8319f-4a27-43e3-b025-66116aaaaaaa") !== null &&
    parseSalesLeadId("not-a-uuid") === null &&
    parseSalesLeadId("syn-lead-overdue") === null,
  "parseSalesLeadId accepts UUID only"
);

const draft = parseSalesLeadDraft({
  clientName: "  שם  ",
  status: "חדש",
  estimatedValue: "12",
  note: "x",
} satisfies Partial<SalesLeadDraft> & Record<string, unknown>);
assert(
  draft?.clientName === "  שם  " && draft.status === "חדש" && draft.note === "x",
  "parseSalesLeadDraft reads camelCase body"
);
assert(parseSalesLeadDraft({ status: "לא-קיים" }) === null, "parseSalesLeadDraft rejects bad status");

const mapped = mapSalesLeadRow(
  {
    id: "11111111-1111-4111-8111-111111111111",
    client_name: "ממופה",
    building_name: "בניין",
    address: "כתובת",
    city: "עיר",
    contact_name: "איש",
    phone: "050",
    email: "a@b.c",
    need_description: "צורך",
    service_type: "ייעוץ",
    source: "אתר",
    source_detail: "",
    contact_channel: "טלפון",
    status: "חדש",
    estimated_value: "1500",
    next_action: "שיחה",
    follow_up_date: "2026-09-05",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z",
  },
  [
    mapSalesLeadHistoryRow({
      id: "h1",
      occurred_at: "2026-09-01T00:00:00.000Z",
      kind: "created",
      entry_text: SALES_LEAD_CREATED_HISTORY_TEXT,
      status: "חדש",
    }),
  ]
);
assert(
  mapped.clientName === "ממופה" &&
    mapped.estimatedValue === 1500 &&
    mapped.followUpDate === "2026-09-05" &&
    mapped.history[0]?.text === SALES_LEAD_CREATED_HISTORY_TEXT,
  "server row mapper uses camelCase + history"
);

const productFiles = [
  "lib/sales-leads.ts",
  "lib/sales-leads-api.ts",
  "components/master-v2/MasterSalesLeadsView.tsx",
  "app/master/sales/page.tsx",
];
for (const file of productFiles) {
  const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  assert(
    !source.includes("createSyntheticSalesLeads") &&
      !source.includes("syn-lead") &&
      !source.includes("תצוגת הדגמה") &&
      !source.includes("שמירה בהדגמה"),
    `${file}: no synthetic/demo leftovers`
  );
}

const view = fs.readFileSync(
  path.join(process.cwd(), "components/master-v2/MasterSalesLeadsView.tsx"),
  "utf8"
);
const apiClient = fs.readFileSync(
  path.join(process.cwd(), "lib/sales-leads-api.ts"),
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
  /label: "פרויקטים"[\s\S]*label: "מכירות"[\s\S]*label: "עסקי"/.test(sidebar),
  "sidebar: מכירות after פרויקטים, before עסקי"
);
assert(
  view.includes("מכירות ולידים") &&
    view.includes("פנייה חדשה") &&
    view.includes("אין לידים להצגה") &&
    view.includes("עדיין אין פניות. פתחו פנייה חדשה כדי להתחיל.") &&
    view.includes('"שמירה"') &&
    view.includes("listSalesLeads") &&
    view.includes("createSalesLead") &&
    view.includes("updateSalesLead") &&
    !view.includes("הצעת מחיר") &&
    !view.includes("המרה לפרויקט"),
  "UI: persistent copy, empty state, no quote/convert"
);
assert(
  apiClient.includes("/forte/api/master-sales-leads") &&
    apiClient.includes("credentials") === false &&
    apiClient.includes("masterApiFetch"),
  "browser client calls Master sales API only"
);
assert(
  !apiClient.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !apiClient.includes("getSupabaseServiceClient") &&
    !view.includes("SUPABASE_SERVICE_ROLE_KEY") &&
    !view.includes("getSupabaseServiceClient"),
  "browser sales files have no service role"
);

console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
