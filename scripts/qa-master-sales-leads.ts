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
  buildSalesContactInput,
  findSalesContactByPhoneThenEmail,
  mergeSalesContactNotes,
  missingWinProjectFields,
  salesLeadCanSyncContact,
  salesWinMissingFieldLabel,
} from "../lib/sales-lead-ops";
import {
  simulateConvertSalesLeadWinToProject,
  simulateParallelSalesLeadWinConverts,
  SALES_WIN_CONVERT_RPC,
} from "../lib/sales-lead-win-convert";
import {
  mapSalesLeadHistoryRow,
  mapSalesLeadRow,
  parseSalesLeadDraft,
  parseSalesLeadId,
} from "../lib/sales-leads-server";
import type { Contact } from "../lib/contacts";

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
    contactId: overrides.contactId ?? null,
    convertedBuildingId: overrides.convertedBuildingId ?? null,
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
    contact_id: "22222222-2222-4222-8222-222222222222",
    converted_building_id: "826101",
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
    mapped.contactId === "22222222-2222-4222-8222-222222222222" &&
    mapped.convertedBuildingId === "826101" &&
    mapped.history[0]?.text === SALES_LEAD_CREATED_HISTORY_TEXT,
  "server row mapper uses camelCase + history + link fields"
);

const productFiles = [
  "lib/sales-leads.ts",
  "lib/sales-leads-api.ts",
  "lib/sales-lead-ops.ts",
  "lib/sales-lead-ops-server.ts",
  "lib/sales-lead-win-convert.ts",
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
    view.includes("נפתח פרויקט") &&
    view.includes("פתח כרטיס") &&
    view.includes("השלמת פרטים לפרויקט") &&
    view.includes("buildMasterProjectV2Path") &&
    !view.includes("הצעת מחיר") &&
    !view.includes("המרה לפרויקט"),
  "UI: persistent copy, win-project banner, no quote module"
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
    !view.includes("getSupabaseServiceClient") &&
    !apiClient.includes(SALES_WIN_CONVERT_RPC) &&
    !view.includes(SALES_WIN_CONVERT_RPC),
  "browser sales files have no service role or win RPC"
);

const linked = applySalesLeadDraft(
  {
    ...emptySalesLeadDraft(),
    clientName: "לקוח דקל",
    status: "משא ומתן",
    contactName: "דנה",
    phone: "050-1111111",
  },
  {
    ...closed.lead,
    contactId: "33333333-3333-4333-8333-333333333333",
    convertedBuildingId: "826199",
  },
  frozenNow
);
assert(
  linked.error == null &&
    linked.lead.contactId === "33333333-3333-4333-8333-333333333333" &&
    linked.lead.convertedBuildingId === "826199" &&
    linked.lead.status === "משא ומתן",
  "edit after conversion keeps contact + project ids and does not clear them"
);

assert(
  salesLeadCanSyncContact({
    contactName: "דנה",
    phone: "050",
    email: "",
  }) &&
    salesLeadCanSyncContact({
      contactName: "דנה",
      phone: "",
      email: "dana@example.com",
    }) &&
    !salesLeadCanSyncContact({ contactName: "דנה", phone: "", email: "" }) &&
    !salesLeadCanSyncContact({ contactName: "", phone: "050", email: "" }),
  "contact sync requires name and phone or email"
);

const existingContacts: Contact[] = [
  {
    id: "c-email",
    fullName: "מייל קיים",
    company: "א",
    roleTitle: "",
    phone: "052-9999999",
    email: "same@example.com",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c-phone",
    fullName: "טלפון קיים",
    company: "ב",
    roleTitle: "",
    phone: "050-1234567",
    email: "other@example.com",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
assert(
  findSalesContactByPhoneThenEmail(
    { phone: "0501234567", email: "same@example.com" },
    existingContacts
  )?.id === "c-phone",
  "identify existing contact by phone before email"
);
assert(
  findSalesContactByPhoneThenEmail(
    { phone: "", email: "same@example.com" },
    existingContacts
  )?.id === "c-email",
  "fall back to email when phone is empty"
);
assert(
  findSalesContactByPhoneThenEmail(
    { phone: "050-0000000", email: "missing@example.com" },
    existingContacts
  ) === null,
  "no match does not invent a duplicate"
);

const contactInput = buildSalesContactInput({
  contactName: "דנה כהן",
  clientName: "ועד הבית",
  phone: "050-111",
  email: "dana@a.com",
  buildingName: "מגדל הים",
  address: "הרצל 1",
  city: "חיפה",
});
assert(
  contactInput.fullName === "דנה כהן" &&
    contactInput.company === "ועד הבית" &&
    contactInput.phone === "050-111" &&
    contactInput.email === "dana@a.com" &&
    contactInput.notes.includes("בניין: מגדל הים") &&
    contactInput.notes.includes("כתובת: הרצל 1") &&
    contactInput.notes.includes("עיר: חיפה"),
  "contact payload copies name, company, phone, email, building, address, city"
);
assert(
  mergeSalesContactNotes("", "[מכירות] בניין: א") === "[מכירות] בניין: א" &&
    mergeSalesContactNotes("[מכירות] ישן", "[מכירות] חדש") === "[מכירות] חדש" &&
    mergeSalesContactNotes("הערה ידנית", "[מכירות] חדש") === "הערה ידנית",
  "sales notes replace empty/sales notes and keep manual notes"
);

assert(
  missingWinProjectFields({
    status: "זכייה",
    buildingName: "",
    convertedBuildingId: null,
  }).includes("buildingName") &&
    missingWinProjectFields({
      status: "זכייה",
      buildingName: "מגדל",
      convertedBuildingId: null,
    }).length === 0 &&
    missingWinProjectFields({
      status: "זכייה",
      buildingName: "",
      convertedBuildingId: "826101",
    }).length === 0 &&
    missingWinProjectFields({
      status: "חדש",
      buildingName: "",
      convertedBuildingId: null,
    }).length === 0 &&
    salesWinMissingFieldLabel("buildingName") === "שם בניין",
  "win conversion requires building name only before the first project exists"
);

const opsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/sales-lead-ops-server.ts"),
  "utf8"
);
const serverSource = fs.readFileSync(
  path.join(process.cwd(), "lib/sales-leads-server.ts"),
  "utf8"
);
assert(
  opsSource.includes("syncSalesLeadContactServer") &&
    opsSource.includes("SALES_WIN_CONVERT_RPC") &&
    opsSource.includes(".rpc(") &&
    !opsSource.includes("from(BUILDINGS_TABLE).insert") &&
    opsSource.includes("getSupabaseServiceClient") &&
    !opsSource.includes("getPilotSupabaseClient") &&
    serverSource.includes("applySalesLeadSideEffects") &&
    serverSource.includes("contact_id") &&
    serverSource.includes("converted_building_id"),
  "server write path: contact sync + atomic win RPC via service_role only"
);

async function runAtomicWinTests(): Promise<void> {
  const parallelStore = {
    convertedBuildingIdByLead: { "lead-parallel": null as string | null },
    buildingIds: [] as string[],
  };
  let nextSeq = 101;
  const parallelResults = await simulateParallelSalesLeadWinConverts(
    parallelStore,
    "lead-parallel",
    2,
    () => `826${String(nextSeq++).padStart(3, "0")}`
  );
  assert(
    parallelResults.length === 2 &&
      parallelStore.buildingIds.length === 1 &&
      parallelStore.convertedBuildingIdByLead["lead-parallel"] === "826101" &&
      parallelResults.every((result) => result.building_id === "826101") &&
      parallelResults.filter((result) => result.already_converted).length === 1 &&
      parallelResults.filter((result) => !result.already_converted).length === 1,
    "two parallel win conversions create exactly one project"
  );

  const rollbackStore = {
    convertedBuildingIdByLead: { "lead-rollback": null as string | null },
    buildingIds: [] as string[],
  };
  const rollbackLocks = new Map();
  let rollbackFailed = false;
  try {
    await simulateConvertSalesLeadWinToProject(
      rollbackStore,
      rollbackLocks,
      "lead-rollback",
      () => "826777",
      { failAfterInsert: true }
    );
  } catch {
    rollbackFailed = true;
  }
  assert(
    rollbackFailed &&
      rollbackStore.buildingIds.length === 0 &&
      rollbackStore.convertedBuildingIdByLead["lead-rollback"] == null,
    "failed conversion rolls back the partial project"
  );
}

void runAtomicWinTests()
  .catch((error) => {
    failed += 1;
    console.error("  ✗ atomic win tests threw", error);
  })
  .then(() => {
    console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
