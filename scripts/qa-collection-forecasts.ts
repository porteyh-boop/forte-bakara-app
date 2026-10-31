/**
 * Collection forecast QA — domain rules, migration, API boundaries, screen wiring.
 * Run: npx tsx scripts/qa-collection-forecasts.ts
 */
import fs from "fs";
import path from "path";
import {
  buildCollectionForecastScreenModel,
  buildMovedForecastFields,
  canDeleteCollectionForecast,
  canMoveCollectionForecast,
  collectionForecastStatusLabel,
  computeMonthlyForecastSummary,
  describePlannedBalanceExcess,
  evaluatePlannedAmountSave,
  forecastClientLabel,
  isForecastOverdue,
  normalizeForecastMonth,
  parseCollectionForecastCreateBody,
  parseCollectionForecastPatchBody,
  paymentsAvailableToLink,
  shiftDateOnlyByMonths,
  shiftForecastMonth,
  type CollectionForecast,
  type CollectionForecastPaymentRef,
  type ForecastBuildingInput,
} from "../lib/collection-forecasts";
import { COLLECTION_STATUSES } from "../lib/project-financial";
import { MASTER_COLLECTION_FORECAST_PATH } from "../lib/master-project-v2-routes";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${label}`);
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const today = new Date(2026, 9, 31);
const month = "2026-10-01";

function building(
  partial: Partial<ForecastBuildingInput> & Pick<ForecastBuildingInput, "buildingId">
): ForecastBuildingInput {
  return {
    name: partial.name ?? partial.buildingId,
    projectNumber: partial.projectNumber ?? "826101",
    contactName: partial.contactName ?? "יוסי כהן",
    managementCompany: partial.managementCompany ?? "חברת ניהול",
    orderAmount: partial.orderAmount === undefined ? 10000 : partial.orderAmount,
    nextPaymentDate: partial.nextPaymentDate ?? null,
    isActive: partial.isActive ?? true,
    isTrial: partial.isTrial ?? false,
    ...partial,
    buildingId: partial.buildingId,
  };
}

function payment(
  partial: Partial<CollectionForecastPaymentRef> &
    Pick<CollectionForecastPaymentRef, "id" | "buildingId" | "amount">
): CollectionForecastPaymentRef {
  return {
    paymentDate: partial.paymentDate ?? "2026-10-02",
    paymentMethod: partial.paymentMethod ?? "העברה בנקאית",
    notes: partial.notes ?? "",
    ...partial,
  };
}

function forecast(
  partial: Partial<CollectionForecast> &
    Pick<CollectionForecast, "id" | "buildingId" | "plannedAmount">
): CollectionForecast {
  return {
    forecastMonth: month,
    expectedCollectionDate: "2026-10-15",
    status: "planned",
    notes: null,
    linkedPaymentId: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

const fullBalance = buildCollectionForecastScreenModel({
  buildings: [building({ buildingId: "full", name: "בניין מלא" })],
  payments: [],
  forecasts: [],
  today,
});
assert(
  fullBalance.projects.length === 1 &&
    fullBalance.projects[0]?.paidTotal === 0 &&
    fullBalance.projects[0]?.balance === 10000 &&
    fullBalance.projects[0]?.collectionStatus === "טרם שולם" &&
    fullBalance.rows.length === 1 &&
    fullBalance.rows[0]?.forecast == null,
  "פרויקט עם יתרה מלאה מוצג בלי תחזית"
);

const partial = buildCollectionForecastScreenModel({
  buildings: [building({ buildingId: "partial", name: "בניין חלקי" })],
  payments: [payment({ id: "pay-partial", buildingId: "partial", amount: 4000 })],
  forecasts: [],
  today,
});
assert(
  partial.projects[0]?.paidTotal === 4000 &&
    partial.projects[0]?.balance === 6000 &&
    partial.projects[0]?.collectionStatus === "שולם חלקית",
  "פרויקט ששולם חלקית מחשב שולם ויתרה דרך הסיכום הקיים"
);

const splitForecasts = [
  forecast({ id: "f1", buildingId: "partial", plannedAmount: 2000, expectedCollectionDate: "2026-10-10" }),
  forecast({
    id: "f2",
    buildingId: "partial",
    plannedAmount: 1500,
    expectedCollectionDate: "2026-10-25",
    notes: "מועד שני",
  }),
];
const split = buildCollectionForecastScreenModel({
  buildings: [building({ buildingId: "partial", name: "בניין חלקי" })],
  payments: [payment({ id: "pay-partial", buildingId: "partial", amount: 4000 })],
  forecasts: splitForecasts,
  today,
});
assert(
  split.rows.filter((row) => row.project.buildingId === "partial" && row.forecast).length === 2 &&
    split.summary.plannedTotal === 3500,
  "שתי תחזיות לאותו פרויקט ולאותו חודש"
);

const edited = parseCollectionForecastPatchBody({
  plannedAmount: "1800",
  expectedCollectionDate: "2026-10-20",
  notes: "עודכן",
  status: "partially_collected",
  confirmExceedsBalance: false,
});
assert(
  edited?.plannedAmount === 1800 &&
    edited.expectedCollectionDate === "2026-10-20" &&
    edited.notes === "עודכן" &&
    edited.status === "partially_collected",
  "עריכת סכום, תאריך, הערה וסטטוס"
);

const moved = buildMovedForecastFields(splitForecasts[0]!);
assert(
  moved.ok === true &&
    moved.ok &&
    moved.forecastMonth === "2026-11-01" &&
    moved.expectedCollectionDate === "2026-11-10",
  "העברה לחודש הבא מזיזה חודש ותאריך"
);
assert(
  buildMovedForecastFields({
    ...splitForecasts[0]!,
    linkedPaymentId: "pay-partial",
  }).ok === false && canMoveCollectionForecast({ linkedPaymentId: "pay-partial" }) === false,
  "העברה לחודש הבא נחסמת כשיש תשלום מקושר"
);
assert(
  shiftDateOnlyByMonths("2026-01-31", 1) === "2026-02-28" &&
    shiftDateOnlyByMonths("2024-01-31", 1) === "2024-02-29" &&
    shiftForecastMonth("2026-12-01", 1) === "2027-01-01",
  "מעבר בין חודשים שומר על סוף חודש"
);

const linkedForecast = forecast({
  id: "f-link",
  buildingId: "partial",
  plannedAmount: 4000,
  linkedPaymentId: "pay-partial",
  expectedCollectionDate: "2026-10-02",
});
const linkedModel = buildCollectionForecastScreenModel({
  buildings: [building({ buildingId: "partial", name: "בניין חלקי" })],
  payments: [payment({ id: "pay-partial", buildingId: "partial", amount: 4000 })],
  forecasts: [linkedForecast],
  today,
});
assert(
  linkedModel.summary.collectedTotal === 4000 &&
    linkedModel.summary.remainingTotal === 0 &&
    linkedModel.rows[0]?.linkedPayment?.id === "pay-partial",
  "קישור לתשלום קיים מחשב נגבה בפועל בלי לשנות את התשלום"
);
assert(
  canDeleteCollectionForecast(linkedForecast) === false &&
    canDeleteCollectionForecast({ linkedPaymentId: null }) === true,
  "מניעת מחיקת תחזית מקושרת, ומחיקה מותרת בלי קישור"
);

const unlinked = { ...linkedForecast, linkedPaymentId: null };
const afterUnlink = buildCollectionForecastScreenModel({
  buildings: [building({ buildingId: "partial", name: "בניין חלקי" })],
  payments: [payment({ id: "pay-partial", buildingId: "partial", amount: 4000 })],
  forecasts: [unlinked],
  today,
});
assert(
  afterUnlink.summary.collectedTotal === 0 && afterUnlink.payments.length === 1,
  "ביטול קישור לא מוחק את התשלום"
);

const excess = describePlannedBalanceExcess(7500, 6000);
const blocked = evaluatePlannedAmountSave(7500, 6000, false);
const confirmed = evaluatePlannedAmountSave(7500, 6000, true);
assert(
  excess.exceeds &&
    excess.openBalance === 6000 &&
    excess.excess === 1500 &&
    blocked.ok === false &&
    confirmed.ok === true,
  "אזהרה ואישור לסכום גבוה מהיתרה, בלי חסימה אחרי אישור"
);

const overdueForecast = forecast({
  id: "late",
  buildingId: "full",
  plannedAmount: 1000,
  expectedCollectionDate: "2026-10-01",
});
const overdueSummary = computeMonthlyForecastSummary({
  forecasts: [
    overdueForecast,
    forecast({
      id: "late-paid",
      buildingId: "full",
      plannedAmount: 500,
      expectedCollectionDate: "2026-10-01",
      linkedPaymentId: "pay-late",
    }),
    forecast({
      id: "deferred",
      buildingId: "other",
      plannedAmount: 800,
      expectedCollectionDate: "2026-10-01",
      status: "deferred",
    }),
    forecast({
      id: "future",
      buildingId: "other",
      plannedAmount: 700,
      expectedCollectionDate: "2026-10-31",
    }),
  ],
  payments: [payment({ id: "pay-late", buildingId: "full", amount: 200 })],
  today,
});
assert(
  overdueSummary.plannedTotal === 3000 &&
    overdueSummary.collectedTotal === 200 &&
    overdueSummary.remainingTotal === 2800 &&
    overdueSummary.overdueTotal === 1300 &&
    overdueSummary.clientCount === 2 &&
    isForecastOverdue(overdueForecast, new Map(), today) &&
    !isForecastOverdue(
      { ...overdueForecast, status: "deferred" },
      new Map(),
      today
    ),
  "כרטיסי החודש: מתוכנן, נגבה, נותר, איחור ולקוחות ייחודיים"
);

const hidden = buildCollectionForecastScreenModel({
  buildings: [
    building({ buildingId: "paid", name: "שולם", orderAmount: 10000 }),
    building({ buildingId: "trial", name: "ניסיון", isTrial: true }),
    building({ buildingId: "inactive", name: "כבוי", isActive: false }),
    building({ buildingId: "none", name: "בלי סכום", orderAmount: null }),
    building({
      buildingId: "credit",
      name: "זכות",
      orderAmount: 10000,
      contactName: "   ",
      managementCompany: "ועד הבית",
    }),
  ],
  payments: [
    payment({ id: "pay-paid", buildingId: "paid", amount: 10000 }),
    payment({ id: "pay-credit", buildingId: "credit", amount: 12000 }),
  ],
  forecasts: [
    forecast({ id: "kept", buildingId: "paid", plannedAmount: 100 }),
  ],
  today,
});
assert(
  hidden.projects.some((project) => project.buildingId === "paid") &&
    !hidden.projects.some((project) => project.buildingId === "trial") &&
    !hidden.projects.some((project) => project.buildingId === "inactive") &&
    !hidden.projects.some((project) => project.buildingId === "none") &&
    !hidden.projects.some((project) => project.buildingId === "credit") &&
    hidden.projects.find((project) => project.buildingId === "paid")?.collectionStatus ===
      "שולם במלואו",
  "מוסתרים ניסיון, לא פעיל, בלי סכום הזמנה, ובלי יתרה כשאין תחזית"
);

const withCreditForecast = buildCollectionForecastScreenModel({
  buildings: [
    building({
      buildingId: "credit",
      name: "זכות",
      contactName: "   ",
      managementCompany: "ועד הבית",
    }),
  ],
  payments: [payment({ id: "pay-credit", buildingId: "credit", amount: 12000 })],
  forecasts: [forecast({ id: "credit-f", buildingId: "credit", plannedAmount: 100 })],
  today,
});
assert(
  withCreditForecast.projects[0]?.balance === 0 &&
    withCreditForecast.projects[0]?.creditBalance === 2000 &&
    withCreditForecast.projects[0]?.paidTotal === 12000 &&
    forecastClientLabel("   ", "ועד הבית") === "ועד הבית" &&
    forecastClientLabel("דנה", "ועד הבית") === "דנה",
  "יתרת זכות ושם לקוח: איש קשר, ואם ריק חברת ניהול"
);

assert(
  normalizeForecastMonth("2026-10") === "2026-10-01" &&
    normalizeForecastMonth("2026-10-31") === "2026-10-01" &&
    normalizeForecastMonth("2026-02-31") == null &&
    normalizeForecastMonth("2026-13") == null,
  "forecast_month נשמר כיום הראשון בחודש"
);

const created = parseCollectionForecastCreateBody({
  buildingId: "Partial",
  forecastMonth: "2026-10",
  plannedAmount: 500,
  expectedCollectionDate: "2026-10-18",
  notes: "  ",
});
assert(
  created?.buildingId === "partial" &&
    created.forecastMonth === "2026-10-01" &&
    created.status === "planned" &&
    created.notes == null &&
    parseCollectionForecastCreateBody({ plannedAmount: 0 }) == null &&
    parseCollectionForecastPatchBody({ status: "שולם חלקית" }) == null,
  "יצירה תקינה ודחיית סכום או סטטוס לא תקינים"
);

const available = paymentsAvailableToLink(
  [
    payment({ id: "free", buildingId: "partial", amount: 100 }),
    payment({ id: "taken", buildingId: "partial", amount: 100 }),
    payment({ id: "other", buildingId: "full", amount: 100 }),
  ],
  [
    forecast({ id: "a", buildingId: "partial", plannedAmount: 100, linkedPaymentId: "taken" }),
    forecast({ id: "b", buildingId: "partial", plannedAmount: 100, linkedPaymentId: "free" }),
  ],
  "partial",
  "b"
);
assert(
  available.map((item) => item.id).join(",") === "free",
  "תשלום שכבר מקושר לתחזית אחרת לא מוצע שוב"
);

assert(
  collectionForecastStatusLabel("partially_collected") === "נגבה חלקית" &&
    !COLLECTION_STATUSES.includes(
      collectionForecastStatusLabel("planned") as (typeof COLLECTION_STATUSES)[number]
    ) &&
    collectionForecastStatusLabel("fully_collected") !== "שולם במלואו",
  "סטטוס התחזית נפרד מסטטוס הגבייה של הפרויקט"
);

const migration = read("supabase/migrations/057_collection_forecasts.sql");
assert(
  migration.includes("create table if not exists public.collection_forecasts") &&
    migration.includes("planned_amount > 0") &&
    migration.includes("extract(day from forecast_month) = 1") &&
    migration.includes("on delete cascade") &&
    migration.includes("on delete restrict") &&
    migration.includes("partially_collected") &&
    migration.includes("fully_collected") &&
    migration.includes("deferred") &&
    migration.includes("idx_collection_forecasts_building_id") &&
    migration.includes("idx_collection_forecasts_forecast_month") &&
    migration.includes("idx_collection_forecasts_expected_collection_date") &&
    migration.includes("idx_collection_forecasts_linked_payment_id") &&
    migration.includes("trg_collection_forecasts_updated_at") &&
    migration.includes("collection_forecast_linked_payment_delete_forbidden") &&
    migration.includes("enable row level security") &&
    migration.includes("revoke all on table public.collection_forecasts from public, anon, authenticated") &&
    migration.includes("grant select, insert, update, delete on table public.collection_forecasts to service_role") &&
    !migration.includes("alter table public.project_payments") &&
    !/unique\s*\(\s*building_id\s*,\s*forecast_month\s*\)/i.test(migration),
  "Migration 057: טבלה, סטטוסים, אינדקסים, RLS, בלי שינוי project_payments"
);

const server = read("lib/collection-forecasts-server.ts");
const route = read("app/forte/api/collection-forecasts/route.ts");
const itemRoute = read("app/forte/api/collection-forecasts/[forecastId]/route.ts");
const moveRoute = read("app/forte/api/collection-forecasts/[forecastId]/move/route.ts");
const linkRoute = read("app/forte/api/collection-forecasts/[forecastId]/link/route.ts");
const guard = read("app/forte/api/collection-forecasts/respond.ts");
const cloud = read("lib/collection-forecasts-cloud.ts");
const view = read("components/master-v2/MasterCollectionForecastView.tsx");
const sidebar = read("components/master-v2/MasterSidebar.tsx");
const businessView = read("components/master-v2/MasterBusinessView.tsx");
const financial = read("lib/project-financial.ts");
const paymentsRoute = read("app/forte/api/project-payments/route.ts");
const css = read("app/forte-v2-design-system.css");

assert(
  server.includes("computeProjectFinancialSummary") === false &&
    read("lib/collection-forecasts.ts").includes("computeProjectFinancialSummary") &&
    financial.includes("export function computeProjectFinancialSummary(") &&
    !/from\(PROJECT_PAYMENTS_TABLE\)[\s\S]{0,120}\.(insert|update|delete)\(/.test(server) &&
    server.includes('.select("id, building_id, amount, payment_date, payment_method, notes")'),
  "השרת קורא תשלומים בלבד ומשתמש בסיכום הקיים דרך שכבת החישוב"
);
assert(
  guard.includes("requireMasterApiSession") &&
    guard.includes("isAllowedForteApiOrigin") &&
    route.includes("guardCollectionForecastRequest") &&
    itemRoute.includes("PATCH") &&
    itemRoute.includes("DELETE") &&
    moveRoute.includes("moveCollectionForecastToNextMonth") &&
    linkRoute.includes("linkCollectionForecastPayment") &&
    linkRoute.includes("unlinkCollectionForecastPayment") &&
    !cloud.includes("service_role") &&
    !paymentsRoute.includes("collection-forecast"),
  "API מאובטח, עם יצירה עריכה מחיקה העברה וקישור, בלי נגיעה ב-API התשלומים"
);
assert(
  MASTER_COLLECTION_FORECAST_PATH === "/master/business/forecast" &&
    sidebar.includes('label: "תחזית גבייה"') &&
    sidebar.includes('id: "collection-forecast"') &&
    /label: "פרויקטים"[\s\S]*label: "מכירות"[\s\S]*label: "עסקי"[\s\S]*label: "תחזית גבייה"/.test(
      sidebar
    ) &&
    fs.existsSync(path.join(process.cwd(), "app/master/business/forecast/page.tsx")) &&
    view.includes('activeItemId="collection-forecast"') &&
    view.includes("data-label") &&
    view.includes("אני מאשר לשמור סכום גבוה מהיתרה הפתוחה") &&
    view.includes("fv2-forecast-table") &&
    css.includes(".fv2-forecast-table") &&
    css.includes("min-width: 768px") &&
    css.includes("max-width: 1279px"),
  "מסך /master/business/forecast בניווט הקיים, RTL דרך המעטפת, וכרטיסים ב-iPad ובטלפון"
);
assert(
  businessView.includes('title="עסקי"') &&
    !businessView.includes("collection-forecast") &&
    !businessView.includes("collection_forecasts"),
  "מסך העסקי הקיים לא השתנה למסלול התחזית"
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
