import fs from "fs";
import path from "path";
import { APP_ROLE } from "../lib/config";
import {
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  FORBIDDEN_BRAND_TERMS,
} from "../lib/brand";
import {
  getExpertAnalytics,
  getRecurringFaultsByElevator,
  getRecurringFaultsByType,
  getAverageDowntime,
  getAverageResponseTime,
  getElevatorAvailability,
  getMostProblematicElevator,
  getServiceCompanyRating,
  getTrendAnalysis,
  getAnomalyAlerts,
  getRiskAssessment,
  generateInsights,
  generateActions,
  generateMetrics,
  validateAnalyticsOutput,
} from "../lib/analytics";
import { getExpertPdfData } from "../lib/expert-pdf-data";
import {
  DEFAULT_BUILDING_ID,
  getAllBuildingIds,
  getBuildingDataset,
  getDemoDatasets,
} from "../lib/buildings";
import { faults } from "../lib/data";
import { isExpert } from "../lib/roles";
import {
  buildRuntimeBuildingContext,
  getClientStats,
  getLiveBuildingListItems,
  getOpenFaults,
  getFaultsByType,
  getMonthlyFaultTrend,
} from "../lib/data";
import {
  buildClosedFault,
  faultIndicatesDisabledElevator,
} from "../lib/fault-lifecycle";
import { getFaultLifecycleStats } from "../lib/fault-stats";
import {
  buildFaultFromSubmission,
  generateTicketNumber,
  isReportFormValid,
  mergeFaults,
  getReportsStorageKey,
  getClosuresStorageKey,
  REPORTS_STORAGE_PREFIX,
  CLOSURES_STORAGE_PREFIX,
} from "../lib/report-storage";
import {
  getPilotStorageKeysToRemove,
  removePilotStorageKeys,
  shouldShowPilotResetControls,
  PILOT_RESET_SUCCESS_MESSAGE,
} from "../lib/pilot-reset";
import { SELECTED_BUILDING_KEY } from "../lib/building-storage";
import {
  buildFeedbackFromInput,
  clearAllFeedbackFromStorage,
  clearFeedbackByBuilding,
  getAllFeedbackFromStorage,
  getFeedbackStorageKey,
  readFeedbackFromStorage,
  saveFeedback,
  FEEDBACK_STORAGE_PREFIX,
} from "../lib/feedback-storage";
import { getFeedbackStats } from "../lib/feedback-stats";
import {
  FORBIDDEN_EXTERNAL_REPORT_PHRASES,
  REPORT_MAINTENANCE_RESPONSIBILITY,
  REPORT_PAGE_SUBTITLE,
  REPORT_SAVED_HEADLINE,
  REPORT_SAVED_INFO,
} from "../lib/pilot-copy";
import {
  attachImageToFault,
  canStoreImageInLocalStorage,
  estimateDataUrlBytes,
  formatFileSize,
  MAX_STORED_IMAGE_BYTES,
  type ReportImageAttachment,
} from "../lib/report-image";
import {
  getMasterCode,
  isPilotCloudConfigured,
  PILOT_FAULTS_TABLE,
  PILOT_FEEDBACK_TABLE,
  verifyMasterCode,
  type PilotCloudFault,
} from "../lib/pilot-cloud";
import {
  buildMasterAnalytics,
  calculateBuildingHealthScore,
  calculateBuildingKpis,
  detectRecurringFaults,
  generateClientReportDraft,
} from "../lib/master-analytics";
import {
  canDeleteBuilding,
  canDeleteElevator,
  normalizeBuildingId,
  type CloudBuildingRow,
  type CloudElevatorRow,
} from "../lib/buildings-cloud";
import {
  buildCloudCatalogSnapshot,
  buildDemoCatalogSnapshot,
  setCatalogSnapshot,
} from "../lib/buildings-catalog";
import { DEFAULT_ELEVATOR_COMPANIES } from "../lib/elevator-companies";
import type { FeedbackSubmissionInput } from "../lib/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${message}`);
  } else {
    failed++;
    console.error(`✗ ${message}`);
  }
}

function assertNoInvalidValues(label: string, data: unknown) {
  if (data && typeof data === "object" && "insights" in (data as object)) {
    const errors = validateAnalyticsOutput(data as ReturnType<typeof getExpertAnalytics>);
    assert(errors.length === 0, `${label}: ללא undefined/NaN (${errors.length} שגיאות)`);
    if (errors.length > 0) errors.forEach((e) => console.error(`  → ${e}`));
  } else {
    const json = JSON.stringify(data);
    assert(!json.includes("undefined"), `${label}: ללא undefined`);
    assert(!json.includes("NaN"), `${label}: ללא NaN`);
  }
}

console.log("\n=== QA: פורטה בקרה ===\n");

const defaultCtx = getBuildingDataset(DEFAULT_BUILDING_ID);

// 1. Client has no expert imports on home (structural check)
assert(faults.length === 10, "נתוני דוגמה: 10 תקלות קיימות (ברירת מחדל)");
assert(getAllBuildingIds().length === 6, "ריבוי בניינים: 6 בנייני פיילוט");
assert(
  getLiveBuildingListItems({}, true).every((b) => b.name.length > 0),
  "ריבוי בניינים: לכל בניין יש שם"
);
getAllBuildingIds().forEach((id) => {
  const ctx = getBuildingDataset(id);
  assert(ctx.building.elevatorCount > 0, `בניין ${id}: מעליות קיימות`);
  if (id === "ys34") {
    assert(ctx.faults.length === 0, "בניין ys34: ללא תקלות התחלתיות");
  } else {
    assert(ctx.faults.length > 0, `בניין ${id}: תקלות קיימות`);
  }
  assert(
    ctx.building.buildingCode.length > 0,
    `בניין ${id}: קוד בניין קיים`
  );
  assert(
    ctx.elevators.length === ctx.building.elevatorCount,
    `בניין ${id}: מספר מעליות תואם`
  );
  assert(
    ctx.elevators.every((e) => e.stations > 0),
    `בניין ${id}: לכל מעלית יש תחנות`
  );
});

assert(DEFAULT_BUILDING_ID === "md25", "פיילוט: ברירת מחדל מגדל דוד 25");
assert(
  getBuildingDataset("md25").building.buildingCode === "MD25",
  "פיילוט: קוד MD25"
);
assert(
  getBuildingDataset("md25").elevators.find((e) => e.id === "md25-right")
    ?.stations === 19,
  "פיילוט: מעלית ימין MD25 — 19 תחנות"
);
assert(
  getBuildingDataset("yk20").elevators.length === 4,
  "פיילוט: יערות הכרמל — 4 מעליות"
);
assert(
  getBuildingDataset("mn64").elevators[0].stations === 10,
  "פיילוט: מבצע נחשון — 10 תחנות"
);

const ys34Ctx = getBuildingDataset("ys34");
assert(ys34Ctx.building.buildingCode === "YS34", "פיילוט: קוד YS34");
assert(ys34Ctx.building.name === "ישורון 34", "פיילוט: שם ישורון 34");
assert(ys34Ctx.building.city === "הוד השרון", "פיילוט: עיר הוד השרון");
assert(
  ys34Ctx.building.elevatorCompany === "אלקטרה",
  "פיילוט: YS34 — חברת מעליות אלקטרה"
);
assert(
  ys34Ctx.building.managementCompany === "ועד בית",
  "פיילוט: YS34 — ועד בית"
);
assert(
  ys34Ctx.building.contactPerson === "אלונה באום",
  "פיילוט: YS34 — איש קשר"
);
assert(ys34Ctx.elevators.length === 1, "פיילוט: YS34 — מעלית אחת");
assert(
  ys34Ctx.elevators[0].id === "ys34-main" &&
    ys34Ctx.elevators[0].name === "מעלית ראשית" &&
    ys34Ctx.elevators[0].stations === 5 &&
    ys34Ctx.elevators[0].status === "פעילה",
  "פיילוט: YS34 — מעלית ראשית 5 תחנות פעילה"
);
assert(ys34Ctx.faults.length === 0, "פיילוט: YS34 — 0 תקלות");
const ys34Stats = getClientStats(ys34Ctx);
assert(ys34Stats.openFaults === 0, "פיילוט: YS34 — 0 תקלות פתוחות");
assert(ys34Stats.closedFaults === 0, "פיילוט: YS34 — 0 תקלות סגורות");
assert(ys34Stats.disabledElevators === 0, "פיילוט: YS34 — 0 מעליות מושבתות");
assert(
  getLiveBuildingListItems({}, true).some((b) => b.id === "ys34"),
  "פיילוט: YS34 מופיע ברשימת בניינים"
);
assert(
  fs.existsSync(path.join(process.cwd(), "supabase/migrations/002_seed_pilot_buildings.sql")),
  "פיילוט: seed עתידי Supabase ל-YS34 קיים"
);

// 2. Role gating (דמו ציבורי = client)
assert(typeof isExpert() === "boolean", "isExpert() מחזיר boolean");
assert(
  isExpert() === (APP_ROLE === "expert"),
  `APP_ROLE=${APP_ROLE} תואם ל-isExpert()=${isExpert()}`
);
assert(
  process.env.NEXT_PUBLIC_APP_ROLE !== "expert",
  "דמו: ברירת מחדל client (ללא NEXT_PUBLIC_APP_ROLE=expert)"
);
assert(APP_ROLE === "client", `דמו: APP_ROLE=client (נוכחי: ${APP_ROLE})`);
assert(!isExpert(), "דמו: מסך מומחה מוסתר מלקוח");

// איפוס נתוני פיילוט
assert(
  shouldShowPilotResetControls() === isExpert(),
  "איפוס פיילוט: shouldShowPilotResetControls תואם ל-isExpert"
);
assert(
  !shouldShowPilotResetControls(),
  "איפוס פיילוט: לקוח לא רואה כפתור איפוס"
);
assert(
  isExpert() || !shouldShowPilotResetControls(),
  "איפוס פיילוט: expert רואה כפתור איפוס רק כש-APP_ROLE=expert"
);
function createMockPilotStorage(
  entries: Record<string, string>
): import("../lib/pilot-reset").PilotStorageLike & { snapshot: () => string[] } {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null;
    },
    getItem(k: string) {
      return map.get(k) ?? null;
    },
    removeItem(k: string) {
      map.delete(k);
    },
    snapshot() {
      return Array.from(map.keys());
    },
  };
}
const mockStorage = createMockPilotStorage({
  [getReportsStorageKey("md25")]: "[]",
  [getClosuresStorageKey("md25")]: "{}",
  [getReportsStorageKey("md23")]: "[]",
  [getClosuresStorageKey("md23")]: "{}",
  [SELECTED_BUILDING_KEY]: "md23",
  unrelated: "keep",
});
const allKeysToRemove = getPilotStorageKeysToRemove(mockStorage);
assert(
  allKeysToRemove.includes(getReportsStorageKey("md25")) &&
    allKeysToRemove.includes(getClosuresStorageKey("md23")) &&
    allKeysToRemove.includes(SELECTED_BUILDING_KEY),
  "איפוס פיילוט: איפוס כללי כולל דיווחים, סגירות ובניין נבחר"
);
assert(
  !allKeysToRemove.includes("unrelated"),
  "איפוס פיילוט: איפוס כללי לא מוחק מפתחות לא קשורים"
);
removePilotStorageKeys(mockStorage, allKeysToRemove);
assert(
  mockStorage.snapshot().length === 1 && mockStorage.getItem("unrelated") === "keep",
  "איפוס פיילוט: איפוס כללי מוחק את כל נתוני המערכת"
);
const mockStorage2 = createMockPilotStorage({
  [getReportsStorageKey("md25")]: "[]",
  [getClosuresStorageKey("md25")]: "{}",
  [getReportsStorageKey("md23")]: "[]",
  [getClosuresStorageKey("md23")]: "{}",
  [SELECTED_BUILDING_KEY]: "md23",
});
const md25OnlyKeys = getPilotStorageKeysToRemove(mockStorage2, "md25");
assert(
  md25OnlyKeys.length === 2 &&
    md25OnlyKeys.includes(getReportsStorageKey("md25")) &&
    md25OnlyKeys.includes(getClosuresStorageKey("md25")),
  "איפוס פיילוט: איפוס בניין מחזיר רק מפתחות הבניין"
);
removePilotStorageKeys(mockStorage2, md25OnlyKeys);
assert(
  mockStorage2.getItem(getReportsStorageKey("md25")) === null &&
    mockStorage2.getItem(getClosuresStorageKey("md25")) === null &&
    mockStorage2.getItem(getReportsStorageKey("md23")) !== null &&
    mockStorage2.getItem(SELECTED_BUILDING_KEY) === "md23",
  "איפוס פיילוט: איפוס בניין מוחק רק את נתוני אותו בניין"
);
assert(
  REPORTS_STORAGE_PREFIX === "forte-submitted-reports" &&
    CLOSURES_STORAGE_PREFIX === "forte-fault-closures",
  "איפוס פיילוט: קידומות localStorage תקינות"
);
assert(
  PILOT_RESET_SUCCESS_MESSAGE === "הנתונים אופסו בהצלחה.",
  "איפוס פיילוט: הודעת הצלחה מוגדרת"
);
assert(
  getBuildingDataset("md25").faults.length > 0,
  "איפוס פיילוט: נתוני בסיס ב-buildings.ts לא נפגעים"
);

// משוב פיילוט
const feedbackPagePath = path.join(process.cwd(), "app/feedback/page.tsx");
assert(fs.existsSync(feedbackPagePath), "משוב: מסך /feedback נטען (קובץ קיים)");

const sampleFeedbackInput: FeedbackSubmissionInput = {
  senderName: "איתן",
  senderRole: "ועד בית",
  rating: 5,
  wouldUseRegularly: "כן",
  unclearOrMissing: "חסר סיכום חודשי",
  expectedFeature: "מעקב אחרי חברת המעליות",
  wouldRecommend: "כן",
};

function createMockFeedbackStorage(
  entries: Record<string, string>
): import("../lib/feedback-storage").FeedbackStorageLike & {
  snapshot: () => string[];
} {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key(i: number) {
      return Array.from(map.keys())[i] ?? null;
    },
    getItem(k: string) {
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    removeItem(k: string) {
      map.delete(k);
    },
    snapshot() {
      return Array.from(map.keys());
    },
  };
}

const feedbackStorage = createMockFeedbackStorage({});
const md25Feedback = buildFeedbackFromInput(
  sampleFeedbackInput,
  "md25",
  "מגדל דוד 25"
);
saveFeedback(md25Feedback, feedbackStorage);
assert(
  readFeedbackFromStorage(feedbackStorage, "md25").length === 1,
  "משוב: ניתן לשמור משוב לפי buildingId"
);

const md23Feedback = buildFeedbackFromInput(
  { ...sampleFeedbackInput, senderName: "מאור", rating: 3 },
  "md23",
  "מגדל דוד 23"
);
saveFeedback(md23Feedback, feedbackStorage);
assert(
  readFeedbackFromStorage(feedbackStorage, "md25").length === 1 &&
    readFeedbackFromStorage(feedbackStorage, "md23").length === 1,
  "משוב: משוב של בניין אחד לא מופיע בבניין אחר"
);

const expertPageSource = fs.readFileSync(
  path.join(process.cwd(), "components/ExpertPageContent.tsx"),
  "utf8"
);
assert(
  expertPageSource.includes("ExpertFeedbackSection"),
  "משוב: expert רואה משובים במסך מומחה"
);

const clientScreens = [
  "components/HomePageContent.tsx",
  "components/HistoryPageContent.tsx",
  "components/BuildingPageContent.tsx",
];
for (const screen of clientScreens) {
  const source = fs.readFileSync(path.join(process.cwd(), screen), "utf8");
  assert(
    !source.includes("ExpertFeedbackSection") &&
      !source.includes("useBuildingFeedback"),
    `משוב: client לא רואה משובים ב-${screen}`
  );
}

const statsSample = [
  buildFeedbackFromInput(
    { ...sampleFeedbackInput, rating: 5, wouldUseRegularly: "כן", wouldRecommend: "כן" },
    "md25",
    "מגדל דוד 25"
  ),
  buildFeedbackFromInput(
    {
      ...sampleFeedbackInput,
      rating: 3,
      wouldUseRegularly: "אולי",
      wouldRecommend: "לא",
    },
    "md25",
    "מגדל דוד 25"
  ),
  buildFeedbackFromInput(
    {
      ...sampleFeedbackInput,
      rating: 4,
      wouldUseRegularly: "לא",
      wouldRecommend: "אולי",
    },
    "md25",
    "מגדל דוד 25"
  ),
];
const feedbackStats = getFeedbackStats(statsSample);
assert(
  feedbackStats.avgRating === 4,
  "משוב: חישוב דירוג ממוצע תקין"
);
assert(
  feedbackStats.wouldUseCounts.כן === 1 &&
    feedbackStats.wouldUseCounts.אולי === 1 &&
    feedbackStats.wouldUseCounts.לא === 1 &&
    feedbackStats.recommendCounts.כן === 1 &&
    feedbackStats.recommendCounts.אולי === 1 &&
    feedbackStats.recommendCounts.לא === 1,
  "משוב: חישוב כן / אולי / לא תקין"
);

const resetStorage = createMockFeedbackStorage({
  [getFeedbackStorageKey("md25")]: JSON.stringify([md25Feedback]),
  [getFeedbackStorageKey("md23")]: JSON.stringify([md23Feedback]),
});
clearFeedbackByBuilding("md25", resetStorage);
assert(
  readFeedbackFromStorage(resetStorage, "md25").length === 0 &&
    readFeedbackFromStorage(resetStorage, "md23").length === 1,
  "משוב: איפוס משובים לבניין נבחר עובד"
);
const clearedKeys = clearAllFeedbackFromStorage(resetStorage);
assert(
  clearedKeys.length >= 1 && getAllFeedbackFromStorage(resetStorage).length === 0,
  "משוב: איפוס כל המשובים עובד"
);

const feedbackFormSource = fs.readFileSync(
  path.join(process.cwd(), "components/FeedbackForm.tsx"),
  "utf8"
);
assert(
  feedbackFormSource.includes("if (!ready)") &&
    feedbackFormSource.includes("טוען"),
  "משוב: אין Hydration errors — טופס ממתין ל-ready"
);

const bottomNavSource = fs.readFileSync(
  path.join(process.cwd(), "components/BottomNav.tsx"),
  "utf8"
);
assert(
  bottomNavSource.includes('href: "/feedback"') &&
    bottomNavSource.includes("משוב"),
  "משוב: כפתור משוב בתפריט התחתון"
);

assert(
  FEEDBACK_STORAGE_PREFIX === "forte-feedback",
  "משוב: קידומת localStorage תקינה"
);

// 3-5. Analytics functions with real data
assertNoInvalidValues("getRecurringFaultsByElevator", getRecurringFaultsByElevator(defaultCtx));
assertNoInvalidValues("getRecurringFaultsByType", getRecurringFaultsByType(defaultCtx));
assertNoInvalidValues("getAverageDowntime", getAverageDowntime(defaultCtx));
assertNoInvalidValues("getAverageResponseTime", getAverageResponseTime(defaultCtx));
assertNoInvalidValues("getElevatorAvailability", getElevatorAvailability(defaultCtx));
assertNoInvalidValues("getMostProblematicElevator", getMostProblematicElevator(defaultCtx));
assertNoInvalidValues("getServiceCompanyRating", getServiceCompanyRating(defaultCtx));
assertNoInvalidValues("getTrendAnalysis", getTrendAnalysis(defaultCtx));
assertNoInvalidValues("getAnomalyAlerts", getAnomalyAlerts(defaultCtx));
assertNoInvalidValues("getRiskAssessment", getRiskAssessment(defaultCtx));
assertNoInvalidValues("generateInsights", generateInsights(defaultCtx));
assertNoInvalidValues("generateActions", generateActions(defaultCtx));
assertNoInvalidValues("generateMetrics", generateMetrics(defaultCtx));
assertNoInvalidValues("getExpertAnalytics", getExpertAnalytics(defaultCtx));
assertNoInvalidValues("getExpertPdfData", getExpertPdfData(defaultCtx));
assert(
  getExpertPdfData(defaultCtx).building.name.length > 0,
  "נתוני PDF: שם בניין קיים"
);
assert(
  getExpertPdfData(defaultCtx).analytics.actions.length > 0,
  "נתוני PDF: המלצות פעולה קיימות"
);
assert(
  getExpertPdfData(defaultCtx).analytics.insights.length > 0,
  "נתוני דוח הדפסה: תובנות קיימות"
);
assert(
  getExpertPdfData(defaultCtx, statsSample).feedbackSummary.total === 3,
  "משוב: דוח הדפסה כולל סיכום משובי פיילוט"
);
const printReportSource = fs.readFileSync(
  path.join(process.cwd(), "components/expert/ExpertPrintReport.tsx"),
  "utf8"
);
assert(
  printReportSource.includes("סיכום משובי פיילוט") &&
    !printReportSource.includes("unclearOrMissing"),
  "משוב: דוח הדפסה מציג סיכום בלבד ללא טקסטים חופשיים"
);

getAllBuildingIds().forEach((id) => {
  assertNoInvalidValues(`getExpertAnalytics(${id})`, getExpertAnalytics(id));
});

// 4. Division safety
const recurring = getRecurringFaultsByElevator(defaultCtx);
recurring.forEach((r) => {
  assert(r.percentage >= 0 && r.percentage <= 100, `אחוז תקין ל-${r.elevatorName}`);
});

// 6. Client data functions
assertNoInvalidValues("getClientStats", getClientStats(defaultCtx));
assertNoInvalidValues("getOpenFaults", getOpenFaults(defaultCtx));
assertNoInvalidValues("getFaultsByType", getFaultsByType(defaultCtx));
assertNoInvalidValues("getMonthlyFaultTrend", getMonthlyFaultTrend(defaultCtx));

// Empty-array simulation via analytics validate on zero-fault scenario
const emptyAnalytics = {
  insights: [
    { id: "1", text: "אין נתונים", severity: "נמוך" as const, category: "test" },
  ],
  metrics: [{ label: "test", value: "0 שעות" }],
  recurringByElevator: [],
  recurringByType: [],
  faultTypeBreakdown: [],
  failurePatterns: [],
  problematicElevator: {
    elevatorId: "",
    name: "אין נתונים",
    faultCount: 0,
    percentage: 0,
    downtimeHours: 0,
    reason: "לא נרשמו תקלות",
  },
  insufficientTreatment: { company: "test", suspiciousCases: 0, detail: "אין" },
  responseTime: {
    averageHours: 0,
    targetHours: 2,
    compliancePercent: 0,
    trendPercent: 0,
    trendDirection: "יציב" as const,
    worstCase: "אין נתונים",
  },
  downtime: {
    averageHours: 0,
    totalHours: 0,
    monthHours: 0,
    trendPercent: 0,
    trendDirection: "יציב" as const,
    longestEvent: "אין נתונים",
  },
  elevatorAvailability: [],
  serviceRating: { company: "test", score: 0, breakdown: [] },
  trend: {
    direction: "יציב" as const,
    faultCountChangePercent: 0,
    downtimeChangePercent: 0,
    description: "יציב",
  },
  alerts: [],
  riskAssessment: { level: "נמוך" as const, factors: [], prediction: "נמוך" },
  actions: ["אין תקלות"],
};

assertNoInvalidValues("empty-scenario", emptyAnalytics);

// דיווח תקלה — לוגיקת דמו
assert(
  !isReportFormValid("", "רעש חריג", "תיאור קצר מדי"),
  "דיווח: טופס לא תקין ללא מעלית"
);
assert(
  !isReportFormValid("1", "", "תיאור ארוך מספיק לבדיקה"),
  "דיווח: טופס לא תקין ללא סוג תקלה"
);
assert(
  !isReportFormValid("1", "רעש חריג", "קצר"),
  "דיווח: טופס לא תקין עם תיאור קצר"
);
assert(
  isReportFormValid("1", "רעש חריג", "תיאור תקלה מפורט לבדיקה"),
  "דיווח: טופס תקין כשכל השדות מלאים"
);
const demoTicket = generateTicketNumber(0);
assert(demoTicket.startsWith("FB-"), "דיווח: מספר פנייה מתחיל ב-FB-");
assert(demoTicket.includes("-"), "דיווח: מספר פנייה בפורמט תקין");
const demoFault = buildFaultFromSubmission(
  {
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    faultType: "רעש חריג",
    description: "  תיאור בדיקה לדיווח תקלה  ",
    isDisabled: false,
  },
  0
);
assert(demoFault.ticketNumber === demoTicket, "דיווח: מספר פנייה משויך לתקלה");
assert(demoFault.isUserSubmitted === true, "דיווח: סימון דיווח משתמש");
assert(demoFault.isDisabled === false, "דיווח: isDisabled=false נשמר");
assert(demoFault.description === "תיאור בדיקה לדיווח תקלה", "דיווח: תיאור מנוקה");

// תמונות בדיווח
const sampleReportImage: ReportImageAttachment = {
  dataUrl:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  name: "fault-photo.jpg",
  sizeBytes: 512,
  mimeType: "image/jpeg",
};
assert(formatFileSize(1536) === "1.5 KB", "תמונה: formatFileSize תקין");
assert(
  estimateDataUrlBytes(sampleReportImage.dataUrl) > 0,
  "תמונה: הערכת גודל data URL"
);
assert(
  canStoreImageInLocalStorage(sampleReportImage.dataUrl),
  "תמונה: ניתן לשמור ב-localStorage"
);
assert(
  MAX_STORED_IMAGE_BYTES === 450 * 1024,
  "תמונה: מגבלת localStorage מוגדרת"
);
const faultWithImage = buildFaultFromSubmission(
  {
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    faultType: "רעש חריג",
    description: "תיאור תקלה עם תמונה מצורפת",
    isDisabled: false,
    image: sampleReportImage,
  },
  1
);
assert(
  faultWithImage.image?.name === "fault-photo.jpg",
  "תמונה: שמירה בדיווח — שם קובץ"
);
assert(
  Boolean(faultWithImage.image?.dataUrl.startsWith("data:image/jpeg")),
  "תמונה: שמירה בדיווח — data URL"
);
const storedFaults = JSON.parse(JSON.stringify([faultWithImage])) as typeof faultWithImage[];
assert(
  storedFaults[0].image?.name === "fault-photo.jpg",
  "תמונה: שמירה בדיווח — roundtrip JSON (localStorage)"
);
const replacedImage: ReportImageAttachment = {
  ...sampleReportImage,
  name: "replaced.jpg",
  sizeBytes: 640,
};
const replacedFault = attachImageToFault(demoFault, replacedImage);
assert(
  replacedFault.image?.name === "replaced.jpg",
  "תמונה: החלפת תמונה בדיווח"
);
const clearedFault = attachImageToFault(demoFault, null);
assert(!clearedFault.image, "תמונה: מחיקת תמונה מדיווח");
assert(
  buildClosedFault(faultWithImage).image?.name === "fault-photo.jpg",
  "תמונה: תמונה נשמרת גם לאחר סגירת תקלה"
);

const reportImagePickerSource = fs.readFileSync(
  path.join(process.cwd(), "components/ReportImagePicker.tsx"),
  "utf8"
);
assert(
  reportImagePickerSource.includes("החלף תמונה") &&
    reportImagePickerSource.includes("הסר תמונה") &&
    reportImagePickerSource.includes("התמונה נקלטה"),
  "תמונה: תצוגה מקדימה עם כפתורי החלפה והסרה"
);
assert(
  reportImagePickerSource.includes('accept="image/*"') &&
    reportImagePickerSource.includes('capture="environment"') &&
    reportImagePickerSource.includes("בחירה מהגלריה") &&
    reportImagePickerSource.includes("צילום מהמצלמה"),
  "תמונה: מובייל — מצלמה וגלריה"
);
assert(
  reportImagePickerSource.includes("formatFileSize") &&
    reportImagePickerSource.includes("attachment.name"),
  "תמונה: תצוגה מקדימה — שם קובץ וגודל"
);

const faultCardSource = fs.readFileSync(
  path.join(process.cwd(), "components/FaultCard.tsx"),
  "utf8"
);
assert(
  faultCardSource.includes("fault.image") &&
    faultCardSource.includes("dataUrl"),
  "תמונה: הצגה בכרטיס תקלה בהיסטוריה"
);

const reportFormImageSource = fs.readFileSync(
  path.join(process.cwd(), "components/ReportForm.tsx"),
  "utf8"
);
assert(
  reportFormImageSource.includes("ReportImagePicker") &&
    reportFormImageSource.includes("image: imageAttachment"),
  "תמונה: טופס דיווח מעביר תמונה לשמירה"
);

// מעליות מושבתות — דיווח משתמש
const md23Ctx = getBuildingDataset("md23");
const md23BaseStats = getClientStats(md23Ctx);
const md23ActiveElevator = md23Ctx.elevators.find((e) => e.id === "md23-right")!;
const disabledReport = buildFaultFromSubmission(
  {
    elevatorId: md23ActiveElevator.id,
    elevatorName: md23ActiveElevator.name,
    faultType: "רעש חריג",
    description: "תיאור תקלה מפורט לבדיקת מעלית מושבתת",
    isDisabled: true,
  },
  0
);
const md23AfterStats = getClientStats(md23Ctx, [disabledReport]);
assert(
  disabledReport.isDisabled === true,
  "דיווח: isDisabled=true נשמר"
);
assert(
  md23AfterStats.disabledElevators === md23BaseStats.disabledElevators + 1,
  "דיווח תקלה עם isDisabled=true מעלה את מונה המעליות המושבתות בבניין הפעיל"
);
assert(
  md23AfterStats.effectiveElevators.find((e) => e.id === "md23-right")?.status ===
    "מושבתת",
  "דיווח: סטטוס מעלית מתעדכן למושבתת"
);
const secondDisabledOnSame = buildFaultFromSubmission(
  {
    elevatorId: md23ActiveElevator.id,
    elevatorName: md23ActiveElevator.name,
    faultType: "דלת לא נסגרת",
    description: "דיווח שני על אותה מעלית מושבתת",
    isDisabled: true,
  },
  1
);
const md23DoubleStats = getClientStats(md23Ctx, [
  disabledReport,
  secondDisabledOnSame,
]);
assert(
  md23DoubleStats.disabledElevators === md23AfterStats.disabledElevators,
  "דיווח: לא סופרים מעלית מושבתת פעמיים"
);
const yk20Ctx = getBuildingDataset("yk20");
const yk20BaseStats = getClientStats(yk20Ctx);
const yk20AfterForeignReport = getClientStats(yk20Ctx, [disabledReport]);
assert(
  yk20AfterForeignReport.disabledElevators === yk20BaseStats.disabledElevators,
  "דיווח: דיווח מושבת בבניין אחד לא משפיע על בניין אחר"
);

// תרחיש שחזור: מעלית ימין במגדל דוד 25 → דיווח חדש
const md25Ctx = getBuildingDataset("md25");
const md25ElevatorRight = md25Ctx.elevators.find((e) => e.id === "md25-right")!;
assert(
  md25ElevatorRight.status === "פעילה",
  "תרחיש: מעלית ימין פעילה בנתוני דמו"
);
const forteDisabledReport = buildFaultFromSubmission(
  {
    elevatorId: md25ElevatorRight.id,
    elevatorName: md25ElevatorRight.name,
    faultType: "רעש חריג",
    description: "תקלה במעלית א עם השבתת מעלית",
    isDisabled: true,
  },
  0
);
const md25Runtime = buildRuntimeBuildingContext(
  md25Ctx,
  [forteDisabledReport],
  "md25"
);
assert(
  md25Runtime.elevators.find((e) => e.id === "md25-right")?.status === "מושבתת",
  "דיווח מושבת -> המעלית מופיעה כמושבתת"
);
const forteSecondReport = buildFaultFromSubmission(
  {
    elevatorId: md25ElevatorRight.id,
    elevatorName: md25ElevatorRight.name,
    faultType: "דלת לא נסגרת",
    description: "דיווח שני על מעלית א שכבר מושבתת",
    isDisabled: false,
  },
  1
);
const md25RuntimeTwo = buildRuntimeBuildingContext(
  md25Ctx,
  [forteDisabledReport, forteSecondReport],
  "md25"
);
assert(
  md25RuntimeTwo.elevators.find((e) => e.id === "md25-right")?.status ===
    "מושבתת",
  "דיווח שני -> הסטטוס מושבתת עדיין נשמר"
);
const md23RuntimeForeign = buildRuntimeBuildingContext(
  md23Ctx,
  [forteDisabledReport],
  "md23"
);
assert(
  md23RuntimeForeign.elevators.find((e) => e.id === "md23-right")?.status !==
    "מושבתת",
  "מעבר בין בניינים -> אין זליגת סטטוס מושבת"
);

// מחזור חיים — פתיחה וסגירת תקלה
assert(
  demoFault.status === "פתוחה",
  "מחזור חיים: דיווח חדש מתחיל בפתוחה"
);
const closedDemoFault = buildClosedFault(demoFault);
assert(closedDemoFault.status === "סגורה", "מחזור חיים: סגירה מעדכנת לסגורה");
assert(
  Boolean(closedDemoFault.resolvedAt) &&
    closedDemoFault.durationHours != null,
  "מחזור חיים: נשמרים תאריך ומשך טיפול"
);
assert(
  closedDemoFault.isDisabled === false,
  "מחזור חיים: isDisabled מתאפס בסגירה"
);
const disabledOpen = buildFaultFromSubmission(
  {
    elevatorId: "yk20-passenger-3",
    elevatorName: "מעלית 3 נוסעים",
    faultType: "רעש חריג",
    description: "תקלה מושבתת לבדיקת סגירה",
    isDisabled: true,
  },
  2
);
const runtimeDisabled = buildRuntimeBuildingContext(
  yk20Ctx,
  [disabledOpen],
  "yk20"
);
assert(
  runtimeDisabled.elevators.find((e) => e.id === "yk20-passenger-3")?.status ===
    "מושבתת",
  "מחזור חיים: דיווח מושבת משבית מעלית"
);
const closedDisabled = buildClosedFault(disabledOpen);
const runtimeAfterClose = buildRuntimeBuildingContext(
  yk20Ctx,
  [closedDisabled],
  "yk20"
);
assert(
  runtimeAfterClose.elevators.find((e) => e.id === "yk20-passenger-3")
    ?.status === "פעילה",
  "מחזור חיים: סגירת תקלה מחזירה מעלית לפעילה"
);
const md25DisabledOpen = buildFaultFromSubmission(
  {
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    faultType: "רעש חריג",
    description: "תקלה מושבתת עם תקלה פתוחה נוספת",
    isDisabled: true,
  },
  3
);
const md25AfterClose = buildRuntimeBuildingContext(
  md25Ctx,
  [buildClosedFault(md25DisabledOpen)],
  "md25"
);
assert(
  md25AfterClose.elevators.find((e) => e.id === "md25-right")?.status ===
    "בטיפול",
  "מחזור חיים: תקלה פתוחה נוספת שומרת סטטוס בטיפול"
);
const statsBeforeClose = getClientStats(yk20Ctx, [disabledOpen], "yk20");
const statsAfterClose = getClientStats(yk20Ctx, [closedDisabled], "yk20");
assert(
  statsAfterClose.openFaults < statsBeforeClose.openFaults,
  "מחזור חיים: מונה תקלות פתוחות יורד"
);
assert(
  statsAfterClose.closedFaults > statsBeforeClose.closedFaults,
  "מחזור חיים: מונה תקלות סגורות עולה"
);
const lifecycleStats = getFaultLifecycleStats(
  runtimeAfterClose,
  runtimeAfterClose.faults
);
assertNoInvalidValues("getFaultLifecycleStats", lifecycleStats);
const md23StatsForeign = getClientStats(md23Ctx, [closedDisabled], "md23");
assert(
  md23StatsForeign.openFaults === getClientStats(md23Ctx, [], "md23").openFaults,
  "מחזור חיים: סגירה בבניין אחד לא משפיעה על בניין אחר"
);

// סטטוס מעלית — רק isDisabled על תקלות פעילות (לא סגורות)
const closedStaleDisabled = {
  ...buildClosedFault(disabledOpen),
  isDisabled: true,
};
assert(
  !faultIndicatesDisabledElevator(closedStaleDisabled),
  "סטטוס מעלית: תקלה סגורה עם isDisabled לא משפיעה"
);
const runtimeStaleDisabled = buildRuntimeBuildingContext(
  yk20Ctx,
  [closedStaleDisabled],
  "yk20"
);
assert(
  runtimeStaleDisabled.elevators.find((e) => e.id === "yk20-passenger-3")
    ?.status === "פעילה",
  "סטטוס מעלית: isDisabled סגור לא משאיר מושבתת"
);
const dualDisabled1 = buildFaultFromSubmission(
  {
    elevatorId: "yk20-passenger-3",
    elevatorName: "מעלית 3 נוסעים",
    faultType: "רעש חריג",
    description: "תקלה מושבתת ראשונה לבדיקת סטטוס",
    isDisabled: true,
  },
  10
);
const dualDisabled2 = buildFaultFromSubmission(
  {
    elevatorId: "yk20-passenger-3",
    elevatorName: "מעלית 3 נוסעים",
    faultType: "דלת לא נסגרת",
    description: "תקלה מושבתת שנייה לבדיקת סטטוס",
    isDisabled: true,
  },
  11
);
const runtimeDual = buildRuntimeBuildingContext(
  yk20Ctx,
  [dualDisabled1, dualDisabled2],
  "yk20"
);
assert(
  runtimeDual.elevators.find((e) => e.id === "yk20-passenger-3")?.status ===
    "מושבתת",
  "סטטוס מעלית: שתי תקלות מושבתות משביתות מעלית"
);
const runtimeDualOneClosed = buildRuntimeBuildingContext(
  yk20Ctx,
  [buildClosedFault(dualDisabled1), dualDisabled2],
  "yk20"
);
assert(
  runtimeDualOneClosed.elevators.find((e) => e.id === "yk20-passenger-3")
    ?.status === "מושבתת",
  "סטטוס מעלית: סגירת תקלה אחת משאירה מושבתת"
);
const runtimeDualBothClosed = buildRuntimeBuildingContext(
  yk20Ctx,
  [buildClosedFault(dualDisabled1), buildClosedFault(dualDisabled2)],
  "yk20"
);
assert(
  runtimeDualBothClosed.elevators.find((e) => e.id === "yk20-passenger-3")
    ?.status === "פעילה",
  "סטטוס מעלית: סגירת שתי התקלות מחזירה לפעילה"
);
const md25ForeignDisabled = buildRuntimeBuildingContext(
  md25Ctx,
  [dualDisabled2],
  "md25"
);
assert(
  md25ForeignDisabled.elevators.find((e) => e.id === "md25-right")?.status !==
    "מושבתת",
  "סטטוס מעלית: אין זליגת מושבת בין בניינים"
);

// תרחיש MD25 מעלית ימין — פתיחה, סגירה, שתי תקלות, בידוד בניינים
const md25RightCtx = {
  ...md25Ctx,
  faults: md25Ctx.faults.filter((f) => f.elevatorId !== "md25-right"),
};
const md25RightDisabled = buildFaultFromSubmission(
  {
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    faultType: "רעש חריג",
    description: "תקלה מושבתת על מעלית ימין MD25",
    isDisabled: true,
  },
  20
);
const md25RightStep1 = buildRuntimeBuildingContext(
  md25RightCtx,
  [md25RightDisabled],
  "md25"
);
assert(
  md25RightStep1.elevators.find((e) => e.id === "md25-right")?.status ===
    "מושבתת",
  "MD25 ימין: דיווח מושבת משבית מעלית"
);
const md25RightStep3 = buildRuntimeBuildingContext(
  md25RightCtx,
  [buildClosedFault(md25RightDisabled)],
  "md25"
);
assert(
  md25RightStep3.elevators.find((e) => e.id === "md25-right")?.status ===
    "פעילה",
  "MD25 ימין: סגירת תקלה מחזירה לפעילה"
);
const md25RightDual1 = buildFaultFromSubmission(
  {
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    faultType: "רעש חריג",
    description: "תקלה מושבתת ראשונה MD25 ימין",
    isDisabled: true,
  },
  21
);
const md25RightDual2 = buildFaultFromSubmission(
  {
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    faultType: "דלת לא נסגרת",
    description: "תקלה מושבתת שנייה MD25 ימין",
    isDisabled: true,
  },
  22
);
const md25RightDualOpen = buildRuntimeBuildingContext(
  md25RightCtx,
  [md25RightDual1, md25RightDual2],
  "md25"
);
assert(
  md25RightDualOpen.elevators.find((e) => e.id === "md25-right")?.status ===
    "מושבתת",
  "MD25 ימין: שתי תקלות מושבתות משביתות"
);
const md25RightDualOneClosed = buildRuntimeBuildingContext(
  md25RightCtx,
  [buildClosedFault(md25RightDual1), md25RightDual2],
  "md25"
);
assert(
  md25RightDualOneClosed.elevators.find((e) => e.id === "md25-right")
    ?.status === "מושבתת",
  "MD25 ימין: סגירת אחת משאירה מושבתת"
);
const md25RightDualBothClosed = buildRuntimeBuildingContext(
  md25RightCtx,
  [buildClosedFault(md25RightDual1), buildClosedFault(md25RightDual2)],
  "md25"
);
assert(
  md25RightDualBothClosed.elevators.find((e) => e.id === "md25-right")
    ?.status === "פעילה",
  "MD25 ימין: סגירת שתיהן מחזירה לפעילה"
);
const md23AfterMd25Report = buildRuntimeBuildingContext(
  md23Ctx,
  [md25RightDisabled],
  "md23"
);
assert(
  md23AfterMd25Report.elevators.find((e) => e.id === "md23-right")?.status !==
    "מושבתת",
  "MD25 ימין: אין השפעה על בניין אחר"
);
assert(
  !faultIndicatesDisabledElevator(buildClosedFault(md25RightDisabled)),
  "MD25 ימין: תקלה סגורה לא משפיעה על סטטוס"
);
const md25LeftOpen = md25Ctx.faults.find((f) => f.id === "MD25-1")!;
const md25LeftAfterClose = buildRuntimeBuildingContext(
  {
    ...md25Ctx,
    faults: md25Ctx.faults.map((f) =>
      f.id === "MD25-1" ? buildClosedFault(md25LeftOpen) : f
    ),
  },
  [],
  "md25"
);
assert(
  md25LeftAfterClose.elevators.find((e) => e.id === "md25-left")?.status ===
    "פעילה",
  "סטטוס מעלית: סגירת תקלת דמו מבטלת מושבתת — לא משתמש בסטטוס בסיס"
);

const merged = mergeFaults(faults, [demoFault]);
assert(merged.length === faults.length + 1, "דיווח: מיזוג להיסטוריה");
assert(merged[0].id === demoFault.id, "דיווח: דיווח חדש ראשון ברשימה");

// מסך /buildings — סטטוס חי לכל הבניינים
const md25RightCtxList = {
  ...md25Ctx,
  faults: md25Ctx.faults.filter((f) => f.elevatorId !== "md25-right"),
};
const md25ListDisabled = buildFaultFromSubmission(
  {
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    faultType: "רעש חריג",
    description: "תקלה מושבתת לבדיקת כרטיס בניינים",
    isDisabled: true,
  },
  30
);
const listBeforeDisabled = getLiveBuildingListItems({}, true);
const md25CardBefore = listBeforeDisabled.find((b) => b.id === "md25")!;
const listWithDisabled = getLiveBuildingListItems(
  { md25: [md25ListDisabled] },
  true
);
const md25CardDisabled = listWithDisabled.find((b) => b.id === "md25")!;
assert(
  md25CardDisabled.buildingStatus === "מושבתת",
  "/buildings: דיווח מושבת ב-MD25 משנה כרטיס למושבתת"
);
assert(
  md25CardDisabled.disabledElevatorCount >
    md25CardBefore.disabledElevatorCount,
  "/buildings: מונה מעליות מושבתות בכרטיס MD25 עולה"
);
const md25LeftFault = md25Ctx.faults.find((f) => f.id === "MD25-1")!;
const md25RightTreatment = md25Ctx.faults.find((f) => f.id === "MD25-2")!;
const md25NoActiveDisabledClosures = {
  [md25LeftFault.id]: buildClosedFault(md25LeftFault),
  [md25RightTreatment.id]: buildClosedFault(md25RightTreatment),
};
const listAfterClose = getLiveBuildingListItems(
  { md25: [buildClosedFault(md25ListDisabled)] },
  true,
  { md25: md25NoActiveDisabledClosures }
);
const md25CardClosed = listAfterClose.find((b) => b.id === "md25")!;
assert(
  md25CardClosed.buildingStatus === "פעילה",
  "/buildings: סגירת תקלה מחזירה כרטיס MD25 לפעיל"
);
const listForeign = getLiveBuildingListItems(
  { md25: [md25ListDisabled] },
  true
);
const md23CardForeign = listForeign.find((b) => b.id === "md23")!;
const md23CardBase = listBeforeDisabled.find((b) => b.id === "md23")!;
assert(
  md23CardForeign.buildingStatus === md23CardBase.buildingStatus &&
    md23CardForeign.disabledElevatorCount ===
      md23CardBase.disabledElevatorCount,
  "/buildings: דיווח בבניין אחד לא משנה כרטיס של בניין אחר"
);
const listHydrationSafe = getLiveBuildingListItems({}, false);
assert(
  listHydrationSafe.length === getAllBuildingIds().length,
  "/buildings: ללא localStorage — רשימת בניינים יציבה (hydration)"
);
assert(
  listHydrationSafe.every((b) => b.buildingStatus.length > 0),
  "/buildings: ללא hydration mismatch — לכל כרטיס יש סטטוס"
);
const listPersistedClose = getLiveBuildingListItems(
  { md25: [buildClosedFault(md25ListDisabled)] },
  true
);
assert(
  (listPersistedClose.find((b) => b.id === "md25")?.closedFaultCount ?? 0) >
    md25CardBefore.closedFaultCount,
  "/buildings: סגירות משויכות לספירת תקלות סגורות"
);

// שיפורי פיילוט — ניסוח, תפריט, בניין פעיל
function collectUiFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectUiFiles(full));
    } else if (/\.(tsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const UI_SCAN_DIRS = ["app", "components"];
const uiFiles = UI_SCAN_DIRS.flatMap((d) =>
  collectUiFiles(path.join(process.cwd(), d))
);

let externalReportPhraseHits = 0;
for (const file of uiFiles) {
  if (file.endsWith(`${path.sep}lib${path.sep}pilot-copy.ts`)) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const phrase of FORBIDDEN_EXTERNAL_REPORT_PHRASES) {
    if (content.includes(phrase)) {
      externalReportPhraseHits++;
      failed++;
      console.error(
        `✗ ניסוח: "${phrase}" נמצא ב-${path.relative(process.cwd(), file)}`
      );
    }
  }
}
assert(
  externalReportPhraseHits === 0,
  `ניסוח: אין טקסטים שמרמזים על שליחה לחברת מעליות (${externalReportPhraseHits} מופעים)`
);

const bottomNavPilotSource = fs.readFileSync(
  path.join(process.cwd(), "components/BottomNav.tsx"),
  "utf8"
);
assert(
  bottomNavPilotSource.includes("isFeedback") &&
    bottomNavPilotSource.includes("border-gold") &&
    bottomNavPilotSource.includes("font-bold"),
  "פיילוט UX: כפתור משוב מודגש יותר מהמצב הקודם"
);
assert(
  bottomNavPilotSource.includes("text-[11px]") &&
    bottomNavPilotSource.includes("w-[23px]"),
  "פיילוט UX: תפריט תחתון — פונט ואייקונים מוגדלים"
);
assert(
  bottomNavPilotSource.includes("min-h-[56px]"),
  "פיילוט UX: תפריט תחתון — אזור לחיצה מוגדל"
);

const activeBuildingSource = fs.readFileSync(
  path.join(process.cwd(), "components/ActiveBuildingBar.tsx"),
  "utf8"
);
assert(
  activeBuildingSource.includes('href="/buildings"') &&
    activeBuildingSource.includes("בניין פעיל:"),
  "פיילוט UX: מעבר בלחיצה על בניין פעיל ל-/buildings"
);

const reportFormSource = fs.readFileSync(
  path.join(process.cwd(), "components/ReportForm.tsx"),
  "utf8"
);
assert(
  reportFormSource.includes("REPORT_SAVED_HEADLINE") &&
    reportFormSource.includes("REPORT_SAVED_INFO") &&
    reportFormSource.includes("REPORT_MAINTENANCE_RESPONSIBILITY"),
  "פיילוט UX: מסך תודה משתמש בנוסח החדש"
);
assert(
  REPORT_SAVED_HEADLINE === "הדיווח נקלט במערכת פורטה בקרה." &&
    REPORT_SAVED_INFO.includes("תיעוד, מעקב ובקרת שירות") &&
    REPORT_MAINTENANCE_RESPONSIBILITY.includes("גורם התחזוקה"),
  "פיילוט UX: נוסח מסך תודה מוגדר כנדרש"
);
assert(
  !reportFormSource.includes("הדיווח נשלח"),
  "פיילוט UX: מסך תודה ללא ניסוח 'נשלח'"
);

const reportPageSource = fs.readFileSync(
  path.join(process.cwd(), "app/report/page.tsx"),
  "utf8"
);
assert(
  reportPageSource.includes("REPORT_PAGE_SUBTITLE"),
  "פיילוט UX: כותרת משנה בדיווח ללא העברה לחברת מעליות"
);
assert(
  REPORT_PAGE_SUBTITLE.includes("יישמר במערכת"),
  "פיילוט UX: נוסח כותרת משנה תקין"
);

// פיילוט ענן — Supabase מינימלי + /master
assert(
  fs.existsSync(path.join(process.cwd(), "lib/pilot-cloud.ts")),
  "ענן פיילוט: lib/pilot-cloud.ts קיים"
);
assert(
  fs.existsSync(path.join(process.cwd(), "supabase/migrations/001_pilot_tables.sql")),
  "ענן פיילוט: migration SQL קיים"
);
assert(
  fs.existsSync(path.join(process.cwd(), "app/master/page.tsx")),
  "ענן פיילוט: מסך /master קיים"
);
assert(
  PILOT_FAULTS_TABLE === "pilot_faults" &&
    PILOT_FEEDBACK_TABLE === "pilot_feedback",
  "ענן פיילוט: שמות טבלאות תקינים"
);
assert(
  typeof isPilotCloudConfigured() === "boolean",
  "ענן פיילוט: isPilotCloudConfigured מחזיר boolean"
);
assert(
  !process.env.NEXT_PUBLIC_SUPABASE_URL || isPilotCloudConfigured(),
  "ענן פיילוט: כאשר Supabase מוגדר — isPilotCloudConfigured פעיל"
);

const reportFormCloudSource = fs.readFileSync(
  path.join(process.cwd(), "components/ReportForm.tsx"),
  "utf8"
);
assert(
  reportFormCloudSource.includes("saveSubmittedReport") &&
    reportFormCloudSource.includes("savePilotFaultFromLocalFault"),
  "ענן פיילוט: דיווח נשמר מקומית + נשלח לענן"
);

const feedbackStorageSource = fs.readFileSync(
  path.join(process.cwd(), "lib/feedback-storage.ts"),
  "utf8"
);
assert(
  feedbackStorageSource.includes("saveFeedback") &&
    feedbackStorageSource.includes("savePilotFeedback"),
  "ענן פיילוט: משוב נשמר מקומית + נשלח לענן"
);

const pilotCloudSource = fs.readFileSync(
  path.join(process.cwd(), "lib/pilot-cloud.ts"),
  "utf8"
);
assert(
  pilotCloudSource.includes("savePilotFault") &&
    pilotCloudSource.includes("savePilotFeedback") &&
    pilotCloudSource.includes("getAllPilotFaults") &&
    pilotCloudSource.includes("getAllPilotFeedback") &&
    pilotCloudSource.includes("closePilotFault") &&
    pilotCloudSource.includes("reopenPilotFault") &&
    pilotCloudSource.includes("deletePilotFault") &&
    pilotCloudSource.includes("resetPilotCloudData") &&
    pilotCloudSource.includes("resetPilotCloudDataByBuilding"),
  "ענן פיילוט: כל פונקציות pilot-cloud מוגדרות"
);
assert(
  pilotCloudSource.includes('.eq("building_id", buildingId)'),
  "ענן פיילוט: איפוס לפי בניין מסנן building_id בלבד"
);
assert(
  pilotCloudSource.includes("if (!client) return null") ||
    pilotCloudSource.includes("if (!client) return false") ||
    pilotCloudSource.includes("if (!client) return []"),
  "ענן פיילוט: ללא Supabase — פונקציות לא קורסות"
);

const masterSource = fs.readFileSync(
  path.join(process.cwd(), "components/MasterPageContent.tsx"),
  "utf8"
);
assert(
  masterSource.includes("verifyMasterCode") &&
    masterSource.includes("קוד גישה שגוי"),
  "ענן פיילוט: /master דורש קוד — שגוי חוסם"
);
assert(
  masterSource.includes("setMasterAuthenticated(true)"),
  "ענן פיילוט: קוד נכון מאפשר צפייה"
);
assert(
  masterSource.includes("getAllPilotFaults") &&
    masterSource.includes("getAllPilotFeedback") &&
    masterSource.includes("resetPilotCloudData") &&
    masterSource.includes("resetPilotCloudDataByBuilding"),
  "ענן פיילוט: מסך master מציג ומנהל נתוני ענן"
);
assert(
  masterSource.includes("איפוס לבניין הנבחר") &&
    masterSource.includes("נתוני בניינים אחרים לא יושפעו"),
  "ענן פיילוט: /master — איפוס לפי בניין עם אישור ברור"
);

const bottomNavMasterCheck = fs.readFileSync(
  path.join(process.cwd(), "components/BottomNav.tsx"),
  "utf8"
);
assert(
  !bottomNavMasterCheck.includes("/master"),
  "ענן פיילוט: אין קישור ל-/master בתפריט לקוח"
);

const masterReturnSource = fs.readFileSync(
  path.join(process.cwd(), "components/MasterReturnButton.tsx"),
  "utf8"
);
const rootLayoutSource = fs.readFileSync(
  path.join(process.cwd(), "app/layout.tsx"),
  "utf8"
);
assert(
  masterReturnSource.includes("isMasterAuthenticated") &&
    masterReturnSource.includes("חזרה למאסטר") &&
    masterReturnSource.includes('href="/master"') &&
    masterReturnSource.includes('pathname.startsWith("/master")'),
  "מאסטר: כפתור חזרה מותנה באימות session"
);
assert(
  rootLayoutSource.includes("MasterReturnButton"),
  "מאסטר: כפתור חזרה משולב ב-layout הראשי"
);
assert(
  !bottomNavMasterCheck.includes("חזרה למאסטר"),
  "מאסטר: כפתור חזרה לא בתפריט התחתון הציבורי"
);

function makePilotFault(
  overrides: Partial<PilotCloudFault> & {
    building_id: string;
    elevator_id: string;
    fault_type: string;
  }
): PilotCloudFault {
  return {
    id: overrides.id ?? `fault-${Math.random().toString(36).slice(2)}`,
    building_id: overrides.building_id,
    building_name: overrides.building_name ?? "בניין בדיקה",
    elevator_id: overrides.elevator_id,
    elevator_name: overrides.elevator_name ?? "מעלית 1",
    fault_type: overrides.fault_type,
    description: overrides.description ?? "תיאור",
    is_disabled: overrides.is_disabled ?? false,
    status: overrides.status ?? "פתוחה",
    ticket_number: overrides.ticket_number ?? null,
    image_data: overrides.image_data ?? null,
    image_url: overrides.image_url ?? null,
    created_at: overrides.created_at ?? "2026-01-15T10:00:00.000Z",
    closed_at: overrides.closed_at ?? null,
    source_device_id: overrides.source_device_id ?? null,
  };
}

const analyticsFaults: PilotCloudFault[] = [
  makePilotFault({
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "תקלת דלת",
    status: "פתוחה",
  }),
  makePilotFault({
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "תקלת דלת",
    status: "סגורה",
  }),
  makePilotFault({
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "תקלת דלת",
    status: "סגורה",
  }),
  makePilotFault({
    building_id: "md25",
    elevator_id: "e2",
    fault_type: "רעש",
    status: "סגורה",
  }),
  makePilotFault({
    building_id: "or02",
    elevator_id: "e3",
    fault_type: "עצירה",
    status: "פתוחה",
  }),
];

const analyticsKpis = calculateBuildingKpis(analyticsFaults);
assert(analyticsKpis.totalFaults === 5, "ניתוח master: סך תקלות נכון");
assert(analyticsKpis.openFaults === 2, "ניתוח master: תקלות פתוחות נכון");
assert(analyticsKpis.closedFaults === 3, "ניתוח master: תקלות סגורות נכון");
assert(analyticsKpis.doorFaultCount === 3, "ניתוח master: תקלות דלת נכון");

const recurringOnly = detectRecurringFaults(analyticsFaults);
assert(
  recurringOnly.length === 1 &&
    recurringOnly[0].occurrences === 3 &&
    recurringOnly[0].faultType === "תקלת דלת" &&
    recurringOnly[0].riskLevel === "בינונית",
  "ניתוח master: זיהוי תקלה חוזרת (3 הופעות = בינונית)"
);

const heavyRecurringFaults = [
  ...Array.from({ length: 5 }, (_, i) =>
    makePilotFault({
      id: `heavy-${i}`,
      building_id: "md25",
      elevator_id: "e9",
      fault_type: "כשל חשמלי",
      status: "פתוחה",
    })
  ),
  ...Array.from({ length: 6 }, (_, i) =>
    makePilotFault({
      id: `open-${i}`,
      building_id: "md25",
      elevator_id: `e-open-${i}`,
      fault_type: `סוג-${i}`,
      status: "פתוחה",
    })
  ),
  makePilotFault({
    building_id: "md25",
    elevator_id: "e-dis",
    fault_type: "מושבתת",
    status: "מושבתת",
    is_disabled: true,
  }),
];

const heavyRecurring = detectRecurringFaults(heavyRecurringFaults);
assert(
  heavyRecurring.some((r) => r.occurrences >= 5 && r.riskLevel === "גבוהה"),
  "ניתוח master: סיכון גבוהה מ-5 הופעות"
);

const heavyHealth = calculateBuildingHealthScore(
  heavyRecurringFaults,
  heavyRecurring
);
assert(heavyHealth.score >= 0, "ניתוח master: ציון בריאות לא יורד מתחת ל-0");

const emptyReport = generateClientReportDraft({
  buildingLabel: "בניין ריק",
  periodLabel: "כל התקופה",
  kpis: calculateBuildingKpis([]),
  health: calculateBuildingHealthScore([], []),
  recurring: [],
  insights: ["לא נרשמו דיווחי תקלות בתקופה הנבחרת."],
});
assert(
  emptyReport.fullText.includes("דוח בקרת שירות מעליות") &&
    emptyReport.fullText.includes("בניין ריק"),
  "ניתוח master: דוח נוצר גם ללא תקלות"
);

const masterAnalyticsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/master-analytics.ts"),
  "utf8"
);
assert(
  masterAnalyticsSource.includes("calculateBuildingKpis") &&
    masterAnalyticsSource.includes("calculateBuildingHealthScore") &&
    masterAnalyticsSource.includes("detectRecurringFaults") &&
    masterAnalyticsSource.includes("generateProfessionalInsights") &&
    masterAnalyticsSource.includes("generateClientReportDraft"),
  "ניתוח master: כל פונקציות החישוב ב-lib/master-analytics.ts"
);

const masterAnalyticsUi = fs.readFileSync(
  path.join(process.cwd(), "components/MasterAnalyticsSection.tsx"),
  "utf8"
);
assert(
  masterAnalyticsSource.includes("buildMasterAnalytics") &&
    masterAnalyticsUi.includes("ניתוח מקצועי לבניין") &&
    masterAnalyticsUi.includes("העתק דוח"),
  "ניתוח master: UI מקצועי ב-/master בלבד"
);
assert(
  masterSource.includes("MasterAnalyticsSection") &&
    masterSource.includes("ניתוח מקצועי לבניין") === false,
  "ניתוח master: לוגיקה לא ב-MasterPageContent"
);

const scopedAnalytics = buildMasterAnalytics(analyticsFaults, {
  buildingId: "md25",
});
assert(
  scopedAnalytics.kpis.totalFaults === 4,
  "ניתוח master: סינון לפי בניין"
);

assert(
  fs.existsSync(
    path.join(process.cwd(), "supabase/migrations/003_buildings_elevators.sql")
  ),
  "ניהול בניינים: migration SQL קיים"
);

const buildingsCloudSource = fs.readFileSync(
  path.join(process.cwd(), "lib/buildings-cloud.ts"),
  "utf8"
);
assert(
  buildingsCloudSource.includes("createCloudBuilding") &&
    buildingsCloudSource.includes("updateCloudBuilding") &&
    buildingsCloudSource.includes("setCloudBuildingActive") &&
    buildingsCloudSource.includes("deleteCloudBuilding") &&
    buildingsCloudSource.includes("createCloudElevator") &&
    buildingsCloudSource.includes("updateCloudElevator") &&
    buildingsCloudSource.includes("setCloudElevatorActive") &&
    buildingsCloudSource.includes("deleteCloudElevator"),
  "ניהול בניינים: כל פונקציות CRUD מוגדרות"
);

const masterBuildingsUi = fs.readFileSync(
  path.join(process.cwd(), "components/MasterBuildingsSection.tsx"),
  "utf8"
);
assert(
  masterSource.includes("MasterBuildingsSection") &&
    masterSource.includes("ניהול בניינים") &&
    masterBuildingsUi.includes("הוסף בניין") &&
    masterBuildingsUi.includes("הוסף מעלית"),
  "ניהול בניינים: טאב ו-UI ב-/master בלבד"
);
assert(
  !bottomNavMasterCheck.includes("ניהול בניינים"),
  "ניהול בניינים: אין קישור בתפריט לקוח"
);

assert(
  DEFAULT_ELEVATOR_COMPANIES.includes("KONE") &&
    DEFAULT_ELEVATOR_COMPANIES.includes("אלקטרה") &&
    DEFAULT_ELEVATOR_COMPANIES.includes("אחר"),
  "ניהול בניינים: רשימת חברות מעליות"
);

assert(
  normalizeBuildingId(" MD25 ") === "md25",
  "ניהול בניינים: נרמול מזהה בניין"
);

const deleteBuildingGuard = canDeleteBuilding("md25", [
  { building_id: "md25" },
]);
assert(
  !deleteBuildingGuard.allowed,
  "ניהול בניינים: מניעת מחיקת בניין עם דיווחים"
);
assert(
  canDeleteBuilding("ys34", [{ building_id: "md25" }]).allowed,
  "ניהול בניינים: מחיקת בניין ללא דיווחים מותרת"
);

const deleteElevatorGuard = canDeleteElevator("md25", "md25-right", [
  { building_id: "md25", elevator_id: "md25-right" },
]);
assert(
  !deleteElevatorGuard.allowed,
  "ניהול בניינים: מניעת מחיקת מעלית עם דיווחים"
);
assert(
  canDeleteElevator("md25", "md25-left", [
    { building_id: "md25", elevator_id: "md25-right" },
  ]).allowed,
  "ניהול בניינים: מחיקת מעלית ללא דיווחים מותרת"
);

const demoCatalog = buildDemoCatalogSnapshot(getDemoDatasets());
assert(
  demoCatalog.source === "demo" && demoCatalog.allBuildingIds.length === 6,
  "ניהול בניינים: fallback לרשימת דמו"
);

const cloudBuildingRow: CloudBuildingRow = {
  id: "uuid-1",
  building_id: "test01",
  name: "בניין בדיקה",
  city: "תל אביב",
  address: "רחוב 1",
  management_company: "ניהול",
  elevator_company: "KONE",
  contact_name: "ישראל",
  contact_phone: "050",
  floors_count: 10,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};
const cloudElevatorRow: CloudElevatorRow = {
  id: "uuid-2",
  building_id: "test01",
  elevator_id: "el-1",
  elevator_name: "מעלית א",
  floors_count: 10,
  elevator_type: "נוסעים",
  is_active: true,
  status: "פעילה",
  created_at: "2026-01-01T00:00:00Z",
};
const cloudCatalog = buildCloudCatalogSnapshot(
  [cloudBuildingRow],
  [cloudElevatorRow],
  getDemoDatasets()
);
assert(
  cloudCatalog.source === "cloud" &&
    cloudCatalog.buildings.test01?.building.name === "בניין בדיקה" &&
    cloudCatalog.buildings.test01?.elevators.length === 1,
  "ניהול בניינים: מיפוי נתוני Supabase לקטלוג"
);

setCatalogSnapshot(null);

const masterCode = getMasterCode();
if (masterCode) {
  assert(verifyMasterCode(masterCode), "ענן פיילוט: verifyMasterCode — קוד מ-env תקין");
  assert(!verifyMasterCode("wrong-code-xyz"), "ענן פיילוט: קוד שגוי נדחה");
}

// Branding scan
const SCAN_DIRS = ["app", "components", "lib", "public"];
const SCAN_FILES = ["middleware.ts", "package.json"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".json", ".txt", ".xml", ".css", ".md"]);

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...collectFiles(full));
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

const brandFiles = [
  ...SCAN_DIRS.flatMap((d) => collectFiles(path.join(process.cwd(), d))),
  ...SCAN_FILES.map((f) => path.join(process.cwd(), f)).filter((f) =>
    fs.existsSync(f)
  ),
].filter((f) => !f.endsWith(`${path.sep}lib${path.sep}brand.ts`));

let brandHits = 0;
for (const file of brandFiles) {
  const content = fs.readFileSync(file, "utf8");
  for (const term of FORBIDDEN_BRAND_TERMS) {
    const isHebrewShort = term === "יועץ" || term === "יועצת" || term === "ייעוץ";
    const found = isHebrewShort
      ? new RegExp(`(?<![\\u0590-\\u05FF])${term}(?![\\u0590-\\u05FF])`, "i").test(
          content
        )
      : content.toLowerCase().includes(term.toLowerCase());
    if (found) {
      brandHits++;
      failed++;
      console.error(`✗ מיתוג: "${term}" נמצא ב-${path.relative(process.cwd(), file)}`);
    }
  }
}

assert(brandHits === 0, `מיתוג: אין מונחים אסורים (${brandHits} מופעים)`);
assert(
  BRAND_EDITOR_NAME === "יהודה פורטה",
  "מיתוג: שם עורך רשמי"
);
assert(
  BRAND_EDITOR_TITLE === "שמאות וליווי מקצועי למעליות",
  "מיתוג: תואר רשמי"
);

console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===`);
console.log(`=== מיתוג: ${brandFiles.length} קבצים נסרקו ===\n`);
process.exit(failed > 0 ? 1 : 0);
