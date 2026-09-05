/**
 * Public /lead form → Master + Telegram notifications.
 * Run: npx tsx scripts/qa-sales-lead-notifications.ts
 */
import fs from "fs";
import path from "path";
import {
  buildMasterSalesLeadPath,
  buildMasterSalesLeadPublicUrl,
  buildSalesLeadTelegramMessage,
  escapeTelegramPlainText,
  findNewSalesLeadNotifications,
  parseSalesLeadIdParam,
  pickSalesLeadNotificationPopup,
  salesLeadNotificationTitle,
  SALES_LEAD_MASTER_PUBLIC_ORIGIN,
  SALES_LEAD_NOTIFICATION_TITLE_NEW,
  SALES_LEAD_NOTIFICATION_TITLE_UPDATED,
  type SalesLeadNotificationRecord,
} from "../lib/sales-lead-notifications";
import { buildSalesLeadTelegramPayload } from "../lib/sales-lead-notifications-telegram";
import {
  emptySimulatedPublicFormStore,
  simulateParallelPublicSalesLeadSubmits,
  simulateSendSalesLeadTelegramOnce,
  simulateSubmitPublicSalesLeadForm,
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

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function fixtureNotification(
  overrides: Partial<SalesLeadNotificationRecord> &
    Pick<SalesLeadNotificationRecord, "id" | "leadId">
): SalesLeadNotificationRecord {
  return {
    submissionKey: overrides.submissionKey ?? overrides.id,
    eventKind: overrides.eventKind ?? "new_lead",
    clientName: overrides.clientName ?? "ועד",
    contactName: overrides.contactName ?? "ישראל",
    phone: overrides.phone ?? "0501234567",
    email: overrides.email ?? "",
    buildingName: overrides.buildingName ?? "",
    address: overrides.address ?? "",
    city: overrides.city ?? "",
    serviceType: overrides.serviceType ?? "",
    needDescription: overrides.needDescription ?? "",
    preferredContact: overrides.preferredContact ?? "",
    createdAt: overrides.createdAt ?? "2026-09-05T15:00:00.000Z",
    readAt: overrides.readAt ?? null,
    telegramStatus: overrides.telegramStatus ?? "pending",
    telegramAttemptedAt: overrides.telegramAttemptedAt ?? null,
    telegramError: overrides.telegramError ?? null,
    ...overrides,
  };
}

console.log("\n=== Sales lead notifications QA ===\n");

assert(
  salesLeadNotificationTitle("new_lead") === SALES_LEAD_NOTIFICATION_TITLE_NEW,
  "new lead title"
);
assert(
  salesLeadNotificationTitle("updated_lead") ===
    SALES_LEAD_NOTIFICATION_TITLE_UPDATED,
  "updated lead title"
);
assert(
  parseSalesLeadIdParam("not-a-uuid") === null &&
    parseSalesLeadIdParam("3fa85f64-5717-4562-b3fc-2c963f66afa6") ===
      "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "leadId validation"
);
assert(
  buildMasterSalesLeadPath("3fa85f64-5717-4562-b3fc-2c963f66afa6") ===
    "/master/sales?leadId=3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "sales deep-link path"
);
assert(
  buildMasterSalesLeadPublicUrl("3fa85f64-5717-4562-b3fc-2c963f66afa6").startsWith(
    SALES_LEAD_MASTER_PUBLIC_ORIGIN
  ),
  "telegram button uses production origin"
);

const telegramText = buildSalesLeadTelegramMessage({
  eventKind: "new_lead",
  clientName: "ועד <script>",
  contactName: "ישראל",
  phone: "050-1234567",
  email: "a@example.com",
  buildingName: "הרצל",
  address: "הרצל 1",
  city: "חולון",
  serviceType: "בדק בית",
  needDescription: "רעש במעלית",
  preferredContact: "מועד מועדף: בוקר",
});
assert(telegramText.startsWith("🔔 פנייה חדשה התקבלה"), "telegram new title");
assert(telegramText.includes("שם הלקוח/החברה:"), "telegram client label");
assert(telegramText.includes("מועד מועדף לחזרה: בוקר"), "telegram preferred time");
assert(
  escapeTelegramPlainText("hi\u0000there\r\nnow", 20) === "hithere\nnow",
  "telegram escapes control chars"
);

const telegramUpdated = buildSalesLeadTelegramMessage({
  eventKind: "updated_lead",
  clientName: "א",
  contactName: "ב",
  phone: "1",
  email: "",
  buildingName: "",
  address: "",
  city: "",
  serviceType: "",
  needDescription: "",
  preferredContact: "",
});
assert(
  telegramUpdated.startsWith("🔔 התקבלו פרטים נוספים מלקוח"),
  "telegram updated title"
);

const payload = buildSalesLeadTelegramPayload({
  eventKind: "new_lead",
  leadId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  clientName: "ועד",
  contactName: "ישראל",
  phone: "0501234567",
  email: "",
  buildingName: "",
  address: "",
  city: "",
  serviceType: "",
  needDescription: "",
  preferredContact: "",
});
assert(
  payload.replyMarkup.inline_keyboard[0][0].text === "פתח את הפנייה" &&
    payload.replyMarkup.inline_keyboard[0][0].url.includes("leadId="),
  "telegram open button"
);

const previous = [fixtureNotification({ id: "n1", leadId: "l1" })];
const next = [
  fixtureNotification({ id: "n1", leadId: "l1" }),
  fixtureNotification({ id: "n2", leadId: "l2" }),
];
assert(
  findNewSalesLeadNotifications(previous, next).map((item) => item.id).join() ===
    "n2",
  "detect new notification ids"
);
assert(
  pickSalesLeadNotificationPopup(next, new Set(["n2"]))?.id === "n1",
  "popup skips already shown"
);
assert(
  pickSalesLeadNotificationPopup(
    [fixtureNotification({ id: "n3", leadId: "l3", readAt: "2026-09-05T15:01:00.000Z" })],
    new Set()
  ) === null,
  "read notification is not shown again"
);

async function runSubmitNotificationChecks(): Promise<void> {
  const store = emptySimulatedPublicFormStore();
  const form = { phone: "0501234567", email: "a@example.com" };
  const created = await simulateSubmitPublicSalesLeadForm(
    store,
    new Map(),
    "key-new",
    "hash-a",
    form
  );
  assert(
    created.lead_created === true &&
      store.notifications.length === 1 &&
      store.notifications[0].eventKind === "new_lead",
    "new lead creates one new_lead notification"
  );

  const updated = await simulateSubmitPublicSalesLeadForm(
    store,
    new Map(),
    "key-update",
    "hash-b",
    form
  );
  assert(
    updated.lead_created === false &&
      store.leads.length === 1 &&
      store.notifications.length === 2 &&
      store.notifications[1].eventKind === "updated_lead",
    "open lead update creates updated_lead notification"
  );

  const replay = await simulateSubmitPublicSalesLeadForm(
    store,
    new Map(),
    "key-new",
    "hash-a",
    form
  );
  assert(
    replay.already_processed === true && store.notifications.length === 2,
    "same Idempotency-Key does not create another notification"
  );

  const telegramSends: string[] = [];
  const firstSend = simulateSendSalesLeadTelegramOnce(
    store,
    store.notifications[0].id,
    telegramSends
  );
  const secondSend = simulateSendSalesLeadTelegramOnce(
    store,
    store.notifications[0].id,
    telegramSends
  );
  assert(
    firstSend.sent &&
      secondSend.skipped &&
      telegramSends.length === 1 &&
      store.notifications[0].telegramStatus === "sent",
    "telegram is sent once per notification"
  );

  const failStore = emptySimulatedPublicFormStore();
  const telegramAfterFail: string[] = [];
  try {
    await simulateSubmitPublicSalesLeadForm(
      failStore,
      new Map(),
      "key-fail",
      "hash-a",
      form,
      { failAfterLeadInsert: true }
    );
  } catch {
    /* expected */
  }
  assert(
    failStore.leads.length === 0 && failStore.notifications.length === 0,
    "failed submit rolls back notification with the lead"
  );

  const keepStore = emptySimulatedPublicFormStore();
  const kept = await simulateSubmitPublicSalesLeadForm(
    keepStore,
    new Map(),
    "key-keep",
    "hash-a",
    form
  );
  keepStore.notifications[0].telegramStatus = "failed";
  keepStore.notifications[0].telegramAttempts = 1;
  simulateSendSalesLeadTelegramOnce(
    keepStore,
    kept.notification_id ?? "",
    telegramAfterFail
  );
  assert(
    keepStore.leads.length === 1 &&
      keepStore.notifications[0].telegramStatus === "failed" &&
      telegramAfterFail.length === 0,
    "telegram failure does not remove the saved lead"
  );

  const parallelStore = emptySimulatedPublicFormStore();
  await simulateParallelPublicSalesLeadSubmits(
    parallelStore,
    "key-par",
    "hash-a",
    form,
    2
  );
  assert(
    parallelStore.leads.length === 1 && parallelStore.notifications.length === 1,
    "parallel same-key submit creates one notification"
  );
}

const migration = read("supabase/migrations/040_sales_lead_notifications.sql");
assert(
  migration.includes("create table if not exists public.sales_lead_notifications") &&
    migration.includes("insert into public.sales_lead_notifications") &&
    migration.includes("submission_key") &&
    migration.includes("telegram_status") &&
    migration.includes("set search_path = public") &&
    !migration.includes("create_building_atomic"),
  "040 inserts notification inside the submit RPC"
);

const server = read("lib/sales-lead-public-form-server.ts");
assert(
  server.includes("notifyPublicSalesLeadFormTelegram") &&
    server.includes("already_processed") &&
    read("app/api/public/sales-lead/route.ts").includes("return json({ ok: true }") &&
    !read("app/api/public/sales-lead/route.ts").includes("lead_id"),
  "public API stays generic after notify"
);

const salesView = read("components/master-v2/MasterSalesLeadsView.tsx");
const salesPage = read("app/master/sales/page.tsx");
assert(
  salesPage.includes("searchParams") &&
    salesView.includes("parseSalesLeadIdParam") &&
    salesView.includes("openLead(lead)") &&
    salesView.includes("markLeadRead"),
  "sales page opens leadId after master auth"
);

const sidebar = read("components/master-v2/MasterSidebar.tsx");
const shell = read("components/master-v2/MasterShellLayout.tsx");
const provider = read(
  "components/master-v2/MasterSalesLeadNotificationsProvider.tsx"
);
assert(
  shell.includes("MasterSalesLeadNotificationsProvider") &&
    sidebar.includes('item.id === "sales"') &&
    sidebar.includes("fv2-sidebar-item-badge") &&
    provider.includes("visibilitychange") &&
    provider.includes('document.visibilityState !== "visible"') &&
    provider.includes("SALES_LEAD_NOTIFICATIONS_POLL_MS"),
  "Master shell polls and badges מכירות"
);

assert(
  !read("components/public/PublicSalesLeadForm.tsx").includes("TELEGRAM_BOT_TOKEN") &&
    !read("components/master-v2/MasterSalesLeadNotificationsProvider.tsx").includes(
      "TELEGRAM_BOT_TOKEN"
    ) &&
    !read("components/master-v2/MasterSalesLeadNotificationsProvider.tsx").includes(
      "SUPABASE_SERVICE_ROLE_KEY"
    ) &&
    !read("components/master-v2/MasterSidebar.tsx").includes("TELEGRAM_CHAT_ID"),
  "browser code has no service role or telegram secrets"
);

void runSubmitNotificationChecks().then(() => {
  console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
});
