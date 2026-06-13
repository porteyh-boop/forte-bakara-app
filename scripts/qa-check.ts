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
  getAllDemoBuildingIds,
  getBuildingDataset,
  getDemoDatasets,
  getStaticDemoBuildingMeta,
  isValidBuildingId,
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
  mapPilotFeedbackRow,
  PILOT_FAULTS_TABLE,
  PILOT_FEEDBACK_TABLE,
  verifyMasterCode,
  type PilotCloudFault,
} from "../lib/pilot-cloud";
import {
  reconcileSubmittedReportsWithCloud,
} from "../lib/report-cloud-sync";
import {
  filterFaultsForLiveStart,
  isAfterLiveStart,
} from "../lib/building-live";
import {
  buildMasterElevatorDossierPath,
  MASTER_ELEVATOR_DOSSIER_ROUTE_PREFIX,
} from "../lib/master-elevator-routes";
import {
  clearElevatorFaultFilters,
  DEFAULT_ELEVATOR_FAULT_FILTERS,
  filterElevatorDossierFaults,
  getUniqueFaultTypesFromFaults,
  isElevatorFaultFilterActive,
} from "../lib/master-elevator-fault-filters";
import {
  buildClientAccessPath,
  deactivateClientAccess,
  generateAccessToken,
  getClientAccessGateMessage,
  isAccessTokenIndependentOfScope,
  isClientAccessPath,
  resolveClientAccessGate,
  scopeElevatorsForClientAccess,
  scopeFaultsForClientAccess,
  type ClientAccessSession,
} from "../lib/client-access";
import {
  CLIENT_PERMISSION_KEYS,
  CLIENT_PERMISSION_LABELS,
  DEFAULT_CLIENT_PERMISSIONS,
  extractClientPermissionFlags,
  formatClientActivityAction,
  formatClientActivityDetails,
} from "../lib/client-permissions";
import {
  CLIENT_TYPE_OPTIONS,
  computePortalDataLastUpdated,
  DEFAULT_CLIENT_WELCOME_MESSAGE,
  formatClientPortalLastUpdated,
  resolveClientWelcomeMessage,
} from "../lib/client-profile";
import {
  CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE,
} from "../lib/client-portal-building";
import {
  CLIENT_PORTAL_ACTIVITY,
  CLIENT_PORTAL_FAULT_SOURCE,
  computeClientPortalStats,
} from "../lib/client-portal";
import {
  clampFaultImageZoom,
  isFaultImageLightboxCloseKey,
  isRemoteFaultImageSrc,
  restoreFaultImageLightboxScroll,
  resolveFaultReportImages,
  resolveFaultReportImagesFromCloud,
  shouldCloseFaultImageLightboxOnBackdrop,
} from "../lib/fault-images";
import {
  buildDocumentInsertRow,
  buildDocumentPublicUrl,
  buildDocumentStoragePath,
  collectDocumentTags,
  DOCUMENT_CENTER_BUCKET,
  DOCUMENT_PREDEFINED_TAGS,
  DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR,
  DOCUMENT_TYPES,
  extractDocumentStoragePath,
  filterDocuments,
  formatDocumentTags,
  getDocumentFilterTagOptions,
  getDocumentLegacyFilterTags,
  getDocumentTagFilterMatches,
  getDocumentTypeLabel,
  documentHasTagFilter,
  isDocumentReadyForAi,
  isDocumentReadyForOcr,
  isPredefinedDocumentTag,
  normalizeDocumentTags,
  normalizePredefinedDocumentTags,
  parseDocumentTagsInput,
  resolveDocumentContentType,
  resolveStorageExtension,
  validateCreateDocumentInput,
  validateDocumentCenterFile,
  type DocumentRecord,
} from "../lib/document-center";
import {
  buildDocumentInspectorMetaInsertRow,
  DOCUMENT_INSPECTOR_META_TABLE,
} from "../lib/document-inspector-meta";
import {
  DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE,
  getInspectorNotificationSentLabel,
  type InspectorNotificationType,
} from "../lib/document-inspector-notifications";
import {
  buildInspectorNotificationEmailText,
  buildInspectorNotificationSubject,
  INSPECTOR_NOTIFY_EMAIL,
} from "../lib/inspector-notification-email";
import {
  pickInspectorNotificationToSend,
  resolveInspectorNotificationType,
} from "../lib/inspector-daily-notifications";
import {
  buildInspectorReportPublicUrl,
  buildInspectorReportStoragePath,
  closeInspectorReportLocally,
  computeInspectorDeadlineAt,
  computeInspectorFollowUpPhase,
  daysSinceReportDate,
  extractInspectorReportStoragePath,
  generateUrgentLetterTemplate,
  getInspectorReportDocumentUrl,
  INSPECTOR_ALERT_DAY,
  INSPECTOR_REMINDER_DAY,
  INSPECTOR_REPORT_ALLOWED_EXTENSIONS,
  INSPECTOR_REPORTS_BUCKET,
  INSPECTOR_URGENT_DAY,
  validateInspectorReportFile,
  validateInspectorReportInput,
  type InspectorReportRecord,
} from "../lib/inspector-report-tracking";
import {
  buildMasterBuildingList,
  summarizeFaultBuildings,
} from "../lib/master-buildings-list";
import {
  formatFeedbackNotes,
  getMasterFeedbackEmptyMessage,
} from "../lib/master-feedback-view";
import {
  buildMasterAnalytics,
  buildPortfolioAnalytics,
  calculateBuildingHealthScore,
  calculateBuildingKpis,
  detectRecurringFaults,
  generateClientReportDraft,
  generatePortfolioReportDraft,
  summarizeFaultTypes,
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
  buildMergedClientCatalogSnapshot,
  getCatalogSnapshot,
  resolveAllBuildingIdsForMaster,
  resolveBuildingDatasetStrict,
  setCatalogSnapshot,
} from "../lib/buildings-catalog";
import {
  buildBuildingDossier,
  buildElevatorDossier,
  filterFaultsForBuilding,
} from "../lib/master-building-dossier";
import {
  generateProfessionalAssessment,
  mapClientFaultForAssessment,
  mapPilotFaultForAssessment,
} from "../lib/professional-assessment";
import {
  evaluateProfessionalRules,
  exportRulesAsJson,
  getRulesByCategory,
  PROFESSIONAL_RULE_CATEGORIES,
  PROFESSIONAL_RULES,
} from "../lib/professional-rules";
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
  faultCardSource.includes("FaultReportImageThumbnails") &&
    faultCardSource.includes("פתח תמונה") &&
    faultCardSource.includes("הורד תמונה") &&
    faultCardSource.includes("resolveFaultReportImagesFromFault"),
  "תמונה: הצגה בכרטיס תקלה בהיסטוריה"
);

const faultImagesLib = fs.readFileSync(
  path.join(process.cwd(), "lib/fault-images.ts"),
  "utf8"
);
const faultImageLightboxSource = fs.readFileSync(
  path.join(process.cwd(), "components/FaultImageLightbox.tsx"),
  "utf8"
);
const masterCloudFaultCardSource = fs.readFileSync(
  path.join(process.cwd(), "components/MasterCloudFaultCard.tsx"),
  "utf8"
);
assert(
  faultImagesLib.includes("resolveFaultReportImages") &&
    faultImagesLib.includes("image_url") &&
    faultImagesLib.includes("isFaultImageLightboxCloseKey") &&
    faultImagesLib.includes("restoreFaultImageLightboxScroll") &&
    faultImagesLib.includes("shouldCloseFaultImageLightboxOnBackdrop") &&
    faultImageLightboxSource.includes("export default function FaultImageLightbox") &&
    faultImageLightboxSource.includes("onTouchMove") &&
    faultImageLightboxSource.includes("onWheel") &&
    faultImageLightboxSource.includes("הורד תמונה"),
  "תמונה: lib תצוגה מלאה + zoom"
);
assert(
  isFaultImageLightboxCloseKey("Escape") &&
    !isFaultImageLightboxCloseKey("Enter") &&
    shouldCloseFaultImageLightboxOnBackdrop(null, null) === false &&
    faultImageLightboxSource.includes("handleClose") &&
    faultImageLightboxSource.includes("handleBackdropClose") &&
    faultImageLightboxSource.includes("✕") &&
    faultImageLightboxSource.includes("restoreFaultImageLightboxScroll") &&
    faultImageLightboxSource.includes("isFaultImageLightboxCloseKey"),
  "תמונה: סגירת lightbox — כפתור, רקע ו-ESC"
);
assert(
  masterCloudFaultCardSource.includes("פתח תמונה") &&
    masterCloudFaultCardSource.includes("הורד תמונה") &&
    masterCloudFaultCardSource.includes("FaultReportImageThumbnails") &&
    masterCloudFaultCardSource.includes("resolveFaultReportImagesFromCloud"),
  "תמונה: Master — תצוגה מלאה וכפתורי פעולה"
);
assert(
  resolveFaultReportImages({
    imageUrl: "https://example.supabase.co/storage/v1/object/public/faults/a.jpg",
    imageData: "data:image/jpeg;base64,abc",
  }).length === 1 &&
    resolveFaultReportImages({
      imageUrl: "https://example.supabase.co/storage/v1/object/public/faults/a.jpg",
      imageData: "data:image/jpeg;base64,abc",
    })[0].fromStorage === true &&
    resolveFaultReportImages({
      imageData: '["https://example.com/1.jpg","https://example.com/2.jpg"]',
    }).length === 2 &&
    resolveFaultReportImagesFromCloud({
      image_url: null,
      image_data: "data:image/jpeg;base64,abc",
    }).length === 1 &&
    clampFaultImageZoom(5) === 4 &&
    isRemoteFaultImageSrc("https://x.com/a.jpg"),
  "תמונה: עדיפות Storage URL וריבוי תמונות"
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

const reportCloudSyncSource = fs.readFileSync(
  path.join(process.cwd(), "lib/report-cloud-sync.ts"),
  "utf8"
);
const useSubmittedReportsSource = fs.readFileSync(
  path.join(process.cwd(), "hooks/useSubmittedReports.ts"),
  "utf8"
);
assert(
  reportCloudSyncSource.includes("reconcileSubmittedReportsWithCloud") &&
    reportCloudSyncSource.includes("syncSubmittedReportsWithCloud") &&
    useSubmittedReportsSource.includes("syncSubmittedReportsWithCloud"),
  "סנכרון היסטוריה: טעינה מול Supabase ב-useSubmittedReports"
);

assert(
  pilotCloudSource.includes("getPilotFaultsForBuilding"),
  "סנכרון היסטוריה: שליפת תקלות לפי building_id"
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
assert(
  pilotCloudSource.includes("logPilotFeedbackLoadDebug") &&
    pilotCloudSource.includes("mapPilotFeedbackRow"),
  "משוב master: לוג ומיפוי שדות pilot_feedback"
);
assert(
  masterSource.includes("getMasterFeedbackEmptyMessage") &&
    masterSource.includes("pilot_feedback") &&
    masterSource.includes("sender_name"),
  "משוב master: טאב משובים טוען ומציג pilot_feedback"
);

const mappedFeedback = mapPilotFeedbackRow({
  id: "fb-1",
  building_id: "md25",
  building_name: "מגדל דוד 25",
  sender_name: "ישראל",
  sender_role: "ועד",
  rating: 5,
  would_use_regularly: "כן",
  unclear_or_missing: "חסר X",
  expected_feature: "Y",
  would_recommend: "כן",
  created_at: "2026-06-01T10:00:00.000Z",
});
assert(
  mappedFeedback?.sender_name === "ישראל" &&
    mappedFeedback?.would_recommend === "כן",
  "משוב master: מיפוי שדות Supabase"
);
assert(
  getMasterFeedbackEmptyMessage(3, 0, true).includes("אין תוצאות לאחר הסינון"),
  "משוב master: הודעה כשסינון מסתיר משובים"
);
assert(
  getMasterFeedbackEmptyMessage(0, 0, true) === "אין משובים בענן",
  "משוב master: הודעה כשאין משובים"
);
assert(
  formatFeedbackNotes("חסר", "פיצ'ר") === "חסר/לא ברור: חסר · פעולה מצופה: פיצ'ר",
  "משוב master: עיצוב הערות"
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
    fault_source: overrides.fault_source ?? null,
  };
}

const staleLocalReport: import("../lib/types").Fault = {
  id: "user-FB-20260101-0001",
  ticketNumber: "FB-20260101-0001",
  elevatorId: "e1",
  elevatorName: "מעלית 1",
  type: "אחר",
  description: "תקלה ישנה שנשמרה מקומית",
  status: "פתוחה",
  priority: "רגילה",
  reportedAt: "2026-01-01T10:00:00.000Z",
  isUserSubmitted: true,
};

const pendingLocalReport: import("../lib/types").Fault = {
  ...staleLocalReport,
  id: "user-FB-20260605-0002",
  ticketNumber: "FB-20260605-0002",
  reportedAt: "2026-06-05T11:59:00.000Z",
};

const afterReset = reconcileSubmittedReportsWithCloud({
  localReports: [staleLocalReport],
  cloudFaults: [],
  now: Date.parse("2026-06-05T12:00:00.000Z"),
});
assert(
  afterReset.length === 0,
  "סנכרון היסטוריה: אחרי איפוס ענן — דיווח מקומי ישן לא מוצג"
);

const pendingOnly = reconcileSubmittedReportsWithCloud({
  localReports: [pendingLocalReport],
  cloudFaults: [],
  now: Date.parse("2026-06-05T12:00:00.000Z"),
});
assert(
  pendingOnly.length === 1 &&
    pendingOnly[0].ticketNumber === pendingLocalReport.ticketNumber,
  "סנכרון היסטוריה: דיווח חדש ממתין לענן נשמר זמנית"
);

const cloudKeeps = reconcileSubmittedReportsWithCloud({
  localReports: [staleLocalReport],
  cloudFaults: [
    makePilotFault({
      building_id: "md25",
      elevator_id: "e1",
      ticket_number: "FB-20260605-0003",
      fault_type: "רעש",
      status: "פתוחה",
    }),
  ],
  now: Date.parse("2026-06-05T12:00:00.000Z"),
});
assert(
  cloudKeeps.length === 1 &&
    cloudKeeps[0].ticketNumber === "FB-20260605-0003" &&
    cloudKeeps[0].isUserSubmitted === true,
  "סנכרון היסטוריה: כשענן מחובר — נתוני ענן מועדפים"
);

const liveStartedAt = "2026-06-05T12:00:00.000Z";
assert(
  filterFaultsForLiveStart(
    [
      {
        ...staleLocalReport,
        reportedAt: "2026-01-01T10:00:00.000Z",
      },
    ],
    liveStartedAt
  ).length === 0,
  "שימוש אמיתי: תקלות דemo/ישנות לפני live_started_at לא מוצגות"
);
assert(
  isAfterLiveStart("2026-06-05T13:00:00.000Z", liveStartedAt),
  "שימוש אמיתי: דיווח אחרי live_started_at מזוהה"
);
assert(
  reconcileSubmittedReportsWithCloud({
    localReports: [
      staleLocalReport,
      {
        ...pendingLocalReport,
        reportedAt: "2026-06-05T12:00:01.000Z",
      },
    ],
    cloudFaults: [],
    liveStartedAt,
    now: Date.parse("2026-06-05T12:00:02.000Z"),
  }).length === 1,
  "שימוש אמיתי: אחרי אתחול נשאר רק דיווח חדש ממתין"
);

const md25CtxLiveStart = getBuildingDataset("md25");
const md25RuntimeLive = buildRuntimeBuildingContext(
  md25CtxLiveStart,
  [],
  "md25",
  true,
  liveStartedAt
);
assert(
  md25RuntimeLive.faults.length === 0 &&
    getOpenFaults(md25CtxLiveStart, [], "md25", true, liveStartedAt).length ===
      0 &&
    getClientStats(md25CtxLiveStart, [], "md25", true, liveStartedAt)
      .totalFaults === 0,
  "לקוח: מסך בניין — live_started_at מסנן תקלות דemo כמו /buildings"
);
assert(
  getOpenFaults(md25CtxLiveStart, [], "md25", true, null).length > 0,
  "לקוח: ללא live_started_at — תקלות דemo נשארות"
);

assert(
  fs.existsSync(
    path.join(
      process.cwd(),
      "supabase/migrations/004_buildings_live_started_at.sql"
    )
  ),
  "שימוש אמיתי: migration live_started_at קיים"
);

const buildingsCloudLiveSource = fs.readFileSync(
  path.join(process.cwd(), "lib/buildings-cloud.ts"),
  "utf8"
);
assert(
  buildingsCloudLiveSource.includes("initializeBuildingForLiveUse") &&
    buildingsCloudLiveSource.includes("live_started_at") &&
    buildingsCloudLiveSource.includes(
      "פעולה זו תאפס את נתוני הבניין ותתחיל שימוש אמיתי מאפס"
    ),
  "שימוש אמיתי: אתחול בניין ב-buildings-cloud"
);

const masterBuildingsLiveUi = fs.readFileSync(
  path.join(process.cwd(), "components/MasterBuildingsSection.tsx"),
  "utf8"
);
assert(
  masterBuildingsLiveUi.includes("אתחל בניין לשימוש אמיתי") &&
    masterBuildingsLiveUi.includes("handleInitializeForLiveUse") &&
    masterBuildingsLiveUi.includes("buildMasterBuildingList") &&
    masterBuildingsLiveUi.includes("getAllDemoBuildingIds") &&
    masterBuildingsLiveUi.includes("getStaticDemoBuildingMeta") &&
    masterBuildingsLiveUi.includes("מקור:"),
  "שימוש אמיתי: כפתור אתחול ב-/master"
);

assert(
  getAllDemoBuildingIds().length === 6,
  "ניהול בניינים: רשימת דמו קבועה — 6 בניינים"
);

const afterInitMasterList = buildMasterBuildingList({
  cloudBuildings: [
    {
      id: "uuid-md25",
      building_id: "md25",
      name: "מגדל דוד 25 (ענן)",
      city: "מודיעין",
      address: null,
      management_company: null,
      elevator_company: null,
      contact_name: null,
      contact_phone: null,
      floors_count: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      live_started_at: "2026-06-10T12:00:00.000Z",
    },
  ],
  demoBuildingIds: getAllDemoBuildingIds(),
  resolveDemoName: (id) => getStaticDemoBuildingMeta(id).name,
  resolveDemoCity: (id) => getStaticDemoBuildingMeta(id).city,
  faultBuildings: [],
});
assert(
  afterInitMasterList.length === 6 &&
    afterInitMasterList.every((entry) => entry.sources.includes("דמו")) &&
    Boolean(
      afterInitMasterList
        .find((entry) => entry.buildingId === "md25")
        ?.sources.includes("ענן")
    ),
  "ניהול בניינים: אחרי אתחול — כל 6 הדemo + מקור ענן לבניין שאותחל"
);

const unifiedMasterList = buildMasterBuildingList({
  cloudBuildings: [],
  demoBuildingIds: ["md25", "ys34"],
  resolveDemoName: (id) => (id === "md25" ? "מגדל דוד 25" : "ישורון 34"),
  resolveDemoCity: (id) => (id === "md25" ? "מודיעין" : "הוד השרון"),
  faultBuildings: summarizeFaultBuildings([
    {
      building_id: "or02",
      building_name: "אורן 2",
    },
  ]),
});
assert(
  unifiedMasterList.length === 3 &&
    unifiedMasterList.some(
      (b) => b.buildingId === "md25" && b.sources.includes("דמו")
    ) &&
    unifiedMasterList.some(
      (b) =>
        b.buildingId === "or02" &&
        b.sources.includes("מדיווחים") &&
        !b.sources.includes("ענן")
    ),
  "ניהול בניינים: רשימה מאוחדת — דemo + מדיווחים גם בלי Supabase"
);

const unifiedWithCloud = buildMasterBuildingList({
  cloudBuildings: [
    {
      id: "uuid-md25",
      building_id: "md25",
      name: "מגדל דוד 25",
      city: "מודיעין",
      address: null,
      management_company: null,
      elevator_company: null,
      contact_name: null,
      contact_phone: null,
      floors_count: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      live_started_at: null,
    },
  ],
  demoBuildingIds: ["md25"],
  resolveDemoName: () => "מגדל דוד 25",
  resolveDemoCity: () => "מודיעין",
  faultBuildings: [],
});
assert(
  unifiedWithCloud.length === 1 &&
    unifiedWithCloud[0].sources.includes("ענן") &&
    unifiedWithCloud[0].sources.includes("דמו"),
  "ניהול בניינים: מקורות ענן + דמו לבניין אחד"
);

assert(
  buildingsCloudLiveSource.includes("mapCloudBuildingRow") &&
    buildingsCloudLiveSource.includes("getAllCloudBuildingsWithMeta"),
  "ניהול בניינים: מיפוי בטוח ל-live_started_at"
);

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
    emptyReport.fullText.includes("בניין ריק") &&
    emptyReport.fullText.includes("א. סיכום מנהלים") &&
    emptyReport.fullText.includes("ז. המלצות"),
  "ניתוח master: דוח בניין נוצר גם ללא תקלות"
);

const buildingReportWithDetails = generateClientReportDraft({
  buildingLabel: "מגדל דוד 25",
  periodLabel: "2026-01-01 עד 2026-06-01",
  kpis: analyticsKpis,
  health: calculateBuildingHealthScore(analyticsFaults, recurringOnly),
  recurring: recurringOnly,
  insights: ["בדיקה"],
  details: {
    name: "מגדל דוד 25",
    city: "מודיעין",
    address: "דוד 25",
    elevatorCompany: "צום",
    elevatorCount: 2,
  },
  elevatorLines: [
    {
      elevatorId: "e1",
      elevatorName: "מעלית 1",
      faultCount: 3,
      openFaultCount: 1,
      statusLabel: "פעילה",
    },
  ],
  faultTypes: summarizeFaultTypes(analyticsFaults),
});
assert(
  buildingReportWithDetails.fullText.includes("פרטי הבניין") &&
    buildingReportWithDetails.fullText.includes("מודיעין") &&
    buildingReportWithDetails.fullText.includes("ב. מצב המעליות בבניין") &&
    buildingReportWithDetails.fullText.includes("ה. סוגי תקלות עיקריים"),
  "ניתוח master: דוח בניין כולל פרטים וסעיפים"
);

const portfolioSummary = buildPortfolioAnalytics(
  analyticsFaults,
  {},
  ["md25", "or02"],
  (id) => (id === "md25" ? "מגדל דוד 25" : "בניין אור"),
  (id) => (id === "md25" ? 2 : 1)
);
assert(
  portfolioSummary.buildingCount === 2 &&
    portfolioSummary.totalFaults === 5 &&
    portfolioSummary.rankings[0].buildingId === "md25",
  "ניתוח master: דוח ניהולי — סיכום ודירוג"
);

const portfolioReport = generatePortfolioReportDraft({
  periodLabel: "כל התקופה",
  portfolio: portfolioSummary,
});
assert(
  portfolioReport.fullText.includes("דוח ניהולי — כל הבניינים") &&
    portfolioReport.fullText.includes("דירוג בניינים") &&
    portfolioReport.fullText.includes("בניינים בעייתיים"),
  "ניתוח master: דוח ניהולי נוצר"
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
    masterAnalyticsSource.includes("buildPortfolioAnalytics") &&
    masterAnalyticsSource.includes("generatePortfolioReportDraft") &&
    masterAnalyticsUi.includes("ניתוח מקצועי לבניין") &&
    masterAnalyticsUi.includes("בניין לניתוח") &&
    masterAnalyticsUi.includes("הפק דוח לבניין") &&
    masterAnalyticsUi.includes("העתק דוח ניהולי"),
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
    cloudCatalog.allBuildingIds.length === 7 &&
    cloudCatalog.activeBuildingIds.length === 7 &&
    cloudCatalog.buildings.test01?.building.name === "בניין בדיקה" &&
    cloudCatalog.buildings.test01?.elevators.length === 1 &&
    cloudCatalog.buildings.md25?.elevators.length === 2,
  "ניהול בניינים: מיפוי נתוני Supabase לקטלוג"
);

const initializedLiveCatalog = buildMergedClientCatalogSnapshot(
  [
    {
      id: "uuid-md25",
      building_id: "md25",
      name: "מגדל דוד 25",
      city: "מודיעין",
      address: null,
      management_company: null,
      elevator_company: null,
      contact_name: null,
      contact_phone: null,
      floors_count: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      live_started_at: "2026-06-10T12:00:00.000Z",
    },
  ],
  [],
  getDemoDatasets()
);
assert(
  initializedLiveCatalog.allBuildingIds.length === 6 &&
    initializedLiveCatalog.activeBuildingIds.length === 6 &&
    initializedLiveCatalog.buildings.md25?.elevators.length === 2 &&
    initializedLiveCatalog.liveStartedAtByBuilding.md25 ===
      "2026-06-10T12:00:00.000Z",
  "לקוח: אחרי אתחול — כל 6 הבניינים + מעליות דemo כ-fallback"
);

setCatalogSnapshot(initializedLiveCatalog);
assert(
  getAllBuildingIds().length === 6 &&
    getLiveBuildingListItems({}, true).length === 6 &&
    isValidBuildingId("md25") &&
    isValidBuildingId("ys34"),
  "לקוח: /buildings מציג את כל הבניינים אחרי אתחול בניין אחד"
);
const liveMd25Items = getLiveBuildingListItems(
  {},
  true,
  undefined,
  initializedLiveCatalog.liveStartedAtByBuilding
);
assert(
  (liveMd25Items.find((b) => b.id === "md25")?.openFaultCount ?? -1) === 0 &&
    Boolean(liveMd25Items.find((b) => b.id === "md23")) &&
    (liveMd25Items.find((b) => b.id === "md23")?.openFaultCount ?? 0) > 0,
  "לקוח: live_started_at מסנן תקלות ישנות בלבד — לא מסתיר בניינים"
);
setCatalogSnapshot(null);

setCatalogSnapshot(cloudCatalog);
assert(
  resolveAllBuildingIdsForMaster(getDemoDatasets()).length === 7,
  "ניהול בניינים: resolveAllBuildingIdsForMaster — דemo + ענן"
);
setCatalogSnapshot(null);

const dossierFaults: PilotCloudFault[] = [
  makePilotFault({
    building_id: "md25",
    building_name: "מגדל דוד 25",
    elevator_id: "e1",
    elevator_name: "מעלית 1",
    fault_type: "דלת",
    status: "פתוחה",
    created_at: "2026-06-01T10:00:00.000Z",
  }),
  makePilotFault({
    building_id: "md25",
    building_name: "מגדל דוד 25",
    elevator_id: "e1",
    elevator_name: "מעלית 1",
    fault_type: "דלת",
    status: "סגורה",
    created_at: "2026-06-02T10:00:00.000Z",
  }),
  makePilotFault({
    building_id: "md25",
    building_name: "מגדל דוד 25",
    elevator_id: "e2",
    elevator_name: "מעלית 2",
    fault_type: "רעש",
    status: "סגורה",
    created_at: "2026-06-03T10:00:00.000Z",
  }),
];

const buildingDossier = buildBuildingDossier({
  buildingId: "md25",
  buildingName: "מגדל דוד 25",
  faults: dossierFaults,
  registeredElevatorIds: ["e1", "e2"],
});
assert(buildingDossier.totalFaults === 3, "תיק בניין: סה\"כ תקלות");
assert(buildingDossier.openFaults === 1, "תיק בניין: תקלות פתוחות");
assert(buildingDossier.closedFaults === 2, "תיק בניין: תקלות סגורות");
assert(buildingDossier.elevatorCount === 2, "תיק בניין: מספר מעליות");
assert(
  buildingDossier.faultsByElevator.find((e) => e.elevatorId === "e1")?.count === 2,
  "תיק בניין: תקלות לפי מעלית"
);
assert(
  buildingDossier.lastFaultDate === "2026-06-03T10:00:00.000Z",
  "תיק בניין: תקלה אחרונה"
);
assert(
  buildingDossier.healthScore >= 0 && buildingDossier.healthScore <= 100,
  "תיק בניין: ציון בריאות"
);

const elevatorDossier = buildElevatorDossier({
  buildingId: "md25",
  elevatorId: "e1",
  elevatorName: "מעלית 1",
  faults: dossierFaults,
});
assert(elevatorDossier.totalFaults === 2, "תיק מעלית: סה\"כ תקלות");
assert(elevatorDossier.openFaults === 1, "תיק מעלית: פתוחות");
assert(elevatorDossier.closedFaults === 1, "תיק מעלית: סגורות");
assert(
  filterFaultsForBuilding(dossierFaults, "md25").length === 3,
  "תיק בניין: סינון לפי building_id"
);

const masterBuildingsUiDossier = fs.readFileSync(
  path.join(process.cwd(), "components/MasterBuildingsSection.tsx"),
  "utf8"
);
assert(
  masterBuildingsUiDossier.includes("היסטוריית תקלות הבניין") &&
    masterBuildingsUiDossier.includes("תיק בניין") &&
    masterBuildingsUiDossier.includes("buildBuildingDossier"),
  "תיק בניין: UI במסך ניהול בניינים"
);

const elevatorDossierRouteFile = path.join(
  process.cwd(),
  "app/master/elevator/[buildingId]/[elevatorId]/page.tsx"
);
const elevatorDossierPageContent = path.join(
  process.cwd(),
  "components/MasterElevatorDossierPageContent.tsx"
);
assert(
  fs.existsSync(elevatorDossierRouteFile),
  "תיק מעלית: route קיים"
);
assert(
  fs.existsSync(elevatorDossierPageContent),
  "תיק מעלית: קומפוננטת עמוד קיימת"
);

const sampleElevatorHref = buildMasterElevatorDossierPath("md25", "md25-right");
assert(
  sampleElevatorHref.includes("md25") &&
    sampleElevatorHref.includes("md25-right") &&
    sampleElevatorHref.startsWith(MASTER_ELEVATOR_DOSSIER_ROUTE_PREFIX),
  "תיק מעלית: קישור כולל buildingId ו-elevatorId"
);

assert(
  masterBuildingsUiDossier.includes("ElevatorDossierLink") &&
    masterBuildingsUiDossier.includes("buildMasterElevatorDossierPath") &&
    masterBuildingsUiDossier.includes("לחצו לצפייה בתיק המעלית") &&
    masterBuildingsUiDossier.includes('href={href}'),
  "תיק מעלית: קישור פעיל עם href במסך Master"
);

assert(
  !masterBuildingsUiDossier.includes("selectElevator("),
  "תיק מעלית: אין toggle ללא ניווט"
);

const elevatorPageSource = fs.readFileSync(elevatorDossierPageContent, "utf8");
assert(
  elevatorPageSource.includes("חזרה ל-Master") &&
    elevatorPageSource.includes("היסטוריית תקלות") &&
    elevatorPageSource.includes("סטטוס מעלית") &&
    elevatorPageSource.includes("מספר תחנות"),
  "תיק מעלית: עמוד ייעודי עם פרטי מעלית והיסטוריה"
);

const elevatorFilterFaults: PilotCloudFault[] = [
  makePilotFault({
    id: "ef-open",
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "דלת",
    status: "פתוחה",
    description: "דלת לא נסגרת בקומה 5",
    created_at: "2026-05-20T10:00:00.000Z",
  }),
  makePilotFault({
    id: "ef-progress",
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "רעש",
    status: "בטיפול",
    description: "רעש חריג בהינע",
    created_at: "2026-05-01T10:00:00.000Z",
  }),
  makePilotFault({
    id: "ef-fixed",
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "פיקוד",
    status: "טופלה",
    description: "תקלת פיקוד בלוח",
    created_at: "2026-04-01T10:00:00.000Z",
  }),
  makePilotFault({
    id: "ef-closed",
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "דלת",
    status: "סגורה",
    description: "דלת נתקעה בפתיחה",
    created_at: "2025-01-01T10:00:00.000Z",
  }),
];

const elevatorFilterNow = new Date("2026-06-05T12:00:00.000Z");

assert(
  filterElevatorDossierFaults(elevatorFilterFaults, {
    ...DEFAULT_ELEVATOR_FAULT_FILTERS,
    status: "פתוחה",
  }, elevatorFilterNow).length === 1,
  "תיק מעלית סינון: סטטוס פתוחה"
);
assert(
  filterElevatorDossierFaults(elevatorFilterFaults, {
    ...DEFAULT_ELEVATOR_FAULT_FILTERS,
    faultType: "דלת",
  }, elevatorFilterNow).length === 2,
  "תיק מעלית סינון: סוג תקלה דלת"
);
assert(
  filterElevatorDossierFaults(elevatorFilterFaults, {
    ...DEFAULT_ELEVATOR_FAULT_FILTERS,
    period: "30d",
  }, elevatorFilterNow).length === 1,
  "תיק מעלית סינון: 30 יום אחרונים"
);
assert(
  filterElevatorDossierFaults(elevatorFilterFaults, {
    ...DEFAULT_ELEVATOR_FAULT_FILTERS,
    searchQuery: "רעש",
  }, elevatorFilterNow).length === 1,
  "תיק מעלית סינון: חיפוש חופשי בתיאור"
);
assert(
  filterElevatorDossierFaults(
    elevatorFilterFaults,
    {
      ...DEFAULT_ELEVATOR_FAULT_FILTERS,
      status: "סגורה",
      searchQuery: "נתקעה",
    },
    elevatorFilterNow
  ).length === 1,
  "תיק מעלית סינון: שילוב סטטוס וחיפוש"
);
assert(
  filterElevatorDossierFaults(
    elevatorFilterFaults,
    clearElevatorFaultFilters(),
    elevatorFilterNow
  ).length === elevatorFilterFaults.length,
  "תיק מעלית סינון: ניקוי מחזיר את כל התקלות"
);
assert(
  getUniqueFaultTypesFromFaults(elevatorFilterFaults).join(",") ===
    "דלת,פיקוד,רעש",
  "תיק מעלית סינון: סוגי תקלה ייחודיים מהרשימה"
);
assert(
  !isElevatorFaultFilterActive(DEFAULT_ELEVATOR_FAULT_FILTERS) &&
    isElevatorFaultFilterActive({
      ...DEFAULT_ELEVATOR_FAULT_FILTERS,
      searchQuery: "דלת",
    }),
  "תיק מעלית סינון: זיהוי סינון פעיל"
);
assert(
  elevatorPageSource.includes("סינון היסטוריית תקלות") &&
    elevatorPageSource.includes("נקה סינון") &&
    elevatorPageSource.includes("מוצגות") &&
    elevatorPageSource.includes("לא נמצאו תקלות בהתאם לסינון שנבחר") &&
    elevatorPageSource.includes("filterElevatorDossierFaults"),
  "תיק מעלית סינון: UI ולוגיקה בצד לקוח"
);

const clientAccessMigration = path.join(
  process.cwd(),
  "supabase/migrations/005_client_access_links.sql"
);
assert(
  fs.existsSync(clientAccessMigration),
  "גישת לקוח: migration 005 קיים"
);

const clientAccessMigrationSql = fs.readFileSync(clientAccessMigration, "utf8");
assert(
  clientAccessMigrationSql.includes("client_users") &&
    clientAccessMigrationSql.includes("client_access") &&
    clientAccessMigrationSql.includes("idx_client_users_access_token"),
  "גישת לקוח: טבלאות ואינדקסים במigration"
);

const clientAccessRoute = path.join(
  process.cwd(),
  "app/client/access/[token]/page.tsx"
);
const clientAccessPage = path.join(
  process.cwd(),
  "components/ClientAccessPageContent.tsx"
);
const masterClientAccessUi = path.join(
  process.cwd(),
  "components/MasterClientAccessSection.tsx"
);

assert(fs.existsSync(clientAccessRoute), "גישת לקוח: route קיים");
assert(fs.existsSync(clientAccessPage), "גישת לקוח: עמוד לקוח קיים");
assert(
  fs.existsSync(masterClientAccessUi),
  "גישת לקוח: UI Master קיים"
);

const generatedTokens = Array.from({ length: 100 }, () => generateAccessToken());
assert(
  new Set(generatedTokens).size === generatedTokens.length,
  "גישת לקוח: token ייחודי"
);

const sampleToken = generateAccessToken();
assert(
  isAccessTokenIndependentOfScope(sampleToken, "md25", "md25-right"),
  "גישת לקוח: token לא מבוסס buildingId/elevatorId"
);
assert(
  !isAccessTokenIndependentOfScope("md25-right", "md25", "md25-right"),
  "גישת לקוח: token צפוי נדחה"
);

const clientAccessNow = new Date("2026-06-05T12:00:00.000Z");
const activeSession: ClientAccessSession = {
  user: {
    id: "user-1",
    name: "לקוח בדיקה",
    phone: null,
    email: null,
    client_type: null,
    welcome_message: null,
    access_token: sampleToken,
    is_active: true,
    expires_at: "2026-12-31T23:59:59.000Z",
    created_at: "2026-06-01T10:00:00.000Z",
  },
  access: {
    id: "access-1",
    client_user_id: "user-1",
    building_id: "md25",
    elevator_id: null,
    access_level: "building",
    created_at: "2026-06-01T10:00:00.000Z",
  },
};

assert(
  resolveClientAccessGate(activeSession, clientAccessNow) === "ok",
  "גישת לקוח: קישור פעיל מאפשר גישה"
);
assert(
  resolveClientAccessGate(
    {
      ...activeSession,
      user: { ...activeSession.user, is_active: false },
    },
    clientAccessNow
  ) === "deactivated",
  "גישת לקוח: קישור מבוטל נחסם"
);
assert(
  resolveClientAccessGate(
    {
      ...activeSession,
      user: {
        ...activeSession.user,
        expires_at: "2026-01-01T00:00:00.000Z",
      },
    },
    clientAccessNow
  ) === "expired",
  "גישת לקוח: קישור שפג תוקף נחסם"
);
assert(
  getClientAccessGateMessage("invalid") === "קישור לא תקין" &&
    getClientAccessGateMessage("deactivated") === "הגישה לקישור זה בוטלה" &&
    getClientAccessGateMessage("expired") === "תוקף הקישור פג",
  "גישת לקוח: הודעות שגיאה"
);

const scopedElevators = [
  { id: "e1", name: "ימין", status: "פעילה" as const, stations: 19 },
  { id: "e2", name: "שמאל", status: "פעילה" as const, stations: 19 },
];
assert(
  scopeElevatorsForClientAccess(scopedElevators, {
    access_level: "building",
    elevator_id: null,
  }).length === 2,
  "גישת לקוח: הרשאת building — כל המעליות"
);
assert(
  scopeElevatorsForClientAccess(scopedElevators, {
    access_level: "elevator",
    elevator_id: "e1",
  }).length === 1 &&
    scopeElevatorsForClientAccess(scopedElevators, {
      access_level: "elevator",
      elevator_id: "e1",
    })[0]?.id === "e1",
  "גישת לקוח: הרשאת elevator — מעלית אחת"
);

const scopedFaults = [
  makePilotFault({
    building_id: "md25",
    elevator_id: "e1",
    fault_type: "דלת",
  }),
  makePilotFault({
    building_id: "md25",
    elevator_id: "e2",
    fault_type: "רעש",
  }),
];
assert(
  scopeFaultsForClientAccess(scopedFaults, {
    access_level: "building",
    elevator_id: null,
  }).length === 2,
  "גישת לקוח: building — כל תקלות הבניין"
);
assert(
  scopeFaultsForClientAccess(scopedFaults, {
    access_level: "elevator",
    elevator_id: "e2",
  }).length === 1 &&
    scopeFaultsForClientAccess(scopedFaults, {
      access_level: "elevator",
      elevator_id: "e2",
    })[0]?.elevator_id === "e2",
  "גישת לקוח: elevator — תקלות מעלית אחת"
);

const clientAccessSource = fs.readFileSync(clientAccessPage, "utf8");
const clientAccessReportSource = fs.readFileSync(
  path.join(process.cwd(), "components/ClientAccessReportForm.tsx"),
  "utf8"
);
assert(
  !clientAccessSource.includes("professional-assessment") &&
    !clientAccessSource.includes("professional-rules") &&
    !clientAccessReportSource.includes("professional-assessment") &&
    !clientAccessReportSource.includes("MasterProfessionalAssessmentPanel"),
  "גישת לקוח: אין import של professional-assessment"
);
assert(
  !clientAccessSource.includes('href="/master"') &&
    !clientAccessSource.includes("MasterPageContent") &&
    isClientAccessPath(buildClientAccessPath(sampleToken)),
  "גישת לקוח: אין חשיפה ל-Master"
);

const clientAccessLib = fs.readFileSync(
  path.join(process.cwd(), "lib/client-access.ts"),
  "utf8"
);
assert(
  clientAccessLib.includes("deactivateClientAccess") &&
    clientAccessLib.includes("is_active: false") &&
    !clientAccessLib.includes(".delete().eq(\"id\", userId)") &&
    deactivateClientAccess.name === "deactivateClientAccess",
  "גישת לקוח: ביטול גישה לא מוחק משתמש"
);

const masterPageSource = fs.readFileSync(
  path.join(process.cwd(), "components/MasterPageContent.tsx"),
  "utf8"
);
assert(
  masterPageSource.includes("MasterClientAccessSection") &&
    masterPageSource.includes("ניהול גישות לקוחות") === false &&
    fs.readFileSync(masterClientAccessUi, "utf8").includes("ניהול גישות לקוחות"),
  "גישת לקוח: Master UI — ניהול גישות לקוחות"
);

assert(
  fs.readFileSync(path.join(process.cwd(), "components/BottomNav.tsx"), "utf8").includes(
    "isClientAccessPath"
  ),
  "גישת לקוח: תפריט תחתון מוסתר בנתיב access"
);

const clientPermissionsMigration = path.join(
  process.cwd(),
  "supabase/migrations/013_client_permissions.sql"
);
assert(
  fs.existsSync(clientPermissionsMigration),
  "הרשאות לקוח: migration 013 קיים"
);

const clientPermissionsMigrationSql = fs.readFileSync(
  clientPermissionsMigration,
  "utf8"
);
assert(
  clientPermissionsMigrationSql.includes("client_permissions") &&
    clientPermissionsMigrationSql.includes("client_activity_log") &&
    clientPermissionsMigrationSql.includes("can_report_faults") &&
    clientPermissionsMigrationSql.includes("can_receive_notifications"),
  "הרשאות לקוח: טבלאות ושדות במigration"
);

const clientPermissionsLib = path.join(
  process.cwd(),
  "lib/client-permissions.ts"
);
assert(
  fs.existsSync(clientPermissionsLib),
  "הרשאות לקוח: ספריית client-permissions קיימת"
);

assert(
  CLIENT_PERMISSION_KEYS.length === 8 &&
    CLIENT_PERMISSION_KEYS.every((key) => DEFAULT_CLIENT_PERMISSIONS[key] === false),
  "הרשאות לקוח: ברירת מחדל false לכל ההרשאות"
);
assert(
  CLIENT_PERMISSION_LABELS.can_view_building_dashboard === "גישה לפורטל לקוח" &&
    CLIENT_PERMISSION_LABELS.can_report_faults === "דיווח תקלות" &&
    CLIENT_PERMISSION_LABELS.can_receive_notifications === "קבלת התראות",
  "הרשאות לקוח: תוויות עברית"
);
assert(
  formatClientActivityAction("permissions_updated") === "עדכון הרשאות" &&
    formatClientActivityDetails(
      JSON.stringify({
        can_report_faults: true,
        can_view_documents: false,
      })
    ).includes("דיווח תקלות: כן"),
  "הרשאות לקוח: פורמט יומן פעילות"
);

const samplePermissionFlags = extractClientPermissionFlags({
  id: "perm-1",
  client_user_id: "user-1",
  can_view_building_dashboard: true,
  can_report_faults: true,
  can_view_open_faults: false,
  can_view_fault_history: false,
  can_view_availability: true,
  can_view_documents: false,
  can_upload_images: false,
  can_receive_notifications: true,
  created_at: "2026-06-01T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
});
assert(
  samplePermissionFlags.can_report_faults &&
    !samplePermissionFlags.can_view_documents &&
    samplePermissionFlags.can_view_availability,
  "הרשאות לקוח: extractClientPermissionFlags"
);

const masterClientAccessUiSource = fs.readFileSync(masterClientAccessUi, "utf8");
assert(
  masterClientAccessUiSource.includes("ניהול הרשאות") &&
    masterClientAccessUiSource.includes("יומן פעילות") &&
    masterClientAccessUiSource.includes("MasterClientPermissionsModal"),
  "הרשאות לקוח: UI Master — ניהול הרשאות ויומן פעילות"
);

const clientProfileMigration = path.join(
  process.cwd(),
  "supabase/migrations/015_client_user_profile.sql"
);
assert(
  fs.existsSync(clientProfileMigration),
  "פרופיל לקוח: migration 015 קיים"
);

const clientProfileMigrationSql = fs.readFileSync(clientProfileMigration, "utf8");
assert(
  clientProfileMigrationSql.includes("client_type") &&
    clientProfileMigrationSql.includes("welcome_message") &&
    clientProfileMigrationSql.includes("client_users"),
  "פרופיל לקוח: שדות client_type ו-welcome_message במigration"
);

assert(
  fs.existsSync(path.join(process.cwd(), "lib/client-profile.ts")),
  "פרופיל לקוח: ספריית client-profile קיימת"
);

assert(
  CLIENT_TYPE_OPTIONS.length === 5 &&
    CLIENT_TYPE_OPTIONS.includes("ועד בית") &&
    CLIENT_TYPE_OPTIONS.includes("אחר"),
  "פרופיל לקוח: סוגי לקוח מוגדרים"
);

assert(
  resolveClientWelcomeMessage(null) === DEFAULT_CLIENT_WELCOME_MESSAGE &&
    resolveClientWelcomeMessage("  ") === DEFAULT_CLIENT_WELCOME_MESSAGE &&
    resolveClientWelcomeMessage("הודעה מותאמת") === "הודעה מותאמת",
  "פרופיל לקוח: תאימות לאחור להודעת פתיחה"
);

assert(
  formatClientPortalLastUpdated("2026-06-13T14:30:00.000Z").includes("/") &&
    formatClientPortalLastUpdated(null) === "—",
  "פרופיל לקוח: פורמט עודכן לאחרונה"
);

assert(
  computePortalDataLastUpdated([
    "2026-06-01T10:00:00.000Z",
    "2026-06-10T12:00:00.000Z",
  ]) === "2026-06-10T12:00:00.000Z",
  "פרופיל לקוח: חישוב זמן עדכון אחרון"
);

const clientAccessLibSource = fs.readFileSync(
  path.join(process.cwd(), "lib/client-access.ts"),
  "utf8"
);
assert(
  clientAccessLibSource.includes("updateClientUserProfile") &&
    clientAccessLibSource.includes("client_type") &&
    clientAccessLibSource.includes("welcome_message"),
  "פרופיל לקוח: CRUD ב-lib/client-access"
);

assert(
  masterClientAccessUiSource.includes("סוג לקוח") &&
    masterClientAccessUiSource.includes("הודעת פתיחה לפורטל") &&
    masterClientAccessUiSource.includes("ערוך לקוח") &&
    masterClientAccessUiSource.includes("MasterClientEditModal") &&
    masterClientAccessUiSource.includes("DEFAULT_CLIENT_WELCOME_MESSAGE"),
  "פרופיל לקוח: UI יצירה ועריכה ב-Master"
);

assert(
  fs.existsSync(path.join(process.cwd(), "components/MasterClientEditModal.tsx")),
  "פרופיל לקוח: מודל עריכת לקוח קיים"
);

assert(
  fs.existsSync(
    path.join(process.cwd(), "components/MasterClientPermissionsModal.tsx")
  ),
  "הרשאות לקוח: מודל ניהול הרשאות קיים"
);

const clientPortalMigration = path.join(
  process.cwd(),
  "supabase/migrations/014_client_portal_permissions.sql"
);
assert(
  fs.existsSync(clientPortalMigration),
  "פורטל לקוח: migration 014 קיים"
);

const clientPortalMigrationSql = fs.readFileSync(clientPortalMigration, "utf8");
assert(
  clientPortalMigrationSql.includes("can_view_building_dashboard") &&
    clientPortalMigrationSql.includes("fault_source"),
  "פורטל לקוח: הרשאת כניסה ומקור תקלה במigration"
);

assert(
  fs.existsSync(path.join(process.cwd(), "lib/client-portal.ts")),
  "פורטל לקוח: ספריית client-portal קיימת"
);
assert(
  CLIENT_PORTAL_FAULT_SOURCE === "Client Portal" &&
    CLIENT_PORTAL_ACTIVITY.LOGIN === "LOGIN" &&
    CLIENT_PORTAL_ACTIVITY.LOGOUT === "LOGOUT",
  "פורטל לקוח: קבועי מקור ופעילות"
);

const portalStats = computeClientPortalStats(
  getBuildingDataset("md25").elevators,
  getBuildingDataset("md25").faults
);
assert(
  portalStats.elevatorCount > 0 &&
    portalStats.monthlyAvailabilityPercent >= 0 &&
    portalStats.monthlyAvailabilityPercent <= 100,
  "פורטל לקוח: computeClientPortalStats"
);

const clientPortalPageSource = fs.readFileSync(clientAccessPage, "utf8");
assert(
  clientPortalPageSource.includes("can_view_building_dashboard") &&
    clientPortalPageSource.includes("אין לך הרשאה לגשת לפורטל") &&
    clientPortalPageSource.includes("דווח תקלה") &&
    clientPortalPageSource.includes("ClientPortalInstallPrompt") &&
    clientPortalPageSource.includes("getClientPermissionsOrDefaults") &&
    clientPortalPageSource.includes("resolveClientPortalBuilding") &&
    clientPortalPageSource.includes("CLIENT_PORTAL_BUILDING_NOT_FOUND_TITLE") &&
    clientPortalPageSource.includes("resolveClientWelcomeMessage") &&
    clientPortalPageSource.includes("formatClientPortalLastUpdated") &&
    clientPortalPageSource.includes("עודכן לאחרונה") &&
    !clientPortalPageSource.includes("getBuildingDataset") &&
    !clientPortalPageSource.includes("שלום {session.user.name}"),
  "פורטל לקוח: UI עם אכיפת הרשאות, ללא getBuildingDataset"
);

assert(
  resolveBuildingDatasetStrict("unknown-building-xyz", getDemoDatasets()) === null,
  "פורטל לקוח: resolveBuildingDatasetStrict — בניין לא קיים מחזיר null"
);
assert(
  resolveBuildingDatasetStrict("md25", getDemoDatasets())?.building.name ===
    "מגדל דוד 25",
  "פורטל לקוח: resolveBuildingDatasetStrict — md25 רק כשהמזהה md25"
);
assert(
  resolveBuildingDatasetStrict("beit-yehoshua-4", getDemoDatasets()) === null,
  "פורטל לקוח: בניין ענן לא בדמו — לא נופל ל-md25"
);

const priorCatalogSnapshot = getCatalogSnapshot();
setCatalogSnapshot(buildDemoCatalogSnapshot(getDemoDatasets()));
assert(
  resolveBuildingDatasetStrict("md25", getDemoDatasets())?.id === "md25" &&
    resolveBuildingDatasetStrict("fake-cloud-id", getDemoDatasets()) === null,
  "פורטל לקוח: קטלוג טעון — אין fallback ל-md25"
);
setCatalogSnapshot(priorCatalogSnapshot);

assert(
  fs.existsSync(path.join(process.cwd(), "lib/client-portal-building.ts")),
  "פורטל לקוח: ספריית client-portal-building קיימת"
);

const clientPortalReportSource = fs.readFileSync(
  path.join(process.cwd(), "components/ClientAccessReportForm.tsx"),
  "utf8"
);
assert(
  clientPortalReportSource.includes("saveClientPortalFault") &&
    clientPortalReportSource.includes("allowImageUpload"),
  "פורטל לקוח: דיווח עם מקור Client Portal"
);

assert(
  fs.existsSync(path.join(process.cwd(), "components/ClientPortalInstallPrompt.tsx")),
  "פורטל לקוח: רכיב הוסף למסך הבית קיים"
);

const clientPortalPilotCloudSource = fs.readFileSync(
  path.join(process.cwd(), "lib/pilot-cloud.ts"),
  "utf8"
);
assert(
  clientPortalPilotCloudSource.includes("fault_source") &&
    clientPortalPilotCloudSource.includes("faultSource"),
  "פורטל לקוח: שמירת fault_source ב-pilot-cloud"
);

const inspectorMigration = path.join(
  process.cwd(),
  "supabase/migrations/006_inspector_report_tracking.sql"
);
assert(fs.existsSync(inspectorMigration), "תסקיר בודק: migration 006 קיים");

const inspectorMigrationSql = fs.readFileSync(inspectorMigration, "utf8");
assert(
  inspectorMigrationSql.includes("inspector_reports") &&
    inspectorMigrationSql.includes("has_remarks") &&
    inspectorMigrationSql.includes("deadline_at"),
  "תסקיר בודק: טבלת inspector_reports במigration"
);

const inspectorSectionPath = path.join(
  process.cwd(),
  "components/MasterInspectorReportsSection.tsx"
);
assert(
  fs.existsSync(inspectorSectionPath),
  "תסקיר בודק: UI Master קיים"
);

const baseInspectorReport: InspectorReportRecord = {
  id: "ir-1",
  document_id: null,
  source: "legacy",
  building_id: "md25",
  elevator_id: null,
  report_date: "2026-01-01",
  inspector_name: "בודק",
  document_name: "תסקיר שנתי",
  document_url: null,
  file_url: null,
  document_description: null,
  has_remarks: true,
  deadline_at: computeInspectorDeadlineAt("2026-01-01"),
  status: "open",
  closed_at: null,
  closure_notes: null,
  created_at: "2026-01-01T10:00:00.000Z",
};

assert(
  computeInspectorFollowUpPhase(baseInspectorReport, new Date("2026-01-20")) ===
    "active",
  "תסקיר בודק: יום 19 — מעקב פעיל"
);
assert(
  computeInspectorFollowUpPhase(
    baseInspectorReport,
    new Date("2026-02-05")
  ) === "reminder" &&
    INSPECTOR_REMINDER_DAY === 35,
  "תסקיר בודק: יום 35 — תזכורת"
);
assert(
  computeInspectorFollowUpPhase(
    baseInspectorReport,
    new Date("2026-02-10")
  ) === "alert" &&
    INSPECTOR_ALERT_DAY === 40,
  "תסקיר בודק: יום 40 — התראה"
);
assert(
  computeInspectorFollowUpPhase(
    baseInspectorReport,
    new Date("2026-02-15")
  ) === "urgent" &&
    INSPECTOR_URGENT_DAY === 45,
  "תסקיר בודק: יום 45+ — מכתב בהול"
);
assert(
  computeInspectorFollowUpPhase(
    { ...baseInspectorReport, has_remarks: false },
    new Date("2026-03-01")
  ) === "none",
  "תסקיר בודק: ללא הערות — אין מעקב"
);
assert(
  computeInspectorFollowUpPhase(
    closeInspectorReportLocally(baseInspectorReport, "טופל"),
    new Date("2026-03-01")
  ) === "closed",
  "תסקיר בודק: סגירה ידנית"
);
assert(
  daysSinceReportDate("2026-01-01", new Date("2026-02-05")) === 35,
  "תסקיר בודק: חישוב ימים מהתסקיר"
);
assert(
  normalizeReportDateForQa(baseInspectorReport.report_date) === "2026-01-01",
  "תסקיר בודק: נרמול תאריך"
);

function normalizeReportDateForQa(value: string): string {
  return value.trim().split("T")[0];
}

const urgentLetter = generateUrgentLetterTemplate({
  buildingName: "מגדל דוד 25",
  reportDate: "2026-01-01",
  deadlineAt: computeInspectorDeadlineAt("2026-01-01"),
  documentName: "תסקיר שנתי",
  inspectorName: "בודק",
  daysSinceReport: 46,
});
assert(
  urgentLetter.includes("מכתב בהול ודחוף") &&
    urgentLetter.includes("45 יום") &&
    urgentLetter.includes("מגדל דוד 25"),
  "תסקיר בודק: תבנית מכתב להעתקה"
);
assert(
  validateInspectorReportInput({
    buildingId: "md25",
    reportDate: "2026-01-01",
    documentName: "תסקיר",
    hasRemarks: true,
  }) === null,
  "תסקיר בודק: ולידציה תקינה"
);
assert(
  validateInspectorReportInput({
    buildingId: "",
    reportDate: "2026-01-01",
    documentName: "תסקיר",
    hasRemarks: false,
  }) !== null,
  "תסקיר בודק: ולידציה — בניין חובה"
);

const inspectorSectionSource = fs.readFileSync(inspectorSectionPath, "utf8");
const masterPageForInspector = fs.readFileSync(
  path.join(process.cwd(), "components/MasterPageContent.tsx"),
  "utf8"
);
assert(
  masterPageForInspector.includes("MasterInspectorReportsSection") &&
    masterPageForInspector.includes("תסקירי בודק") &&
    inspectorSectionSource.includes("העתק מכתב בהול") &&
    inspectorSectionSource.includes("סגור מעקב לאחר טיפול"),
  "תסקיר בודק: Master UI — מעקב וסגירה"
);
assert(
  !inspectorSectionSource.includes("professional-assessment") &&
    !inspectorSectionSource.includes("professional-rules"),
  "תסקיר בודק: Master בלבד — ללא professional-assessment"
);

const clientPagesForInspector = [
  "components/HomePageContent.tsx",
  "components/ClientAccessPageContent.tsx",
  "components/BottomNav.tsx",
].map((f) => path.join(process.cwd(), f));
let inspectorLeakToClient = 0;
for (const file of clientPagesForInspector) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  if (
    content.includes("MasterInspectorReportsSection") ||
    content.includes("inspector-report-tracking")
  ) {
    inspectorLeakToClient += 1;
  }
}
assert(
  inspectorLeakToClient === 0,
  "תסקיר בודק: אין חשיפה למסכי לקוח"
);

const inspectorLib = fs.readFileSync(
  path.join(process.cwd(), "lib/inspector-report-tracking.ts"),
  "utf8"
);
assert(
  inspectorLib.includes("createInspectorReport") &&
    inspectorLib.includes("createInspectorReportWithFile") &&
    inspectorLib.includes("closeInspectorReport") &&
    inspectorLib.includes("getAllInspectorReports") &&
    inspectorLib.includes("uploadInspectorReportFile") &&
    inspectorLib.includes("deleteInspectorReport") &&
    inspectorLib.includes("deleteInspectorReportStorageFile") &&
    inspectorLib.includes("document-inspector-meta") &&
    inspectorLib.includes('source: "document"') &&
    inspectorLib.includes('source: "legacy"') &&
    inspectorLib.includes("closeInspectorReportByDocumentId") &&
    !inspectorLib.includes("notifyInspectorClosureByReport") &&
    !inspectorLib.includes("sendInspectorClosureNotification") &&
    !inspectorLib.includes("openai") &&
    !inspectorLib.includes("ocr"),
  "תסקיר בודק: adapter documents+meta, ללא מייל סגירה, ללא AI/OCR"
);

const inspectorFileMigration = path.join(
  process.cwd(),
  "supabase/migrations/007_inspector_report_file_storage.sql"
);
assert(
  fs.existsSync(inspectorFileMigration),
  "תסקיר בודק: migration 007 קיים"
);
const inspectorFileMigrationSql = fs.readFileSync(inspectorFileMigration, "utf8");
assert(
  inspectorFileMigrationSql.includes("file_url") &&
    inspectorFileMigrationSql.includes("inspector-reports"),
  "תסקיר בודק: bucket ו-file_url במigration 007"
);

assert(
  validateInspectorReportFile({
    name: "report.pdf",
    type: "application/pdf",
    size: 1024,
  }) === null &&
    validateInspectorReportFile({
      name: "photo.jpg",
      type: "image/jpeg",
      size: 2048,
    }) === null &&
    validateInspectorReportFile({
      name: "notes.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 4096,
    }) === null,
  "תסקיר בודק: ולידציית סוגי קובץ — PDF/JPG/DOCX"
);
assert(
  validateInspectorReportFile({
    name: "virus.exe",
    type: "application/octet-stream",
    size: 1024,
  }) !== null,
  "תסקיר בודק: ולידציית קובץ — דוחה EXE"
);

const storagePath = buildInspectorReportStoragePath(
  "md25",
  "report.pdf",
  new Date("2026-06-12T10:00:00.000Z"),
  "7f3a9c1e-8d4a-4e21-91ab"
);
assert(
  storagePath === "md25/2026-06-12/7f3a9c1e-8d4a-4e21-91ab.pdf" &&
    storagePath.startsWith("md25/") &&
    !storagePath.includes("T08-") &&
    !/[\u0590-\u05FF]/.test(storagePath),
  "תסקיר בודק: נתיב Storage — uuid/date בלבד"
);

const encodedStoragePath = storagePath
  .split("/")
  .map((segment) => encodeURIComponent(segment))
  .join("/");
const manualPublicUrl = `https://example.supabase.co/storage/v1/object/public/${INSPECTOR_REPORTS_BUCKET}/${encodedStoragePath}`;
assert(
  extractInspectorReportStoragePath(manualPublicUrl) === storagePath,
  "תסקיר בודק: חילוץ נתיב מ-URL"
);

const builtPublicUrl = buildInspectorReportPublicUrl(storagePath);
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  assert(
    builtPublicUrl !== null && builtPublicUrl.includes(INSPECTOR_REPORTS_BUCKET),
    "תסקיר בודק: URL ציבורי"
  );
} else {
  assert(builtPublicUrl === null, "תסקיר בודק: URL ציבורי דורש Supabase");
}

assert(
  getInspectorReportDocumentUrl({
    file_url: "https://example.com/file.pdf",
    document_url: "https://example.com/external",
  }) === "https://example.com/file.pdf" &&
    getInspectorReportDocumentUrl({
      file_url: null,
      document_url: "https://example.com/external",
    }) === "https://example.com/external",
  "תסקיר בודק: קישור מסמך — file_url מועדף"
);

assert(
  INSPECTOR_REPORT_ALLOWED_EXTENSIONS.includes(".xlsx") &&
    INSPECTOR_REPORT_ALLOWED_EXTENSIONS.includes(".png"),
  "תסקיר בודק: סיומות PNG/XLSX"
);

assert(
  inspectorSectionSource.includes("בחר קובץ") &&
    inspectorSectionSource.includes("uploadProgress") &&
    inspectorSectionSource.includes("פתח מסמך") &&
    inspectorSectionSource.includes("מחק תסקיר") &&
    inspectorSectionSource.includes("מאגר מסמכים") &&
    inspectorSectionSource.includes("createInspectorReportWithFile"),
  "תסקיר בודק: UI העלאה, מעבר למאגר מסמכים ופתיחה/מחיקה"
);

const documentCenterMigration = path.join(
  process.cwd(),
  "supabase/migrations/008_document_center.sql"
);
assert(
  fs.existsSync(documentCenterMigration),
  "Document Center: migration 008 קיים"
);
const documentCenterMigrationSql = fs.readFileSync(documentCenterMigration, "utf8");
assert(
  documentCenterMigrationSql.includes("create table if not exists public.documents") &&
    documentCenterMigrationSql.includes("document-center") &&
    documentCenterMigrationSql.includes("ocr_status") &&
    documentCenterMigrationSql.includes("ai_summary") &&
    documentCenterMigrationSql.includes("tags text[]"),
  "Document Center: טבלה, bucket, תגיות והכנה ל-OCR/AI"
);

const documentCenterSectionPath = path.join(
  process.cwd(),
  "components/MasterDocumentCenterSection.tsx"
);
assert(
  fs.existsSync(documentCenterSectionPath),
  "Document Center: UI Master קיים"
);

const documentCenterLib = fs.readFileSync(
  path.join(process.cwd(), "lib/document-center.ts"),
  "utf8"
);
assert(
  documentCenterLib.includes("createDocument") &&
    documentCenterLib.includes("getAllDocuments") &&
    documentCenterLib.includes("deleteDocument") &&
    documentCenterLib.includes("uploadDocumentCenterFile") &&
    documentCenterLib.includes("filterDocuments") &&
    documentCenterLib.includes("DOCUMENT_PREDEFINED_TAGS") &&
    documentCenterLib.includes("getDocumentFilterTagOptions") &&
    documentCenterLib.includes("getDocumentLegacyFilterTags") &&
    documentCenterLib.includes("resolveDocumentContentType") &&
    documentCenterLib.includes("buildDocumentInsertRow") &&
    documentCenterLib.includes("isDocumentReadyForOcr") &&
    documentCenterLib.includes("isDocumentReadyForAi") &&
    documentCenterLib.includes("UploadDocumentResult") &&
    !documentCenterLib.includes("openai") &&
    !documentCenterLib.includes("Tesseract") &&
    !documentCenterLib.includes("sendEmail"),
  "Document Center: lib CRUD/חיפוש ללא AI/OCR/Email"
);

const sampleDocument: DocumentRecord = {
  id: "doc-1",
  building_id: "md25",
  elevator_id: "right",
  document_type: "inspector_report",
  title: "תסקיר שנתי",
  description: "תיאור",
  file_name: "report.pdf",
  file_url: "https://example.com/report.pdf",
  storage_path: "md25/report.pdf",
  mime_type: "application/pdf",
  file_size_bytes: 1024,
  tags: ["בודק", "שנתי"],
  ocr_status: "none",
  ocr_text: null,
  ai_summary: null,
  ai_metadata: null,
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
};

assert(
  normalizeDocumentTags([" בודק ", "שנתי", "בודק"]).join(",") === "בודק,שנתי" &&
    parseDocumentTagsInput("בודק, שנתי; דחוף").includes("דחוף"),
  "Document Center: נרמול ופרסור תגיות"
);
assert(
  DOCUMENT_PREDEFINED_TAGS.length === 22 &&
    DOCUMENT_PREDEFINED_TAGS[0] === "תסקיר בודק" &&
    DOCUMENT_PREDEFINED_TAGS.includes("שדרוג / מודרניזציה") &&
    DOCUMENT_PREDEFINED_TAGS.includes("התכתבויות") &&
    isPredefinedDocumentTag("חשבונית") &&
    !isPredefinedDocumentTag("בודק"),
  "Document Center: תגיות קבועות"
);
assert(
  normalizePredefinedDocumentTags(["תסקיר בודק", "בודק", "חשבונית"]).join(",") ===
    "חשבונית,תסקיר בודק",
  "Document Center: נרמול תגיות קבועות בלבד"
);
assert(
  getDocumentFilterTagOptions([]).length === DOCUMENT_PREDEFINED_TAGS.length &&
    getDocumentFilterTagOptions([]).every((tag) =>
      isPredefinedDocumentTag(tag)
    ) &&
    getDocumentFilterTagOptions([sampleDocument]).includes("בודק") &&
    getDocumentFilterTagOptions([sampleDocument]).includes("תסקיר בודק") &&
    getDocumentFilterTagOptions([
      { ...sampleDocument, tags: ["תסקיר בודק"] },
    ]).length === DOCUMENT_PREDEFINED_TAGS.length &&
    getDocumentLegacyFilterTags([sampleDocument]).join(",") === "בודק,שנתי" &&
    getDocumentLegacyFilterTags([
      { ...sampleDocument, tags: ["התכתבות"] },
    ]).join(",") === "התכתבות",
  "Document Center: אפשרויות סינון תגיות"
);
assert(
  getDocumentTagFilterMatches("התכתבויות").includes("התכתבות") &&
    documentHasTagFilter(["התכתבות"], "התכתבויות") &&
    filterDocuments(
      [{ ...sampleDocument, tags: ["התכתבות"] }],
      { tags: ["התכתבויות"] }
    ).length === 1,
  "Document Center: סינון תגית התכתבויות + תאימות ישנה"
);
assert(
  filterDocuments([sampleDocument], { query: "שנתי" }).length === 1 &&
    filterDocuments([sampleDocument], { buildingId: "md25" }).length === 1 &&
    filterDocuments([sampleDocument], { documentType: "contract" }).length === 0 &&
    filterDocuments([sampleDocument], { tags: ["בודק"] }).length === 1,
  "Document Center: חיפוש וסינון"
);
assert(
  collectDocumentTags([sampleDocument, { ...sampleDocument, id: "doc-2", tags: ["חוזה"] }])
    .includes("בודק") &&
    collectDocumentTags([sampleDocument, { ...sampleDocument, id: "doc-2", tags: ["חוזה"] }])
      .includes("חוזה"),
  "Document Center: איסוף תגיות"
);
assert(
  getDocumentTypeLabel("contract") === "חוזה" &&
    DOCUMENT_TYPES.length >= 5,
  "Document Center: סוגי מסמך"
);
assert(
  validateDocumentCenterFile({
    name: "report.pdf",
    type: "application/pdf",
    size: 1024,
  }) === null &&
    validateDocumentCenterFile({
      name: "bad.exe",
      type: "application/octet-stream",
      size: 1024,
    }) !== null,
  "Document Center: ולידציית קובץ"
);
assert(
  validateCreateDocumentInput({
    buildingId: "md25",
    documentType: "other",
    title: "מסמך",
    fileName: "a.pdf",
    fileUrl: "https://example.com/a.pdf",
    storagePath: "md25/a.pdf",
  }) === null,
  "Document Center: ולידציית יצירה"
);

const docStoragePath = buildDocumentStoragePath(
  "md25",
  "report.pdf",
  "application/pdf",
  new Date("2026-06-12T10:00:00.000Z"),
  "7f3a9c1e-8d4a-4e21-91ab"
);
const encodedDocPath = docStoragePath
  .split("/")
  .map((segment) => encodeURIComponent(segment))
  .join("/");
const manualDocUrl = `https://example.supabase.co/storage/v1/object/public/${DOCUMENT_CENTER_BUCKET}/${encodedDocPath}`;
assert(
  docStoragePath === "md25/2026-06-12/7f3a9c1e-8d4a-4e21-91ab.pdf" &&
    docStoragePath.startsWith("md25/") &&
    extractDocumentStoragePath(manualDocUrl) === docStoragePath,
  "Document Center: Storage path ו-URL"
);
assert(
  isDocumentReadyForOcr(sampleDocument) === true &&
    isDocumentReadyForAi({ ...sampleDocument, ocr_status: "ready" }) === true &&
    isDocumentReadyForAi(sampleDocument) === false,
  "Document Center: הכנה ל-OCR/AI — ללא הרצה"
);

const hebrewStoragePath = buildDocumentStoragePath(
  "md25",
  "תסקיר בודק.pdf",
  "application/pdf",
  new Date("2026-06-12T10:00:00.000Z"),
  "7f3a9c1e-8d4a-4e21-91ab"
);
assert(
  hebrewStoragePath === "md25/2026-06-12/7f3a9c1e-8d4a-4e21-91ab.pdf" &&
    !/[\u0590-\u05FF]/.test(hebrewStoragePath) &&
    !/\s/.test(hebrewStoragePath),
  "Document Center: path בטוח — ללא עברית/רווחים"
);

const pdfResolved = resolveDocumentContentType("report.pdf", "");
const jpegResolved = resolveDocumentContentType(
  "photo.jpg",
  "application/octet-stream"
);
const hebrewPdfResolved = resolveDocumentContentType(
  "תסקיר בודק.pdf",
  "application/octet-stream"
);
assert(
  pdfResolved.ok &&
    pdfResolved.contentType === "application/pdf" &&
    jpegResolved.ok &&
    jpegResolved.contentType === "image/jpeg" &&
    hebrewPdfResolved.ok &&
    hebrewPdfResolved.contentType === "application/pdf",
  "Document Center: MIME type לפי סיומת — PDF ב-Windows ועברית"
);

const noExtensionResolved = resolveDocumentContentType(
  "document",
  "application/octet-stream"
);
assert(
  !noExtensionResolved.ok &&
    noExtensionResolved.error === DOCUMENT_UNSUPPORTED_CONTENT_TYPE_ERROR,
  "Document Center: קובץ בלי סיומת — ללא octet-stream"
);

assert(
  resolveStorageExtension("תסקיר בודק.pdf", "application/pdf") === ".pdf" &&
    documentCenterLib.includes("crypto.randomUUID()") &&
    documentCenterLib.includes("formatStorageUploadFailureDetails") &&
    documentCenterLib.includes('pathVersion: "uuid-date-v2"') &&
    documentCenterLib.includes("fileId: string = crypto.randomUUID()") &&
    documentCenterLib.includes("file.name") &&
    documentCenterLib.includes("contentType"),
  "Document Center: extension ב-path + חסימת octet-stream + upload path v2"
);

const insertRow = buildDocumentInsertRow({
  buildingId: "MD25",
  elevatorId: "right",
  documentType: "inspector_report",
  title: "תסקיר",
  fileName: "report.pdf",
  fileUrl: "https://example.com/report.pdf",
  storagePath: "md25/report.pdf",
  mimeType: "application/pdf",
  fileSizeBytes: 1024,
  tags: ["בודק", "שנתי"],
});
assert(
  insertRow.building_id === "md25" &&
    insertRow.document_type === "inspector_report" &&
    insertRow.title === "תסקיר" &&
    insertRow.file_url === "https://example.com/report.pdf" &&
    insertRow.tags.length === 2,
  "Document Center: insert payload — building/title/type/file_url"
);

const documentCenterPoliciesMigration = path.join(
  process.cwd(),
  "supabase/migrations/009_document_center_storage_policies.sql"
);
assert(
  fs.existsSync(documentCenterPoliciesMigration) &&
    fs
      .readFileSync(documentCenterPoliciesMigration, "utf8")
      .includes("to public"),
  "Document Center: migration 009 policies ל-Storage"
);

const documentCenterBucketMigration = path.join(
  process.cwd(),
  "supabase/migrations/010_document_center_bucket.sql"
);
const documentCenterBucketMigrationSql = fs.readFileSync(
  documentCenterBucketMigration,
  "utf8"
);
assert(
  fs.existsSync(documentCenterBucketMigration) &&
    documentCenterBucketMigrationSql.includes("'document-center'") &&
    documentCenterBucketMigrationSql.includes("storage.buckets") &&
    documentCenterBucketMigrationSql.includes("on conflict (id)"),
  "Document Center: migration 010 יוצר bucket document-center"
);
assert(
  documentCenterBucketMigrationSql.includes("bucket_id = 'document-center'") &&
    DOCUMENT_CENTER_BUCKET === "document-center",
  "Document Center: שם bucket זהה בקוד, 009 ו-010"
);

const documentCenterSectionSource = fs.readFileSync(documentCenterSectionPath, "utf8");
const masterPageForDocuments = fs.readFileSync(
  path.join(process.cwd(), "components/MasterPageContent.tsx"),
  "utf8"
);
assert(
  masterPageForDocuments.includes("MasterDocumentCenterSection") &&
    masterPageForDocuments.includes("מאגר מסמכים") &&
    documentCenterSectionSource.includes("בחר קובץ") &&
    documentCenterSectionSource.includes("חיפוש") &&
    documentCenterSectionSource.includes("DOCUMENT_PREDEFINED_TAGS") &&
    documentCenterSectionSource.includes("getDocumentLegacyFilterTags") &&
    documentCenterSectionSource.includes("פתח מסמך"),
  "Document Center: Master UI — העלאה, חיפוש ופתיחה"
);

assert(
  documentCenterSectionSource.includes("העלאת הקובץ נכשלה") &&
    documentCenterSectionSource.includes("שמירת המסמך נכשלה") &&
    documentCenterSectionSource.includes("await refresh()") &&
    documentCenterSectionSource.includes("טעינת המאגר נכשלה") &&
    documentCenterSectionSource.includes("deleteDocumentCenterStorageFile"),
  "Document Center: הודעות שגיאה ורענון אחרי שמירה"
);

let documentCenterLeakToClient = 0;
const clientAccessPortalPage = path.join(
  process.cwd(),
  "components/ClientAccessPageContent.tsx"
);
for (const file of clientPagesForInspector) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  if (
    file === clientAccessPortalPage &&
    content.includes("can_view_documents") &&
    content.includes("getAllDocuments")
  ) {
    continue;
  }
  if (
    content.includes("MasterDocumentCenterSection") ||
    content.includes("document-center")
  ) {
    documentCenterLeakToClient += 1;
  }
}
assert(
  documentCenterLeakToClient === 0,
  "Document Center: אין חשיפה למסכי לקוח"
);

const documentInspectorMetaMigration = path.join(
  process.cwd(),
  "supabase/migrations/011_document_inspector_meta.sql"
);
assert(
  fs.existsSync(documentInspectorMetaMigration),
  "תסקיר בודק: migration 011 קיים"
);
const documentInspectorMetaMigrationSql = fs.readFileSync(
  documentInspectorMetaMigration,
  "utf8"
);
assert(
  documentInspectorMetaMigrationSql.includes("document_inspector_meta") &&
    documentInspectorMetaMigrationSql.includes("references public.documents") &&
    documentInspectorMetaMigrationSql.includes("has_remarks") &&
    documentInspectorMetaMigrationSql.includes("legacy_inspector_report_id") &&
    !documentInspectorMetaMigrationSql.toLowerCase().includes("drop table") &&
    !documentInspectorMetaMigrationSql.toLowerCase().includes("drop table public.inspector_reports"),
  "תסקיר בודק: migration 011 — meta על documents, ללא DROP/backfill"
);

const documentInspectorMetaLib = fs.readFileSync(
  path.join(process.cwd(), "lib/document-inspector-meta.ts"),
  "utf8"
);
assert(
  documentInspectorMetaLib.includes("createDocumentInspectorMeta") &&
    documentInspectorMetaLib.includes("listAllDocumentInspectorMeta") &&
    documentInspectorMetaLib.includes("closeDocumentInspectorMeta") &&
    documentInspectorMetaLib.includes(DOCUMENT_INSPECTOR_META_TABLE),
  "תסקיר בודק: lib document-inspector-meta"
);

const metaInsertRow = buildDocumentInspectorMetaInsertRow({
  documentId: "doc-1",
  reportDate: "2026-01-01",
  inspectorName: "בודק",
  hasRemarks: true,
});
assert(
  metaInsertRow.document_id === "doc-1" &&
    metaInsertRow.has_remarks === true &&
    metaInsertRow.deadline_at !== null &&
    metaInsertRow.status === "open",
  "תסקיר בודק: insert meta — deadline כשיש הערות"
);
assert(
  buildDocumentInspectorMetaInsertRow({
    documentId: "doc-2",
    reportDate: "2026-01-01",
    hasRemarks: false,
  }).deadline_at === null,
  "תסקיר בודק: insert meta — ללא deadline כשאין הערות"
);

const inspectorPanelPath = path.join(
  process.cwd(),
  "components/MasterDocumentInspectorPanel.tsx"
);
assert(
  fs.existsSync(inspectorPanelPath),
  "תסקיר בודק: MasterDocumentInspectorPanel קיים"
);
const inspectorPanelSource = fs.readFileSync(inspectorPanelPath, "utf8");
assert(
  inspectorPanelSource.includes("InspectorCreateFields") &&
    inspectorPanelSource.includes("InspectorDocumentCard") &&
    inspectorPanelSource.includes("סגור מעקב לאחר טיפול") &&
    inspectorPanelSource.includes("closeInspectorReportByDocumentId") &&
    inspectorPanelSource.includes("getInspectorNotificationSentLabel") &&
    inspectorPanelSource.includes("formatNotificationSentAt") &&
    inspectorPanelSource.includes("NOTIFICATION_DISPLAY_ORDER"),
  "תסקיר בודק: פאנל יצירה/מעקב/התראות במאגר מסמכים"
);
assert(
  documentCenterSectionSource.includes("MasterDocumentInspectorPanel") &&
    documentCenterSectionSource.includes("createInspectorReportWithFile") &&
    documentCenterSectionSource.includes("listAllDocumentInspectorMeta") &&
    documentCenterSectionSource.includes("listAllDocumentInspectorNotifications") &&
    documentCenterSectionSource.includes("inspector_report"),
  "Document Center: אינטגרציית תסקיר בודק + התראות"
);

const documentInspectorNotificationsMigration = path.join(
  process.cwd(),
  "supabase/migrations/012_document_inspector_notifications.sql"
);
assert(
  fs.existsSync(documentInspectorNotificationsMigration),
  "תסקיר בודק: migration 012 קיים"
);
const documentInspectorNotificationsMigrationSql = fs.readFileSync(
  documentInspectorNotificationsMigration,
  "utf8"
);
assert(
  documentInspectorNotificationsMigrationSql.includes(
    "document_inspector_notifications"
  ) &&
    documentInspectorNotificationsMigrationSql.includes("day_35") &&
    documentInspectorNotificationsMigrationSql.includes("day_40") &&
    documentInspectorNotificationsMigrationSql.includes("day_45_plus") &&
    documentInspectorNotificationsMigrationSql.includes("unique (document_id, notification_type)") &&
    !documentInspectorNotificationsMigrationSql.toLowerCase().includes("drop table"),
  "תסקיר בודק: migration 012 — מעקב התראות, ללא DROP"
);

const documentInspectorNotificationsLib = fs.readFileSync(
  path.join(process.cwd(), "lib/document-inspector-notifications.ts"),
  "utf8"
);
assert(
  documentInspectorNotificationsLib.includes("recordNotificationSent") &&
    documentInspectorNotificationsLib.includes(
      DOCUMENT_INSPECTOR_NOTIFICATIONS_TABLE
    ) &&
    documentInspectorNotificationsLib.includes("getInspectorNotificationSentLabel"),
  "תסקיר בודק: lib document-inspector-notifications"
);

assert(
  resolveInspectorNotificationType(34) === null &&
    resolveInspectorNotificationType(35) === "day_35" &&
    resolveInspectorNotificationType(39) === "day_35" &&
    resolveInspectorNotificationType(40) === "day_40" &&
    resolveInspectorNotificationType(44) === "day_40" &&
    resolveInspectorNotificationType(45) === "day_45_plus" &&
    resolveInspectorNotificationType(60) === "day_45_plus",
  "תסקיר בודק: שלב התראה לפי ימים + catch-up"
);

assert(
  pickInspectorNotificationToSend(50, new Set(["day_35", "day_40"])) ===
    "day_45_plus" &&
    pickInspectorNotificationToSend(50, new Set(["day_45_plus"])) === null &&
    pickInspectorNotificationToSend(42, new Set()) === "day_40" &&
    pickInspectorNotificationToSend(37, new Set()) === "day_35",
  "תסקיר בודק: בחירת התראה יחידה — ללא הצפה"
);

const notificationPayloadText = buildInspectorNotificationEmailText({
  buildingName: "מגדל דוד 25",
  elevatorLabel: "ימין",
  reportDate: "1 בינו׳ 2026",
  inspectorName: "בודק",
  daysSinceReport: 40,
  statusLabel: "התראה — יום 40",
  documentUrl: "https://example.com/report.pdf",
});
assert(
  buildInspectorNotificationSubject("day_35") ===
    "תסקיר בודק מתקרב למועד היעד" &&
    buildInspectorNotificationSubject("day_40") ===
      "נותרו 5 ימים לסגירת הערות בודק" &&
    buildInspectorNotificationSubject("day_45_plus") ===
      "חריגה ממועד טיפול בתסקיר בודק" &&
    notificationPayloadText.includes("מגדל דוד 25") &&
    notificationPayloadText.includes("40") &&
    INSPECTOR_NOTIFY_EMAIL === "lifts.forte@gmail.com" &&
    getInspectorNotificationSentLabel("day_35") === "נשלחה התראת 35" &&
    getInspectorNotificationSentLabel("day_40") === "נשלחה התראת 40" &&
    getInspectorNotificationSentLabel("day_45_plus") === "נשלחה התראת חריגה",
  "תסקיר בודק: תוכן מייל התראות"
);

const inspectorDailyNotificationsLib = fs.readFileSync(
  path.join(process.cwd(), "lib/inspector-daily-notifications.ts"),
  "utf8"
);
assert(
  inspectorDailyNotificationsLib.includes("runInspectorDailyNotifications") &&
    inspectorDailyNotificationsLib.includes("listAllDocumentInspectorMeta") &&
    !inspectorDailyNotificationsLib.includes("inspector_reports"),
  "תסקיר בודק: job יומי — documents+meta בלבד"
);

const inspectorCronApiPath = path.join(
  process.cwd(),
  "app/api/cron/inspector-daily-notifications/route.ts"
);
assert(
  fs.existsSync(inspectorCronApiPath),
  "תסקיר בודק: cron API route קיים"
);
const inspectorCronApiSource = fs.readFileSync(inspectorCronApiPath, "utf8");
assert(
  inspectorCronApiSource.includes("runInspectorDailyNotifications") &&
    inspectorCronApiSource.includes("CRON_SECRET") &&
    inspectorCronApiSource.includes("authorization"),
  "תסקיר בודק: cron route — auth + job"
);

const vercelConfigPath = path.join(process.cwd(), "vercel.json");
assert(fs.existsSync(vercelConfigPath), "תסקיר בודק: vercel.json קיים");
const vercelConfig = fs.readFileSync(vercelConfigPath, "utf8");
assert(
  vercelConfig.includes("/api/cron/inspector-daily-notifications") &&
    vercelConfig.includes("0 5 * * *"),
  "תסקיר בודק: vercel cron יומי 05:00 UTC"
);

assert(
  !fs.existsSync(
    path.join(process.cwd(), "app/api/master/inspector-closure-notify/route.ts")
  ),
  "תסקיר בודק: route מייל סגירה הוסר"
);

const masterAssessmentUi = fs.readFileSync(
  path.join(process.cwd(), "components/MasterBuildingsSection.tsx"),
  "utf8"
);
const masterAssessmentPanel = fs.readFileSync(
  path.join(process.cwd(), "components/MasterProfessionalAssessmentPanel.tsx"),
  "utf8"
);
assert(
  masterAssessmentUi.includes("MasterProfessionalAssessmentPanel") &&
    masterAssessmentUi.includes("הערכת מצב מקצועית") === false &&
    masterAssessmentPanel.includes("הערכת מצב מקצועית") &&
    masterAssessmentPanel.includes("מומחה בלבד") &&
    masterAssessmentPanel.includes("כללי מומחה שהופעלו"),
  "הערכת מצב מקצועית: UI רק במסך Master"
);

assert(
  PROFESSIONAL_RULES.length >= 50,
  `Knowledge Base: לפחות 50 כללים (${PROFESSIONAL_RULES.length})`
);

const ruleIds = PROFESSIONAL_RULES.map((r) => r.id);
assert(
  new Set(ruleIds).size === ruleIds.length,
  "Knowledge Base: מזהי כללים ייחודיים"
);

for (const category of PROFESSIONAL_RULE_CATEGORIES) {
  assert(
    getRulesByCategory(category).length >= 5,
    `Knowledge Base: קטגוריה ${category} — לפחות 5 כללים`
  );
}

assert(
  getRulesByCategory("Reliability").some((r) => r.id === "R-001") &&
    getRulesByCategory("Doors").some((r) => r.id === "D-001") &&
    getRulesByCategory("Rescue").some((r) => r.id === "RES-001"),
  "Knowledge Base: כללי מפתח R/D/RES קיימים"
);

const exportedRules = exportRulesAsJson();
assert(
  exportedRules.includes('"R-001"') &&
    exportedRules.includes('"category"') &&
    !exportedRules.includes("evaluate"),
  "Knowledge Base: ייצוא JSON ללא פונקציות"
);

const clientUiFiles = [
  "components/HomePageContent.tsx",
  "components/HistoryList.tsx",
  "components/BuildingPageContent.tsx",
  "components/BuildingsListPageContent.tsx",
].map((f) => path.join(process.cwd(), f)).filter((f) => fs.existsSync(f));

let clientAssessmentLeak = 0;
for (const file of clientUiFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (
    content.includes("professional-assessment") ||
    content.includes("professional-rules") ||
    content.includes("ProfessionalAssessment") ||
    content.includes("ProfessionalRule") ||
    content.includes("generateProfessionalAssessment") ||
    content.includes("PROFESSIONAL_RULES")
  ) {
    clientAssessmentLeak++;
    failed++;
    console.error(
      `✗ הערכת מצב: מידע מקצועי נמצא במסך לקוח — ${path.relative(process.cwd(), file)}`
    );
  }
}
assert(
  clientAssessmentLeak === 0,
  "הערכת מצב: אין חשיפה למסכי לקוח"
);

const assessmentBuilding = { id: "md25", name: "מבצע נחשון 64" };
const assessmentElevators = [
  { id: "e1", name: "מעלית 1", status: "פעילה" as const },
  { id: "e2", name: "מעלית 2", status: "פעילה" as const },
];

const noFaultsAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [],
});
assert(
  noFaultsAssessment.operationalStatus === "תקין" &&
    noFaultsAssessment.riskLevel === "נמוכה" &&
    noFaultsAssessment.metrics.totalFaults === 0 &&
    noFaultsAssessment.conclusions.some((c) =>
      c.includes("לא זוהו אירועים חריגים")
    ) &&
    noFaultsAssessment.recommendations.includes("המשך מעקב שוטף."),
  "הערכת מצב: בניין ללא תקלות — תקין / נמוכה"
);

const singleOpenAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "תאורה לא עובדת",
      description: "תאורה כבויה",
      status: "פתוחה",
      reportedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
  now: new Date("2026-06-05T12:00:00.000Z"),
});
assert(
  singleOpenAssessment.operationalStatus === "תקין עם מעקב" &&
    singleOpenAssessment.riskLevel === "נמוכה" &&
    singleOpenAssessment.metrics.openFaults === 1 &&
    singleOpenAssessment.metrics.recurringFaults === 0 &&
    singleOpenAssessment.conclusions.some((c) =>
      c.includes("לא זוהתה אינדיקציה לכשל מערכתי")
    ),
  "הערכת מצב: תקלה פתוחה אחת — תקין עם מעקב"
);

const recurringAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "דלת לא נסגרת",
      description: "דלת",
      status: "סגורה",
      reportedAt: "2026-05-01T10:00:00.000Z",
    },
    {
      elevatorId: "e1",
      faultType: "דלת לא נסגרת",
      description: "דלת",
      status: "סגורה",
      reportedAt: "2026-05-10T10:00:00.000Z",
    },
    {
      elevatorId: "e1",
      faultType: "דלת לא נסגרת",
      description: "דלת",
      status: "פתוחה",
      reportedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
  now: new Date("2026-06-05T12:00:00.000Z"),
});
assert(
  recurringAssessment.operationalStatus === "דורש בדיקה" &&
    recurringAssessment.riskLevel === "בינונית" &&
    recurringAssessment.metrics.recurringFaults === 1 &&
    recurringAssessment.conclusions.some((c) =>
      c.includes("זוהתה חזרתיות בתקלות")
    ) &&
    recurringAssessment.recommendations.some((r) => r.includes("דוח תחקור")),
  "הערכת מצב: תקלות חוזרות — דורש בדיקה / בינונית"
);

const doorAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "דלת לא נסגרת",
      description: "דלת 1",
      status: "סגורה",
      reportedAt: "2026-05-01T10:00:00.000Z",
    },
    {
      elevatorId: "e2",
      faultType: "תקלת דלת",
      description: "דלת 2",
      status: "סגורה",
      reportedAt: "2026-05-02T10:00:00.000Z",
    },
    {
      elevatorId: "e1",
      faultType: "דלת לא נסגרת",
      description: "דלת 3",
      status: "פתוחה",
      reportedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
});
assert(
  doorAssessment.metrics.doorFaults === 3 &&
    doorAssessment.conclusions.some((c) =>
      c.includes("מערכת הדלתות")
    ) &&
    doorAssessment.recommendations.some((r) => r.includes("מפעיל דלת")),
  "הערכת מצב: תקלות דלתות — מסקנה והמלצות"
);

const controlAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "תקלת בקר",
      description: "בקר",
      status: "סגורה",
      reportedAt: "2026-05-01T10:00:00.000Z",
    },
    {
      elevatorId: "e1",
      faultType: "כפתורים לא מגיבים",
      description: "כפתור",
      status: "סגורה",
      reportedAt: "2026-05-02T10:00:00.000Z",
    },
    {
      elevatorId: "e2",
      faultType: "תקלת פיקוד",
      description: "פיקוד",
      status: "פתוחה",
      reportedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
});
assert(
  controlAssessment.metrics.controlFaults === 3 &&
    controlAssessment.conclusions.some((c) =>
      c.includes("מערכת הפיקוד")
    ) &&
    controlAssessment.recommendations.some((r) => r.includes("בקר")),
  "הערכת מצב: תקלות פיקוד — מסקנה והמלצות"
);

const rescueAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "תקועה בין קומות",
      description: "חילוץ נוסעים",
      status: "סגורה",
      reportedAt: "2026-06-01T10:00:00.000Z",
    },
  ],
});
assert(
  rescueAssessment.operationalStatus === "חריג" &&
    rescueAssessment.riskLevel === "גבוהה" &&
    rescueAssessment.metrics.rescueEvents === 1 &&
    rescueAssessment.conclusions.some((c) =>
      c.includes("אירוע חילוץ נוסעים")
    ),
  "הערכת מצב: חילוץ נוסעים — חריג / גבוהה"
);

const shutdownAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "אחר",
      description: "השבתת מעלית",
      status: "מושבתת",
      reportedAt: "2026-05-01T10:00:00.000Z",
      isDisabled: true,
    },
    {
      elevatorId: "e2",
      faultType: "אחר",
      description: "השבתה חוזרת",
      status: "פתוחה",
      reportedAt: "2026-06-01T10:00:00.000Z",
      isDisabled: true,
    },
  ],
});
assert(
  shutdownAssessment.operationalStatus === "חריג" &&
    shutdownAssessment.riskLevel === "גבוהה" &&
    shutdownAssessment.metrics.shutdownEvents === 2 &&
    shutdownAssessment.conclusions.some((c) =>
      c.includes("רמת השירות נפגעה")
    ),
  "הערכת מצב: השבתות חוזרות — חריג / גבוהה"
);

const liveStartedAtAssessment = "2026-06-05T12:00:00.000Z";
const liveFilterAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    {
      elevatorId: "e1",
      faultType: "רעש חריג",
      description: "דemo ישן",
      status: "פתוחה",
      reportedAt: "2026-01-01T10:00:00.000Z",
    },
    {
      elevatorId: "e1",
      faultType: "רעש חריג",
      description: "אחרי live",
      status: "פתוחה",
      reportedAt: "2026-06-06T10:00:00.000Z",
    },
  ],
  liveStartedAt: liveStartedAtAssessment,
});
assert(
  liveFilterAssessment.metrics.totalFaults === 1 &&
    liveFilterAssessment.metrics.openFaults === 1,
  "הערכת מצב: סינון live_started_at"
);

const initializedBuildingAssessment = generateProfessionalAssessment({
  building: assessmentBuilding,
  elevators: assessmentElevators,
  faults: [
    mapPilotFaultForAssessment(
      makePilotFault({
        building_id: "md25",
        elevator_id: "e1",
        fault_type: "דלת לא נסגרת",
        description: "דemo",
        status: "פתוחה",
        created_at: "2026-01-01T10:00:00.000Z",
      })
    ),
    mapPilotFaultForAssessment(
      makePilotFault({
        building_id: "md25",
        elevator_id: "e1",
        fault_type: "דלת לא נסגרת",
        description: "דemo 2",
        status: "סגורה",
        created_at: "2026-02-01T10:00:00.000Z",
      })
    ),
    mapPilotFaultForAssessment(
      makePilotFault({
        building_id: "md25",
        elevator_id: "e1",
        fault_type: "דלת לא נסגרת",
        description: "דemo 3",
        status: "סגורה",
        created_at: "2026-03-01T10:00:00.000Z",
      })
    ),
  ],
  liveStartedAt: "2026-06-05T12:00:00.000Z",
});
assert(
  initializedBuildingAssessment.metrics.totalFaults === 0 &&
    initializedBuildingAssessment.operationalStatus === "תקין" &&
    initializedBuildingAssessment.metrics.doorFaults === 0,
  "הערכת מצב: בניין מאותחל — ללא נתוני דemo"
);

const md25AssessmentCtx = getBuildingDataset("md25");
const md25DemoAssessment = generateProfessionalAssessment({
  building: { id: "md25", name: md25AssessmentCtx.building.name },
  elevators: md25AssessmentCtx.elevators.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
  })),
  faults: md25AssessmentCtx.faults.map(mapClientFaultForAssessment),
  now: new Date("2026-06-05T12:00:00.000Z"),
});
assert(
  md25DemoAssessment.activatedRules.length >= 10,
  `Knowledge Base: md25 — לפחות 10 כללים הופעלו (${md25DemoAssessment.activatedRules.length})`
);
assert(
  md25DemoAssessment.activatedRules.some((r) => r.id.startsWith("R-")) &&
    md25DemoAssessment.activatedRules.some((r) => r.id.startsWith("D-") || r.id.startsWith("RES-")),
  "Knowledge Base: md25 — כללי Reliability/Doors/Rescue הופעלו"
);

console.log("\n=== Knowledge Base: 10 כללים ראשונים על md25 (מגדל דוד 25) ===");
for (const rule of md25DemoAssessment.activatedRules.slice(0, 10)) {
  console.log(`  ${rule.id} — ${rule.title}`);
}
console.log("");

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
