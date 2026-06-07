import {
  ensureBuildingCatalogLoaded,
  refreshBuildingCatalog,
  resolveAllBuildingIds,
  resolveAllBuildingIdsForMaster,
  resolveBuildingDataset,
  resolveIsValidBuildingId,
} from "./buildings-catalog";
import type {
  Building,
  BuildingDataContext,
  Elevator,
  Fault,
  FaultType,
} from "./types";

export {
  ensureBuildingCatalogLoaded,
  refreshBuildingCatalog,
  resolveAllBuildingIdsForMaster,
} from "./buildings-catalog";

export const DEFAULT_BUILDING_ID = "md25";

export const faultTypes: FaultType[] = [
  "תקועה בין קומות",
  "רעש חריג",
  "דלת לא נסגרת",
  "תאורה לא עובדת",
  "כפתורים לא מגיבים",
  "אחר",
];

// ─── 1. מגדל דוד 25, מודיעין ───────────────────────────────────────────────

const md25Building: Building = {
  buildingCode: "MD25",
  name: "מגדל דוד 25",
  address: "דוד 25",
  city: "מודיעין",
  elevatorCount: 2,
  elevatorCompany: "צום",
  contactPerson: "איתן סתר",
  phone: "דמו",
  managementCompany: "איתן סתר",
  units: 76,
  contractNumber: "DEMO-MD25-001",
  serviceLevel: "זהב",
  serviceStartDate: "2024-01-01",
  lastInspectionDate: "2026-03-15",
};

const md25Elevators: Elevator[] = [
  {
    id: "md25-right",
    name: "מעלית ימין",
    status: "פעילה",
    stations: 19,
    floor: "19 תחנות",
  },
  {
    id: "md25-left",
    name: "מעלית שמאל",
    status: "מושבתת",
    stations: 19,
    floor: "19 תחנות",
  },
];

const md25Faults: Fault[] = [
  {
    id: "MD25-1",
    elevatorId: "md25-left",
    elevatorName: "מעלית שמאל",
    type: "תקועה בין קומות",
    description: "המעלית נתקעה בין קומה 7 ל-8. דיירים לכודים בתא.",
    status: "מושבתת",
    priority: "דחופה",
    reportedAt: "2026-06-05T08:30:00",
    reportedBy: "איתן סתר, ניהול",
    isDisabled: true,
  },
  {
    id: "MD25-2",
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    type: "רעש חריג",
    description: "רעש מנוע חזק בנסיעה בין קומות 12-15.",
    status: "בטיפול",
    priority: "רגילה",
    reportedAt: "2026-06-04T11:20:00",
    reportedBy: "דייר, קומה 14",
  },
  {
    id: "MD25-3",
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    type: "דלת לא נסגרת",
    description: "דלת המעלית בקומת הלובי לא נסגרת באופן מלא.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-03T09:45:00",
    reportedBy: "שומר בניין",
  },
  {
    id: "MD25-4",
    elevatorId: "md25-left",
    elevatorName: "מעלית שמאל",
    type: "תאורה לא עובדת",
    description: "תאורת התא כבויה לחלוטין.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-06-01T07:15:00",
    resolvedAt: "2026-06-02T10:00:00",
    downtimeHours: 0,
    reportedBy: "אחזקה",
  },
  {
    id: "MD25-5",
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    type: "כפתורים לא מגיבים",
    description: "כפתורי קומות 16-18 אינם מגיבים.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-28T14:00:00",
    resolvedAt: "2026-05-29T16:30:00",
    downtimeHours: 2,
    reportedBy: "ועד בית",
  },
  {
    id: "MD25-6",
    elevatorId: "md25-left",
    elevatorName: "מעלית שמאל",
    type: "רעש חריג",
    description: "חריקה בעת פתיחת דלתות בקומה 3.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-25T10:30:00",
    resolvedAt: "2026-05-26T12:00:00",
    downtimeHours: 0,
    reportedBy: "דייר",
  },
  {
    id: "MD25-7",
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    type: "אחר",
    description: "ריח חריג מארון החשמלי בקומת המכונות.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-20T08:00:00",
    resolvedAt: "2026-05-21T11:00:00",
    downtimeHours: 1,
    reportedBy: "איתן סתר",
  },
  {
    id: "MD25-8",
    elevatorId: "md25-left",
    elevatorName: "מעלית שמאל",
    type: "דלת לא נסגרת",
    description: "חיישן דלת לא מזהה סגירה מלאה בקומה 11.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-15T13:20:00",
    resolvedAt: "2026-05-16T09:00:00",
    downtimeHours: 3,
    reportedBy: "צוות ניקיון",
  },
  {
    id: "MD25-9",
    elevatorId: "md25-right",
    elevatorName: "מעלית ימין",
    type: "תקועה בין קומות",
    description: "עצירה קצרה בין קומות 5-6, שוחררה אוטומטית.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-10T17:45:00",
    resolvedAt: "2026-05-10T18:10:00",
    downtimeHours: 0,
    reportedBy: "דייר",
  },
  {
    id: "MD25-10",
    elevatorId: "md25-left",
    elevatorName: "מעלית שמאל",
    type: "כפתורים לא מגיבים",
    description: "לוח כפתורים בקומת הקרקע לא מגיב לחיצות.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-05T09:00:00",
    resolvedAt: "2026-05-07T14:00:00",
    downtimeHours: 4,
    reportedBy: "שומר",
  },
];

// ─── 2. מגדל דוד 23, מודיעין ───────────────────────────────────────────────

const md23Building: Building = {
  buildingCode: "MD23",
  name: "מגדל דוד 23",
  address: "דוד 23",
  city: "מודיעין",
  elevatorCount: 2,
  elevatorCompany: "צום",
  contactPerson: "איתן סתר",
  phone: "דמו",
  managementCompany: "איתן סתר",
  units: 76,
  contractNumber: "DEMO-MD23-001",
  serviceLevel: "זהב",
  serviceStartDate: "2024-01-01",
  lastInspectionDate: "2026-02-20",
};

const md23Elevators: Elevator[] = [
  {
    id: "md23-right",
    name: "מעלית ימין",
    status: "פעילה",
    stations: 19,
    floor: "19 תחנות",
  },
  {
    id: "md23-left",
    name: "מעלית שמאל",
    status: "פעילה",
    stations: 19,
    floor: "19 תחנות",
  },
];

const md23Faults: Fault[] = [
  {
    id: "MD23-1",
    elevatorId: "md23-right",
    elevatorName: "מעלית ימין",
    type: "דלת לא נסגרת",
    description: "דלת לא נסגרת בקומה 9 — חיישן דורש כיוון.",
    status: "בטיפול",
    priority: "רגילה",
    reportedAt: "2026-06-04T10:00:00",
    reportedBy: "איתן סתר",
  },
  {
    id: "MD23-2",
    elevatorId: "md23-left",
    elevatorName: "מעלית שמאל",
    type: "רעש חריג",
    description: "רעש מסוע בקומות 14-16.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-02T15:30:00",
    reportedBy: "דייר",
  },
  {
    id: "MD23-3",
    elevatorId: "md23-right",
    elevatorName: "מעלית ימין",
    type: "תאורה לא עובדת",
    description: "תאורה מהבהבת בתא המעלית.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-22T08:00:00",
    resolvedAt: "2026-05-23T11:00:00",
    downtimeHours: 0,
    reportedBy: "אחזקה",
  },
  {
    id: "MD23-4",
    elevatorId: "md23-left",
    elevatorName: "מעלית שמאל",
    type: "כפתורים לא מגיבים",
    description: "כפתור קומה 7 לא מגיב.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-18T12:00:00",
    resolvedAt: "2026-05-19T09:30:00",
    downtimeHours: 1,
    reportedBy: "ועד בית",
  },
  {
    id: "MD23-5",
    elevatorId: "md23-right",
    elevatorName: "מעלית ימין",
    type: "תקועה בין קומות",
    description: "עצירה קצרה בין קומות 4-5, שוחררה לאחר דקה.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-12T07:45:00",
    resolvedAt: "2026-05-12T08:00:00",
    downtimeHours: 0,
    reportedBy: "דייר",
  },
  {
    id: "MD23-6",
    elevatorId: "md23-left",
    elevatorName: "מעלית שמאל",
    type: "אחר",
    description: "לוח תצוגה בלובי מציג קומה שגויה.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-08T16:00:00",
    resolvedAt: "2026-05-09T10:00:00",
    downtimeHours: 0,
    reportedBy: "שומר",
  },
];

// ─── 3. אורנבך 2, ראשון לציון ──────────────────────────────────────────────

const or02Building: Building = {
  buildingCode: "OR02",
  name: "אורנבך 2",
  address: "אורנבך 2",
  city: "ראשון לציון",
  elevatorCount: 2,
  elevatorCompany: "טיב מעליות",
  contactPerson: "רוי דביר",
  phone: "דמו",
  managementCompany: "דמו",
  units: 44,
  contractNumber: "DEMO-OR02-001",
  serviceLevel: "כסף",
  serviceStartDate: "2023-06-01",
  lastInspectionDate: "2026-01-10",
};

const or02Elevators: Elevator[] = [
  {
    id: "or02-right",
    name: "מעלית ימין",
    status: "פעילה",
    stations: 11,
    floor: "11 תחנות",
  },
  {
    id: "or02-left",
    name: "מעלית שמאל",
    status: "בטיפול",
    stations: 11,
    floor: "11 תחנות",
  },
];

const or02Faults: Fault[] = [
  {
    id: "OR02-1",
    elevatorId: "or02-left",
    elevatorName: "מעלית שמאל",
    type: "תקועה בין קומות",
    description: "המעלית נתקעה בין קומה 6 ל-7.",
    status: "בטיפול",
    priority: "דחופה",
    reportedAt: "2026-06-05T07:00:00",
    reportedBy: "רוי דביר",
  },
  {
    id: "OR02-2",
    elevatorId: "or02-right",
    elevatorName: "מעלית ימין",
    type: "רעש חריג",
    description: "רעש בלמים בקומות 8-10.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-03T13:00:00",
    reportedBy: "דייר",
  },
  {
    id: "OR02-3",
    elevatorId: "or02-left",
    elevatorName: "מעלית שמאל",
    type: "דלת לא נסגרת",
    description: "דלת לא נסגרת בקומת כניסה.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-20T09:30:00",
    resolvedAt: "2026-05-21T14:00:00",
    downtimeHours: 2,
    reportedBy: "ועד בית",
  },
  {
    id: "OR02-4",
    elevatorId: "or02-right",
    elevatorName: "מעלית ימין",
    type: "תאורה לא עובדת",
    description: "תאורת חירום לא פועלת.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-14T11:00:00",
    resolvedAt: "2026-05-15T08:00:00",
    downtimeHours: 0,
    reportedBy: "אחזקה",
  },
  {
    id: "OR02-5",
    elevatorId: "or02-left",
    elevatorName: "מעלית שמאל",
    type: "כפתורים לא מגיבים",
    description: "כפתורי קומות 3-5 לא מגיבים.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-08T08:00:00",
    resolvedAt: "2026-05-10T12:00:00",
    downtimeHours: 5,
    reportedBy: "רוי דביר",
  },
  {
    id: "OR02-6",
    elevatorId: "or02-right",
    elevatorName: "מעלית ימין",
    type: "אחר",
    description: "מראה בתא שבורה — דורש החלפה.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-01T10:00:00",
    resolvedAt: "2026-05-03T15:00:00",
    downtimeHours: 0,
    reportedBy: "דייר",
  },
];

// ─── 4. מבצע נחשון 64, באר שבע ─────────────────────────────────────────────

const mn64Building: Building = {
  buildingCode: "MN64",
  name: "מבצע נחשון 64",
  address: "מבצע נחשון 64",
  city: "באר שבע",
  elevatorCount: 1,
  elevatorCompany: "שינדלר",
  contactPerson: "ראובן",
  phone: "דמו",
  managementCompany: "דמו",
  units: 40,
  contractNumber: "DEMO-MN64-001",
  serviceLevel: "כסף",
  serviceStartDate: "2022-09-01",
  lastInspectionDate: "2025-12-05",
};

const mn64Elevators: Elevator[] = [
  {
    id: "mn64-main",
    name: "מעלית ראשית",
    status: "פעילה",
    stations: 10,
    floor: "10 תחנות",
  },
];

const mn64Faults: Fault[] = [
  {
    id: "MN64-1",
    elevatorId: "mn64-main",
    elevatorName: "מעלית ראשית",
    type: "דלת לא נסגרת",
    description: "דלת לא נסגרת בקומה 4 — ממתין לטכנאי.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-04T09:00:00",
    reportedBy: "ראובן",
  },
  {
    id: "MN64-2",
    elevatorId: "mn64-main",
    elevatorName: "מעלית ראשית",
    type: "רעש חריג",
    description: "רעש מנוע בקומות 7-9.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-25T14:00:00",
    resolvedAt: "2026-05-27T10:00:00",
    downtimeHours: 0,
    reportedBy: "דייר",
  },
  {
    id: "MN64-3",
    elevatorId: "mn64-main",
    elevatorName: "מעלית ראשית",
    type: "תקועה בין קומות",
    description: "עצירה בין קומות 2-3, שוחררה תוך 5 דקות.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-15T08:30:00",
    resolvedAt: "2026-05-15T08:45:00",
    downtimeHours: 0,
    reportedBy: "שומר",
  },
  {
    id: "MN64-4",
    elevatorId: "mn64-main",
    elevatorName: "מעלית ראשית",
    type: "תאורה לא עובדת",
    description: "תאורת תא כבויה.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-08T11:00:00",
    resolvedAt: "2026-05-09T09:00:00",
    downtimeHours: 0,
    reportedBy: "אחזקה",
  },
];

// ─── 5. יערות הכרמל 20, לוד ────────────────────────────────────────────────

const yk20Building: Building = {
  buildingCode: "YK20",
  name: "יערות הכרמל 20",
  address: "יערות הכרמל 20",
  city: "לוד",
  elevatorCount: 4,
  elevatorCompany: "שינדלר",
  contactPerson: "מאור",
  phone: "דמו",
  managementCompany: "אי טי",
  units: 128,
  contractNumber: "DEMO-YK20-001",
  serviceLevel: "פלטינום",
  serviceStartDate: "2023-03-01",
  lastInspectionDate: "2026-04-01",
};

const yk20Elevators: Elevator[] = [
  {
    id: "yk20-freight-1",
    name: "מעלית 1 משא",
    status: "פעילה",
    stations: 32,
    floor: "32 תחנות",
  },
  {
    id: "yk20-freight-2",
    name: "מעלית 2 משא",
    status: "בטיפול",
    stations: 32,
    floor: "32 תחנות",
  },
  {
    id: "yk20-passenger-3",
    name: "מעלית 3 נוסעים",
    status: "פעילה",
    stations: 32,
    floor: "32 תחנות",
  },
  {
    id: "yk20-passenger-4",
    name: "מעלית 4 נוסעים",
    status: "מושבתת",
    stations: 32,
    floor: "32 תחנות",
  },
];

const yk20Faults: Fault[] = [
  {
    id: "YK20-1",
    elevatorId: "yk20-passenger-4",
    elevatorName: "מעלית 4 נוסעים",
    type: "תקועה בין קומות",
    description: "המעלית נתקעה בין קומה 18 ל-19.",
    status: "מושבתת",
    priority: "דחופה",
    reportedAt: "2026-06-05T06:45:00",
    reportedBy: "מאור, ניהול",
    isDisabled: true,
  },
  {
    id: "YK20-2",
    elevatorId: "yk20-freight-2",
    elevatorName: "מעלית 2 משא",
    type: "דלת לא נסגרת",
    description: "דלת משא לא נסגרת בקומת מחסן.",
    status: "בטיפול",
    priority: "רגילה",
    reportedAt: "2026-06-04T08:00:00",
    reportedBy: "מחסנאי",
  },
  {
    id: "YK20-3",
    elevatorId: "yk20-freight-1",
    elevatorName: "מעלית 1 משא",
    type: "רעש חריג",
    description: "רעש מסוע בקומות 20-25.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-03T10:30:00",
    reportedBy: "צוות לוגיסטיקה",
  },
  {
    id: "YK20-4",
    elevatorId: "yk20-passenger-3",
    elevatorName: "מעלית 3 נוסעים",
    type: "כפתורים לא מגיבים",
    description: "כפתורי קומות 28-30 לא מגיבים.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-02T14:00:00",
    reportedBy: "דייר",
  },
  {
    id: "YK20-5",
    elevatorId: "yk20-passenger-4",
    elevatorName: "מעלית 4 נוסעים",
    type: "תאורה לא עובדת",
    description: "תאורת חירום לא פועלת.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-28T09:00:00",
    resolvedAt: "2026-05-29T11:00:00",
    downtimeHours: 0,
    reportedBy: "אחזקה",
  },
  {
    id: "YK20-6",
    elevatorId: "yk20-freight-1",
    elevatorName: "מעלית 1 משא",
    type: "אחר",
    description: "משקל מקסימלי מוצג שגוי בלוח.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-20T07:00:00",
    resolvedAt: "2026-05-21T10:00:00",
    downtimeHours: 0,
    reportedBy: "מאור",
  },
  {
    id: "YK20-7",
    elevatorId: "yk20-freight-2",
    elevatorName: "מעלית 2 משא",
    type: "תקועה בין קומות",
    description: "עצירה בין קומות 10-11, שוחררה.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-15T12:00:00",
    resolvedAt: "2026-05-15T12:20:00",
    downtimeHours: 0,
    reportedBy: "מחסנאי",
  },
  {
    id: "YK20-8",
    elevatorId: "yk20-passenger-3",
    elevatorName: "מעלית 3 נוסעים",
    type: "דלת לא נסגרת",
    description: "דלת לא נסגרת בלובי.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-10T08:00:00",
    resolvedAt: "2026-05-11T14:00:00",
    downtimeHours: 2,
    reportedBy: "שומר",
  },
];

// ─── 6. ישורון 34, הוד השרון ───────────────────────────────────────────────

const ys34Building: Building = {
  buildingCode: "YS34",
  name: "ישורון 34",
  address: "ישורון 34, הוד השרון",
  city: "הוד השרון",
  elevatorCount: 1,
  elevatorCompany: "אלקטרה",
  contactPerson: "אלונה באום",
  phone: "דמו",
  managementCompany: "ועד בית",
  units: 24,
  contractNumber: "DEMO-YS34-001",
  serviceLevel: "כסף",
  serviceStartDate: "2025-01-01",
  lastInspectionDate: "2026-04-01",
};

const ys34Elevators: Elevator[] = [
  {
    id: "ys34-main",
    name: "מעלית ראשית",
    status: "פעילה",
    stations: 5,
    floor: "5 תחנות",
  },
];

const ys34Faults: Fault[] = [];

// ─── מאגר בניינים ──────────────────────────────────────────────────────────

const datasets: Record<string, BuildingDataContext> = {
  md25: {
    id: "md25",
    building: md25Building,
    elevators: md25Elevators,
    faults: md25Faults,
    activeFaultDowntime: {
      "MD25-1": 12,
      "MD25-2": 4,
      "MD25-3": 0,
    },
  },
  md23: {
    id: "md23",
    building: md23Building,
    elevators: md23Elevators,
    faults: md23Faults,
    activeFaultDowntime: {
      "MD23-1": 6,
      "MD23-2": 0,
    },
  },
  or02: {
    id: "or02",
    building: or02Building,
    elevators: or02Elevators,
    faults: or02Faults,
    activeFaultDowntime: {
      "OR02-1": 10,
      "OR02-2": 0,
    },
  },
  mn64: {
    id: "mn64",
    building: mn64Building,
    elevators: mn64Elevators,
    faults: mn64Faults,
    activeFaultDowntime: {
      "MN64-1": 2,
    },
  },
  yk20: {
    id: "yk20",
    building: yk20Building,
    elevators: yk20Elevators,
    faults: yk20Faults,
    activeFaultDowntime: {
      "YK20-1": 18,
      "YK20-2": 8,
      "YK20-3": 0,
      "YK20-4": 0,
    },
  },
  ys34: {
    id: "ys34",
    building: ys34Building,
    elevators: ys34Elevators,
    faults: ys34Faults,
    activeFaultDowntime: {},
  },
};

export function getDemoDatasets(): Record<string, BuildingDataContext> {
  return datasets;
}

export function getBuildingDataset(id: string): BuildingDataContext {
  return resolveBuildingDataset(id, datasets, DEFAULT_BUILDING_ID);
}

export function getAllBuildingIds(): string[] {
  return resolveAllBuildingIds(datasets);
}

export function isValidBuildingId(id: string): boolean {
  return resolveIsValidBuildingId(id, datasets);
}
