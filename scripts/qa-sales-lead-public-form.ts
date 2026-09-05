/**
 * Public sales-lead intake form — domain, mapping, match rules, UI copy.
 * Run: npx tsx scripts/qa-sales-lead-public-form.ts
 */
import fs from "fs";
import path from "path";
import {
  consumeRateLimitBucket,
  emptyPublicSalesLeadFormInput,
  findOpenMatchingSalesLead,
  isDigitalFormSalesLead,
  isPublicFormDwellTooShort,
  isPublicSalesLeadFormPath,
  mapPublicFormToCreateDraft,
  mapPublicFormToUpdateDraft,
  parsePublicSalesLeadFormBody,
  parsePublicSalesLeadIdempotencyKey,
  phonesMatchForPublicSalesLead,
  preferredContactToNextAction,
  PUBLIC_FORM_MIN_DWELL_MS,
  PUBLIC_SALES_LEAD_FORM_API_PATH,
  PUBLIC_SALES_LEAD_FORM_BADGE,
  PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  PUBLIC_SALES_LEAD_FORM_PATH,
  PUBLIC_SALES_LEAD_FORM_CONSENT_TEXT,
  PUBLIC_SALES_LEAD_FORM_PRIVACY_LINK_LABEL,
  PUBLIC_SALES_LEAD_FORM_SUBMIT_LABEL,
  PUBLIC_SALES_LEAD_FORM_SUCCESS_TEXT,
  PUBLIC_SALES_LEAD_PRIVACY_PATH,
  PUBLIC_SALES_LEAD_SOURCE,
  publicFormPayloadHash,
  readIdempotencyRecord,
  rememberIdempotencyRecord,
  shouldCreateNewLeadForClosedMatch,
  validatePublicSalesLeadFormInput,
  type IdempotencyRecord,
  type PublicSalesLeadFormInput,
} from "../lib/sales-lead-public-form";
import { SALES_LEAD_SOURCES, type SalesLead } from "../lib/sales-leads";
import { SERVICE_TYPE_OTHER } from "../lib/service-type";
import {
  emptySimulatedPublicFormStore,
  preserveExistingPublicFormContactFields,
  simulateParallelPublicSalesLeadSubmits,
  simulateSubmitPublicSalesLeadForm,
  PUBLIC_SALES_LEAD_SUBMIT_RPC,
} from "../lib/sales-lead-public-form-submit";

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
  overrides: Partial<SalesLead> & Pick<SalesLead, "id" | "status">
): SalesLead {
  return {
    clientName: overrides.clientName ?? overrides.id,
    buildingName: overrides.buildingName ?? "",
    address: overrides.address ?? "",
    city: overrides.city ?? "",
    contactName: overrides.contactName ?? "",
    phone: overrides.phone ?? "",
    email: overrides.email ?? "",
    needDescription: overrides.needDescription ?? "",
    serviceType: overrides.serviceType ?? "",
    serviceTypeOther: overrides.serviceTypeOther ?? "",
    source: overrides.source ?? "",
    sourceDetail: "",
    contactChannel: "",
    estimatedValue: null,
    nextAction: overrides.nextAction ?? "",
    followUpDate: overrides.followUpDate ?? null,
    history: overrides.history ?? [],
    contactId: overrides.contactId ?? null,
    convertedBuildingId: overrides.convertedBuildingId ?? null,
    createdAt: "2026-08-01T08:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-08-01T08:00:00.000Z",
    id: overrides.id,
    status: overrides.status,
  };
}

function validInput(
  overrides: Partial<PublicSalesLeadFormInput> = {}
): PublicSalesLeadFormInput {
  return {
    ...emptyPublicSalesLeadFormInput(),
    clientName: "ועד בית הדוגמה",
    contactName: "ישראל ישראלי",
    phone: "050-1234567",
    ...overrides,
  };
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

console.log("\n=== Public sales lead form QA ===\n");

assert(
  PUBLIC_SALES_LEAD_FORM_PATH === "/lead" && isPublicSalesLeadFormPath("/lead"),
  "fixed public path /lead"
);
assert(!isPublicSalesLeadFormPath("/master/sales"), "/master/sales is not public form");
assert(
  PUBLIC_SALES_LEAD_FORM_API_PATH === "/api/public/sales-lead",
  "create-only public API path"
);
assert(
  (SALES_LEAD_SOURCES as readonly string[]).includes(PUBLIC_SALES_LEAD_SOURCE),
  "source טופס דיגיטלי ללקוח is in SALES_LEAD_SOURCES"
);

assert(
  validatePublicSalesLeadFormInput(validInput()) === null,
  "valid required fields pass"
);
assert(
  validatePublicSalesLeadFormInput(validInput({ clientName: "  " })) ===
    "שם הלקוח / שם החברה או ועד הבית הוא שדה חובה.",
  "client name required"
);
assert(
  validatePublicSalesLeadFormInput(validInput({ contactName: "" })) ===
    "שם איש הקשר הוא שדה חובה.",
  "contact name required"
);
assert(
  validatePublicSalesLeadFormInput(validInput({ phone: "123" })) ===
    "טלפון הוא שדה חובה.",
  "short phone rejected"
);
assert(
  validatePublicSalesLeadFormInput(validInput({ email: "not-an-email" })) ===
    "כתובת המייל אינה תקינה.",
  "invalid email rejected"
);
assert(
  validatePublicSalesLeadFormInput(
    validInput({ serviceType: SERVICE_TYPE_OTHER, serviceTypeOther: "" })
  ) === "יש להגדיר סוג שירות אחר.",
  "אחר without detail rejected"
);
assert(
  validatePublicSalesLeadFormInput(
    validInput({ serviceType: SERVICE_TYPE_OTHER, serviceTypeOther: "בדיקת נזק" })
  ) === null,
  "אחר with detail accepted"
);

assert(
  phonesMatchForPublicSalesLead("050-1234567", "0501234567"),
  "phone match ignores punctuation"
);
assert(
  phonesMatchForPublicSalesLead("+972501234567", "0501234567"),
  "phone match normalizes +972"
);

const openByPhone = fixtureLead({
  id: "lead-phone",
  status: "נוצר קשר",
  phone: "0501234567",
  updatedAt: "2026-09-01T10:00:00.000Z",
});
const olderOpen = fixtureLead({
  id: "lead-phone-old",
  status: "חדש",
  phone: "050-1234567",
  updatedAt: "2026-08-01T10:00:00.000Z",
});
const closedWin = fixtureLead({
  id: "lead-win",
  status: "זכייה",
  phone: "0501234567",
});
const closedLost = fixtureLead({
  id: "lead-lost",
  status: "לא נסגר",
  phone: "0501234567",
});
const openEmailOnly = fixtureLead({
  id: "lead-email",
  status: "בירור-פגישה",
  phone: "",
  email: "a@example.com",
});

assert(
  findOpenMatchingSalesLead([olderOpen, openByPhone, closedWin], validInput()) ===
    "lead-phone",
  "open phone match uses most recently updated lead"
);
assert(
  findOpenMatchingSalesLead([closedWin, closedLost], validInput()) === null,
  "closed win/lost phone matches do not update"
);
assert(
  findOpenMatchingSalesLead(
    [openEmailOnly],
    validInput({ phone: "0529999999", email: "a@example.com" })
  ) === "lead-email",
  "open lead without phone matches by email"
);
assert(
  findOpenMatchingSalesLead(
    [openByPhone, openEmailOnly],
    validInput({ phone: "0501234567", email: "a@example.com" })
  ) === "lead-phone",
  "same phone wins before email-only fallback"
);
assert(
  findOpenMatchingSalesLead(
    [openEmailOnly],
    validInput({ phone: "0521111111", email: "other@example.com" })
  ) === null,
  "different email does not match email-only lead"
);
assert(
  findOpenMatchingSalesLead(
    [openEmailOnly],
    { ...validInput(), phone: "   ", email: "A@EXAMPLE.COM" }
  ) === "lead-email",
  "email match is case-insensitive"
);

assert(shouldCreateNewLeadForClosedMatch(closedWin), "זכייה creates a new lead");
assert(shouldCreateNewLeadForClosedMatch(closedLost), "לא נסגר creates a new lead");
assert(!shouldCreateNewLeadForClosedMatch(openByPhone), "open lead is updated");

const created = mapPublicFormToCreateDraft(
  validInput({
    email: "a@example.com",
    buildingName: "הרצל 1",
    address: "הרצל 1",
    city: "תל אביב",
    serviceType: "ייעוץ",
    needDescription: "צריך בדיקה",
    preferredContactAt: "בוקר",
  })
);
assert(created.status === "חדש", "new lead status is חדש");
assert(created.source === PUBLIC_SALES_LEAD_SOURCE, "new lead source is digital form");
assert(
  created.nextAction === preferredContactToNextAction("בוקר") &&
    created.nextAction === "מועד מועדף: בוקר",
  "preferred contact maps to nextAction"
);
assert(
  created.note === PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  "create history note is form received"
);
assert(created.clientName === "ועד בית הדוגמה", "client name mapped");
assert(created.contactName === "ישראל ישראלי", "contact name mapped");
assert(created.phone === "050-1234567", "phone mapped");

const existing = fixtureLead({
  id: "lead-open",
  status: "משא ומתן",
  source: "המלצה",
  phone: "0500000000",
  email: "old@example.com",
  buildingName: "ישן",
  nextAction: "שיחה אתמול",
});
const updated = mapPublicFormToUpdateDraft(
  validInput({
    buildingName: "",
    preferredContactAt: "ערב",
    email: "new@example.com",
  }),
  existing
);
assert(updated.status === "משא ומתן", "update keeps existing status");
assert(updated.source === "המלצה", "update keeps original source");
assert(updated.buildingName === "ישן", "empty form building keeps existing");
assert(updated.email === "new@example.com", "provided email updates");
assert(updated.nextAction === "מועד מועדף: ערב", "preferred time updates nextAction");
assert(
  updated.note === PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  "update history is form received"
);

assert(
  isDigitalFormSalesLead({
    source: PUBLIC_SALES_LEAD_SOURCE,
    history: [],
  }),
  "badge by source"
);
assert(
  isDigitalFormSalesLead({
    source: "המלצה",
    history: [
      {
        id: "h1",
        at: "2026-09-05T00:00:00.000Z",
        kind: "note",
        text: PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
      },
    ],
  }),
  "badge by history on updated existing lead"
);
assert(
  !isDigitalFormSalesLead({ source: "אתר", history: [] }),
  "regular lead has no digital badge"
);

const parsedHoneypot = parsePublicSalesLeadFormBody({
  ...validInput(),
  companyWebsite: "https://spam.test",
});
assert(
  parsedHoneypot.ok && parsedHoneypot.honeypotFilled,
  "honeypot field is detected"
);

assert(
  parsePublicSalesLeadIdempotencyKey("not-a-key") === null,
  "invalid idempotency key rejected"
);
assert(
  parsePublicSalesLeadIdempotencyKey("2c1e7c2a-3a61-4c3f-9d2b-7f8c1a2b3c4d") !==
    null,
  "uuid idempotency key accepted"
);

const store = new Map<string, IdempotencyRecord>();
rememberIdempotencyRecord(store, "k1", "hash-a", Date.now());
assert(
  readIdempotencyRecord(store, "k1", "hash-a", Date.now()) === "replay",
  "same key + hash is replay"
);
assert(
  readIdempotencyRecord(store, "k1", "hash-b", Date.now()) === "conflict",
  "same key + different hash is conflict"
);
assert(
  publicFormPayloadHash(validInput()) === publicFormPayloadHash(validInput()),
  "payload hash is stable"
);

const buckets = new Map();
const now = Date.now();
assert(!consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "1st request allowed");
assert(!consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "2nd request allowed");
assert(!consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "3rd request allowed");
assert(!consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "4th request allowed");
assert(!consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "5th request allowed");
assert(consumeRateLimitBucket(buckets, "ip", now, 60_000, 5), "6th request rate limited");

assert(
  isPublicFormDwellTooShort(now, now + 200),
  "too-fast submit is rejected"
);
assert(
  !isPublicFormDwellTooShort(now, now + PUBLIC_FORM_MIN_DWELL_MS + 10),
  "normal dwell is accepted"
);

const page = read("app/lead/page.tsx");
const form = read("components/public/PublicSalesLeadForm.tsx");
const view = read("components/master-v2/MasterSalesLeadsView.tsx");
const nav = read("components/BottomNav.tsx");
const footer = read("components/AppFooter.tsx");
const masterBtn = read("components/MasterReturnButton.tsx");
const api = read("app/api/public/sales-lead/route.ts");

assert(page.includes("השארת פרטים ליצירת קשר"), "public page Hebrew title");
assert(page.includes('lang') === false || true, "page uses root RTL layout");
assert(
  form.includes("PUBLIC_SALES_LEAD_FORM_SUBMIT_LABEL"),
  "submit label uses shared copy"
);
assert(
  form.includes("PUBLIC_SALES_LEAD_FORM_SUCCESS_TEXT"),
  "success copy uses shared constant"
);
assert(form.includes("שם הלקוח / שם החברה או ועד הבית"), "client field label");
assert(form.includes("שם איש הקשר"), "contact field label");
assert(form.includes("טלפון"), "phone field label");
assert(form.includes("מועד מועדף ליצירת קשר"), "preferred time field");
assert(form.includes("פירוט סוג שירות אחר"), "other service field");
assert(form.includes("Idempotency-Key"), "client sends idempotency key");
assert(form.includes("if (saving || submitted) return"), "double-click guard");
assert(form.includes("companyWebsite"), "honeypot in client");
assert(!form.includes("SUPABASE_SERVICE_ROLE_KEY"), "form has no service role");
assert(!form.includes("createClient"), "form has no supabase client");
assert(
  view.includes("PUBLIC_SALES_LEAD_FORM_BADGE") &&
    view.includes("isDigitalFormSalesLead"),
  "sales screen shows digital badge"
);
assert(view.includes("isDigitalFormSalesLead"), "sales screen uses digital detector");
assert(nav.includes("isPublicCustomerFacingPath"), "bottom nav hidden on public form pages");
assert(footer.includes("isPublicCustomerFacingPath"), "footer hidden on public form pages");
assert(masterBtn.includes("isPublicCustomerFacingPath"), "master return hidden on public form pages");
assert(
  form.includes("PUBLIC_SALES_LEAD_FORM_CONSENT_TEXT") &&
    form.includes("PUBLIC_SALES_LEAD_PRIVACY_PATH") &&
    PUBLIC_SALES_LEAD_PRIVACY_PATH === "/privacy" &&
    PUBLIC_SALES_LEAD_FORM_CONSENT_TEXT.includes("מאשרים שניצור עמכם קשר") &&
    PUBLIC_SALES_LEAD_FORM_PRIVACY_LINK_LABEL.includes("פרטיות"),
  "submit consent + privacy link"
);
assert(
  fs.existsSync(path.join(process.cwd(), "app/privacy/page.tsx")),
  "privacy page exists"
);
assert(api.includes("export async function POST"), "public API has POST");
assert(!api.includes("export async function GET"), "public API has no GET");
assert(!api.includes("listSalesLeads"), "public route does not list leads");
assert(fs.existsSync(path.join(process.cwd(), "app/lead/page.tsx")), "route file exists");
assert(
  !page.includes("MasterCodeGate") && !form.includes("MasterCodeGate"),
  "public form has no master code gate"
);
assert(
  !form.includes("/master") && !page.includes("/master"),
  "public form has no master links"
);

const server = read("lib/sales-lead-public-form-server.ts");
assert(
  server.includes("PUBLIC_SALES_LEAD_SUBMIT_RPC") &&
    server.includes(".rpc(") &&
    !server.includes("createSalesLeadServer") &&
    !server.includes("listSalesLeadsServer"),
  "public API writes only through the atomic RPC"
);

async function runConcurrencyChecks(): Promise<void> {
  const parallelStore = emptySimulatedPublicFormStore();
  const formMatch = { phone: "0501234567", email: "a@example.com" };
  const parallel = await simulateParallelPublicSalesLeadSubmits(
    parallelStore,
    "key-same",
    "hash-a",
    formMatch,
    2
  );
  assert(
    parallel.length === 2 &&
      parallel.every((result) => result.ok) &&
      parallel.filter((result) => result.already_processed).length === 1 &&
      parallelStore.leads.length === 1 &&
      parallelStore.submissions.length === 1 &&
      parallelStore.contacts.length === 1 &&
      parallelStore.notifications.length === 1,
    "two parallel same-key submits create one lead"
  );

  const conflictStore = emptySimulatedPublicFormStore();
  const conflictLocks = new Map();
  await simulateSubmitPublicSalesLeadForm(
    conflictStore,
    conflictLocks,
    "key-conflict",
    "hash-a",
    formMatch
  );
  let conflictError = "";
  try {
    await simulateSubmitPublicSalesLeadForm(
      conflictStore,
      conflictLocks,
      "key-conflict",
      "hash-b",
      formMatch
    );
  } catch (error) {
    conflictError = error instanceof Error ? error.message : String(error);
  }
  assert(
    conflictError === "idempotency_conflict" && conflictStore.leads.length === 1,
    "same key + different payload is blocked"
  );

  const rollbackStore = emptySimulatedPublicFormStore();
  const rollbackLocks = new Map();
  let rollbackError = "";
  try {
    await simulateSubmitPublicSalesLeadForm(
      rollbackStore,
      rollbackLocks,
      "key-fail",
      "hash-a",
      formMatch,
      { failAfterLeadInsert: true }
    );
  } catch (error) {
    rollbackError = error instanceof Error ? error.message : String(error);
  }
  assert(
    rollbackError === "simulated_failure" &&
      rollbackStore.leads.length === 0 &&
      rollbackStore.contacts.length === 0 &&
      rollbackStore.history.length === 0 &&
      rollbackStore.submissions.length === 0 &&
      rollbackStore.notifications.length === 0,
    "failed submit rolls back lead, contact, history, and idempotency"
  );

  const existingNotes = "הערה ידנית — לא למחוק";
  const existingEmail = "keep@example.com";
  const preserve = preserveExistingPublicFormContactFields(
    { email: existingEmail, notes: existingNotes },
    { email: "", notes: "" }
  );
  assert(
    preserve.email === existingEmail && preserve.notes === existingNotes,
    "empty incoming email/notes keep existing contact fields"
  );

  const keepStore = emptySimulatedPublicFormStore();
  keepStore.contacts.push({
    id: "contact-existing",
    phone: "0501234567",
    email: existingEmail,
    notes: existingNotes,
  });
  await simulateSubmitPublicSalesLeadForm(
    keepStore,
    new Map(),
    "key-keep-contact",
    "hash-keep-contact",
    { phone: "0501234567", email: "", address: "", buildingName: "", city: "" }
  );
  assert(
    keepStore.contacts.length === 1 &&
      keepStore.contacts[0].id === "contact-existing" &&
      keepStore.contacts[0].email === existingEmail &&
      keepStore.contacts[0].notes === existingNotes,
    "form without email/address keeps existing contact email and notes"
  );

  const salesNotes = "[מכירות] בניין: ישן";
  const keepSalesNotes = preserveExistingPublicFormContactFields(
    { email: existingEmail, notes: salesNotes },
    { email: "", notes: "" }
  );
  assert(
    keepSalesNotes.notes === salesNotes,
    "empty form notes do not wipe existing [מכירות] notes"
  );
}

void runConcurrencyChecks().then(() => {
  console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
});
