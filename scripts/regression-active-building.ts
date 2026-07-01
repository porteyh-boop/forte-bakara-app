/**
 * Regression: Active Building SSOT + Feedback (steps 1–3)
 * Run: npx tsx scripts/regression-active-building.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  isKnownBuildingId,
  resolveActiveBuildingId,
} from "../lib/active-building";
import {
  buildMergedClientCatalogSnapshot,
  setCatalogSnapshot,
} from "../lib/buildings-catalog";
import {
  getAllDemoBuildingIds,
  getDemoDatasets,
  DEFAULT_BUILDING_ID,
} from "../lib/buildings";
import type { CloudBuildingRow } from "../lib/buildings-cloud";
import {
  buildFeedbackFromInput,
  getFeedbackByBuilding,
  getFeedbackStorageKey,
  readFeedbackFromStorage,
  saveFeedback,
} from "../lib/feedback-storage";
import {
  getReportsStorageKey,
  getSubmittedReports,
  saveSubmittedReport,
} from "../lib/report-storage";
import type { FeedbackSubmissionInput, Fault } from "../lib/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`✓ ${label}`);
    passed += 1;
  } else {
    console.error(`✗ ${label}`);
    failed += 1;
  }
}

function installBrowserMock(storage: Storage): void {
  const g = globalThis as typeof globalThis & {
    window?: Window & typeof globalThis;
    localStorage?: Storage;
  };
  g.window = globalThis as Window & typeof globalThis;
  g.localStorage = storage;
  if (typeof globalThis.dispatchEvent !== "function") {
    (globalThis as EventTarget).dispatchEvent = (() => true) as typeof globalThis.dispatchEvent;
  }
}

function createMockStorage(): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    _map: map,
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as Storage & { _map: Map<string, string> };
}

const sampleFeedback: FeedbackSubmissionInput = {
  senderName: "בדיקה",
  senderRole: "ועד בית",
  rating: 5,
  wouldUseRegularly: "כן",
  unclearOrMissing: "",
  expectedFeature: "",
  wouldRecommend: "כן",
};

const cloudRow: CloudBuildingRow = {
  id: "reg-uuid-1",
  building_id: "regnew01",
  name: "בניין רגרסיה",
  city: "תל אביב",
  address: null,
  management_company: null,
  elevator_company: null,
  contact_name: null,
  contact_phone: null,
  floors_count: null,
  is_active: true,
  created_at: "2026-06-01T00:00:00Z",
};

const cloudCatalog = buildMergedClientCatalogSnapshot(
  [cloudRow],
  [],
  getDemoDatasets()
);

function simulateRefreshSync(persistedId: string | null): string {
  setCatalogSnapshot(cloudCatalog);
  return resolveActiveBuildingId(
    persistedId,
    cloudCatalog,
    getAllDemoBuildingIds()
  );
}

console.log("\n=== Regression: Active Building + Feedback ===\n");

// 1–4: create/select/refresh — persisted cloud id survives sync
setCatalogSnapshot(null);
assert(
  resolveActiveBuildingId("regnew01", null, getAllDemoBuildingIds()) ===
    DEFAULT_BUILDING_ID,
  "1. לפני קטלוג — id ענן לא תקף (fallback)"
);

const afterSelect = simulateRefreshSync("regnew01");
assert(afterSelect === "regnew01", "2. בחירת בניין חדש — sync מחזיר regnew01");

const afterRefresh = simulateRefreshSync("regnew01");
assert(
  afterRefresh === "regnew01",
  "3–4. Refresh — הבניין נשאר regnew01 ולא md25"
);

assert(
  isKnownBuildingId("regnew01", cloudCatalog, getAllDemoBuildingIds()),
  "בניין חדש מוכר בקטלוג"
);

// 5–7: feedback per building_id
const fbStorage = createMockStorage();
installBrowserMock(fbStorage);

const md25Feedback = buildFeedbackFromInput(
  sampleFeedback,
  "md25",
  "מגדל דוד 25"
);
saveFeedback(md25Feedback, fbStorage);

const cloudFeedback = buildFeedbackFromInput(
  sampleFeedback,
  "regnew01",
  "בניין רגרסיה"
);
saveFeedback(cloudFeedback, fbStorage);

assert(
  readFeedbackFromStorage(fbStorage, "md25").length === 1 &&
    readFeedbackFromStorage(fbStorage, "regnew01").length === 1,
  "5–6. משוב נשמר תחת building_id הנכון (md25 + regnew01)"
);

assert(
  readFeedbackFromStorage(fbStorage, "md25")[0]?.buildingId === "md25" &&
    readFeedbackFromStorage(fbStorage, "regnew01")[0]?.buildingId === "regnew01",
  "6. buildingId בשורת המשוב תואם"
);

assert(
  getFeedbackByBuilding("regnew01").length === 1 &&
    getFeedbackByBuilding("regnew01")[0]?.senderName === "בדיקה",
  "7. מסך מומחה — getFeedbackByBuilding מחזיר משוב לבניין הפעיל"
);

// 8: switching buildings — isolated reports
const reportsStorage = createMockStorage();
installBrowserMock(reportsStorage);

const faultMd25: Fault = {
  id: "REG-MD25",
  elevatorId: "md25-right",
  elevatorName: "מעלית ימין",
  type: "אחר",
  description: "דיווח md25",
  status: "פתוחה",
  priority: "רגילה",
  reportedAt: "2026-06-05T10:00:00",
  reportedBy: "test",
};
const faultCloud: Fault = {
  ...faultMd25,
  id: "REG-CLOUD",
  description: "דיווח regnew01",
};

saveSubmittedReport(faultMd25, "md25");
saveSubmittedReport(faultCloud, "regnew01");

assert(
  getSubmittedReports("md25").length === 1 &&
    getSubmittedReports("regnew01").length === 1 &&
    getSubmittedReports("md25")[0]?.description === "דיווח md25" &&
    getSubmittedReports("regnew01")[0]?.description === "דיווח regnew01",
  "8. החלפת בניין — דיווחים מבודדים לפי buildingId"
);

// Storage keys distinct
assert(
  getFeedbackStorageKey("md25") !== getFeedbackStorageKey("regnew01") &&
    getReportsStorageKey("md25") !== getReportsStorageKey("regnew01"),
  "8b. מפתחות localStorage נפרדים לכל בניין"
);

// 9: modules still wired (source-level smoke)
const root = process.cwd();

const home = fs.readFileSync(
  path.join(root, "components/HomePageContent.tsx"),
  "utf8"
);
const history = fs.readFileSync(
  path.join(root, "components/HistoryPageContent.tsx"),
  "utf8"
);
const activeBar = fs.readFileSync(
  path.join(root, "components/ActiveBuildingBar.tsx"),
  "utf8"
);
const docCenter = fs.readFileSync(
  path.join(root, "components/MasterDocumentCenterSection.tsx"),
  "utf8"
);

assert(home.includes("useBuilding"), "9. Home — useBuilding");
assert(history.includes("useBuilding"), "9. History — useBuilding");
assert(activeBar.includes("isReady"), "9. Active Building Bar — isReady");
assert(
  docCenter.includes("getBuildingDataset") &&
    !docCenter.includes("getStoredBuildingId"),
  "9. Document Center — לא תלוי getStoredBuildingId"
);

const reportsHook = fs.readFileSync(
  path.join(root, "hooks/useSubmittedReports.ts"),
  "utf8"
);
assert(
  reportsHook.includes("useBuilding") && reportsHook.includes("isReady"),
  "9. Submitted Reports — useBuilding + isReady"
);

setCatalogSnapshot(null);
delete (globalThis as { window?: unknown; localStorage?: Storage }).window;
delete (globalThis as { localStorage?: Storage }).localStorage;

console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
process.exit(failed > 0 ? 1 : 0);
