/**
 * נתוני דמו בלבד — אין כאן נתונים אמיתיים של לקוחות.
 * בגרסה מסחרית יוחלפו בחיבור למסד נתונים / API.
 */
import type { Building, Elevator, Fault } from "./types";
import { hoursBetween, safePercent } from "./utils";

export const building: Building = {
  name: "מגדל פורטה",
  address: "רחוב הרצל 42",
  city: "תל אביב",
  elevatorCount: 3,
  elevatorCompany: "מעליות ישראל בע״מ",
  contactPerson: "דני כהן",
  phone: "03-5551234",
  managementCompany: "ניהול נכסים פרימיום",
  units: 48,
};

export const elevators: Elevator[] = [
  { id: "1", name: "מעלית א׳", status: "פעילה", floor: "לובי" },
  { id: "2", name: "מעלית ב׳", status: "מושבתת", floor: "קומה 3-4" },
  { id: "3", name: "מעלית ג׳", status: "בטיפול", floor: "קומת כניסה" },
];

export const faults: Fault[] = [
  {
    id: "1",
    elevatorId: "2",
    elevatorName: "מעלית ב׳",
    type: "תקועה בין קומות",
    description: "המעלית נתקעה בין הקומה השלישית לרביעית. דיירים לכודים בתוך התא.",
    status: "מושבתת",
    priority: "דחופה",
    reportedAt: "2026-06-05T09:15:00",
    reportedBy: "יוסי לוי, ועד בית",
  },
  {
    id: "2",
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    type: "רעש חריג",
    description: "רעש מנוע חזק במהלך הנסיעה בין קומות 5-8.",
    status: "בטיפול",
    priority: "רגילה",
    reportedAt: "2026-06-04T14:30:00",
    reportedBy: "מירי כהן",
  },
  {
    id: "3",
    elevatorId: "3",
    elevatorName: "מעלית ג׳",
    type: "דלת לא נסגרת",
    description: "דלת המעלית בקומת הכניסה לא נסגרת באופן מלא.",
    status: "פעילה",
    priority: "רגילה",
    reportedAt: "2026-06-03T11:00:00",
    reportedBy: "אבי רוזן, ועד בית",
  },
  {
    id: "4",
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    type: "תאורה לא עובדת",
    description: "תאורת התא כבויה לחלוטין.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-06-01T08:45:00",
    resolvedAt: "2026-06-02T11:30:00",
    downtimeHours: 0,
    reportedBy: "שרה אברהם",
  },
  {
    id: "5",
    elevatorId: "2",
    elevatorName: "מעלית ב׳",
    type: "כפתורים לא מגיבים",
    description: "כפתורי הקומות 10-15 אינם מגיבים.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-28T16:20:00",
    resolvedAt: "2026-05-30T09:00:00",
    downtimeHours: 4,
    reportedBy: "דוד מזרחי",
  },
  {
    id: "6",
    elevatorId: "3",
    elevatorName: "מעלית ג׳",
    type: "רעש חריג",
    description: "חריקה חזקה בעת פתיחת הדלתות.",
    status: "טופלה",
    priority: "נמוכה",
    reportedAt: "2026-05-25T10:10:00",
    resolvedAt: "2026-05-26T14:00:00",
    downtimeHours: 0,
    reportedBy: "רחל גולן",
  },
  {
    id: "7",
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    type: "אחר",
    description: "ריח שריפה קל מהארון החשמלי בקומת המכונות.",
    status: "טופלה",
    priority: "דחופה",
    reportedAt: "2026-05-20T07:30:00",
    resolvedAt: "2026-05-20T18:00:00",
    downtimeHours: 2,
    reportedBy: "יוסי לוי, ועד בית",
  },
  {
    id: "8",
    elevatorId: "2",
    elevatorName: "מעלית ב׳",
    type: "דלת לא נסגרת",
    description: "דלת המעלית נפתחת ונסגרת מספר פעמים לפני הנסיעה.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-15T13:00:00",
    resolvedAt: "2026-05-18T10:00:00",
    downtimeHours: 6,
    reportedBy: "מירי כהן",
  },
  {
    id: "9",
    elevatorId: "3",
    elevatorName: "מעלית ג׳",
    type: "תקועה בין קומות",
    description: "המעלית לא הגיעה לקומת היעד ונעצרה בקומה 7.",
    status: "טופלה",
    priority: "דחופה",
    reportedAt: "2026-05-10T18:45:00",
    resolvedAt: "2026-05-11T08:30:00",
    downtimeHours: 8,
    reportedBy: "אבי רוזן, ועד בית",
  },
  {
    id: "10",
    elevatorId: "1",
    elevatorName: "מעלית א׳",
    type: "כפתורים לא מגיבים",
    description: "לוח הכפתורים בקומת הקרקע אינו פועל.",
    status: "טופלה",
    priority: "רגילה",
    reportedAt: "2026-05-05T09:00:00",
    resolvedAt: "2026-05-07T12:00:00",
    downtimeHours: 3,
    reportedBy: "דוד מזרחי",
  },
];

/** שעות השבתה משוערות לתקלות פתוחות */
export const ACTIVE_FAULT_DOWNTIME: Record<string, number> = {
  "1": 12,
  "2": 0,
  "3": 0,
};

export const faultTypes = [
  "תקועה בין קומות",
  "רעש חריג",
  "דלת לא נסגרת",
  "תאורה לא עובדת",
  "כפתורים לא מגיבים",
  "אחר",
] as const;

const ACTIVE_FAULT_STATUSES = ["פעילה", "בטיפול", "מושבתת"] as const;

export function getOpenFaults() {
  return faults
    .filter((f) =>
      ACTIVE_FAULT_STATUSES.includes(f.status as (typeof ACTIVE_FAULT_STATUSES)[number])
    )
    .sort(
      (a, b) =>
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
    );
}

export function getDashboardStats() {
  const now = new Date();
  const openFaults = getOpenFaults().length;
  const monthFaults = faults.filter((f) => {
    const date = new Date(f.reportedAt);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }).length;
  const disabledElevators = elevators.filter(
    (e) => e.status === "מושבתת"
  ).length;

  return {
    elevatorCount: building.elevatorCount,
    openFaults,
    monthFaults,
    disabledElevators,
  };
}

export function getClientStats() {
  const totalFaults = faults.length;
  const openFaults = getOpenFaults().length;
  const closedFaults = faults.filter((f) => f.status === "טופלה").length;
  const activeElevators = elevators.filter((e) => e.status === "פעילה").length;
  const availability = safePercent(activeElevators, building.elevatorCount);

  return {
    totalFaults,
    openFaults,
    closedFaults,
    availability,
    activeElevators,
    elevatorCount: building.elevatorCount,
  };
}

export function getFaultsByType() {
  const counts = new Map<string, number>();
  for (const fault of faults) {
    counts.set(fault.type, (counts.get(fault.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function getMonthlyFaultTrend() {
  const now = new Date();
  const trend: { month: string; count: number }[] = [];

  for (let i = 3; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const count = faults.filter((f) => {
      const fd = new Date(f.reportedAt);
      return fd.getMonth() === d.getMonth() && fd.getFullYear() === d.getFullYear();
    }).length;
    trend.push({
      month: new Intl.DateTimeFormat("he-IL", { month: "short" }).format(d),
      count,
    });
  }

  return trend;
}

export function getMonthlyOperationalReport() {
  const now = new Date();
  const monthFaults = faults.filter((f) => {
    const date = new Date(f.reportedAt);
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  });
  const closedThisMonth = monthFaults.filter((f) => f.status === "טופלה").length;
  const openThisMonth = monthFaults.filter((f) => f.status !== "טופלה").length;
  const activeElevators = elevators.filter((e) => e.status === "פעילה").length;
  const availability = safePercent(activeElevators, building.elevatorCount);

  const closedWithResolution = monthFaults.filter(
    (f) => f.status === "טופלה" && f.resolvedAt
  );
  const avgResolutionDays =
    closedWithResolution.length > 0
      ? Math.round(
          (closedWithResolution.reduce(
            (s, f) => s + hoursBetween(f.reportedAt, f.resolvedAt!) / 24,
            0
          ) /
            closedWithResolution.length) *
            10
        ) / 10
      : 0;

  return {
    month: new Intl.DateTimeFormat("he-IL", {
      month: "long",
      year: "numeric",
    }).format(now),
    totalReported: monthFaults.length,
    closed: closedThisMonth,
    open: openThisMonth,
    availability,
    avgResolutionDays,
    reportsSubmitted: monthFaults.length,
  };
}
