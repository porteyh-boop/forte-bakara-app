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
import { faults } from "../lib/data";
import { isExpert } from "../lib/roles";
import { getClientStats, getOpenFaults, getFaultsByType, getMonthlyFaultTrend } from "../lib/data";

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

// 1. Client has no expert imports on home (structural check)
assert(faults.length === 10, "נתוני דוגמה: 10 תקלות קיימות");

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

// 3-5. Analytics functions with real data
assertNoInvalidValues("getRecurringFaultsByElevator", getRecurringFaultsByElevator());
assertNoInvalidValues("getRecurringFaultsByType", getRecurringFaultsByType());
assertNoInvalidValues("getAverageDowntime", getAverageDowntime());
assertNoInvalidValues("getAverageResponseTime", getAverageResponseTime());
assertNoInvalidValues("getElevatorAvailability", getElevatorAvailability());
assertNoInvalidValues("getMostProblematicElevator", getMostProblematicElevator());
assertNoInvalidValues("getServiceCompanyRating", getServiceCompanyRating());
assertNoInvalidValues("getTrendAnalysis", getTrendAnalysis());
assertNoInvalidValues("getAnomalyAlerts", getAnomalyAlerts());
assertNoInvalidValues("getRiskAssessment", getRiskAssessment());
assertNoInvalidValues("generateInsights", generateInsights());
assertNoInvalidValues("generateActions", generateActions());
assertNoInvalidValues("generateMetrics", generateMetrics());
assertNoInvalidValues("getExpertAnalytics", getExpertAnalytics());
assertNoInvalidValues("getExpertPdfData", getExpertPdfData());
assert(
  getExpertPdfData().building.name.length > 0,
  "נתוני PDF: שם בניין קיים"
);
assert(
  getExpertPdfData().analytics.actions.length > 0,
  "נתוני PDF: המלצות פעולה קיימות"
);
assert(
  getExpertPdfData().analytics.insights.length > 0,
  "נתוני דוח הדפסה: תובנות קיימות"
);

// 4. Division safety
const recurring = getRecurringFaultsByElevator();
recurring.forEach((r) => {
  assert(r.percentage >= 0 && r.percentage <= 100, `אחוז תקין ל-${r.elevatorName}`);
});

// 6. Client data functions
assertNoInvalidValues("getClientStats", getClientStats());
assertNoInvalidValues("getOpenFaults", getOpenFaults());
assertNoInvalidValues("getFaultsByType", getFaultsByType());
assertNoInvalidValues("getMonthlyFaultTrend", getMonthlyFaultTrend());

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
