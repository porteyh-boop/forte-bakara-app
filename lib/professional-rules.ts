export type RuleSeverity = "info" | "low" | "medium" | "high" | "critical";

export type RuleCategory =
  | "Reliability"
  | "Doors"
  | "Control"
  | "Drive"
  | "Safety"
  | "Rescue"
  | "Availability"
  | "Service"
  | "Maintenance"
  | "Modernization";

export const PROFESSIONAL_RULE_CATEGORIES: RuleCategory[] = [
  "Reliability",
  "Doors",
  "Control",
  "Drive",
  "Safety",
  "Rescue",
  "Availability",
  "Service",
  "Maintenance",
  "Modernization",
];

export interface AssessmentMetrics {
  totalFaults: number;
  openFaults: number;
  closedFaults: number;
  recurringFaults: number;
  doorFaults: number;
  controlFaults: number;
  driveFaults: number;
  shutdownEvents: number;
  rescueEvents: number;
  safetyFaults: number;
  availability?: number;
  faults30: number;
  faults60: number;
  faults90: number;
  prev30Faults: number;
  prev60Faults: number;
  trend: "worsening" | "improving" | "stable";
  daysSinceLastFault: number | null;
  elevatorCount: number;
  disabledElevators: number;
  doorRecurringPatterns: number;
  doorPartialOpenFaults: number;
  doorStuckFaults: number;
  doorAlignmentFaults: number;
  doorWheelFaults: number;
  controlRecurringPatterns: number;
  driveRecurringPatterns: number;
  repeatWithin14Days: boolean;
  avgFaultsPerMonth: number;
  openFaultDurationDays: number;
  unresolvedOpenRatio: number;
}

export interface ProfessionalRule {
  id: string;
  category: RuleCategory;
  title: string;
  severity: RuleSeverity;
  evaluate: (metrics: AssessmentMetrics) => boolean;
  finding: string;
  conclusion: string;
  recommendation: string;
}

export interface ActivatedProfessionalRule {
  id: string;
  category: RuleCategory;
  title: string;
  severity: RuleSeverity;
  finding: string;
  conclusion: string;
  recommendation: string;
}

export interface RuleEvaluationResult {
  activatedRules: ActivatedProfessionalRule[];
  findings: string[];
  conclusions: string[];
  recommendations: string[];
  highestSeverity: RuleSeverity | null;
}

const SEVERITY_RANK: Record<RuleSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function rule(def: ProfessionalRule): ProfessionalRule {
  return def;
}

/** Knowledge Base V1 — 60 כללי מומחה */
export const PROFESSIONAL_RULES: ProfessionalRule[] = [
  // ─── Reliability R-001 – R-010 ─────────────────────────────────────────
  rule({
    id: "R-001",
    category: "Reliability",
    title: "עלייה של יותר מ-50% בכמות התקלות",
    severity: "medium",
    evaluate: (m) => m.prev30Faults > 0 && m.faults30 > m.prev30Faults * 1.5,
    finding: "זוהתה מגמת החמרה בנפח התקלות.",
    conclusion: "נרשמה עלייה משמעותית בקצב התקלות ב-30 הימים האחרונים.",
    recommendation: "לבחון שינוי במצב המעליות או באיכות השירות.",
  }),
  rule({
    id: "R-002",
    category: "Reliability",
    title: "הכפלת תקלות במשך חודשיים רצופים",
    severity: "high",
    evaluate: (m) =>
      m.faults30 >= 2 &&
      m.prev30Faults >= 2 &&
      m.faults30 >= m.prev30Faults * 2,
    finding: "נרשמה החמרה רציפה בנפח התקלות לאורך שני חודשים.",
    conclusion: "קיים דפוס החמרה מתמשך הדורש התערבות מקצועית.",
    recommendation: "לדרוש בדיקה מערכתית ודוח ניתוח מגמות מחברת השירות.",
  }),
  rule({
    id: "R-003",
    category: "Reliability",
    title: "ללא תקלות במשך 90 יום",
    severity: "info",
    evaluate: (m) => m.faults90 === 0 && m.totalFaults === 0,
    finding: "לא נרשמו תקלות בתקופת הבקרה.",
    conclusion: "לא זוהו אירועים חריגים בתקופת הבקרה.",
    recommendation: "המשך מעקב שוטף.",
  }),
  rule({
    id: "R-004",
    category: "Reliability",
    title: "יותר מ-10 תקלות ב-90 יום",
    severity: "high",
    evaluate: (m) => m.faults90 > 10,
    finding: "ריבוי תקלות בטווח 90 יום.",
    conclusion: "ריבוי תקלות בטווח 90 יום מעיד על עומס תקלות גבוה.",
    recommendation: "לבצע הערכת אמינות מערכתית ולדרוש תוכנית שיפור.",
  }),
  rule({
    id: "R-005",
    category: "Reliability",
    title: "מצב תקין — ללא אירועים",
    severity: "info",
    evaluate: (m) => m.totalFaults === 0,
    finding: "לא נרשמו תקלות בתקופת הבקרה.",
    conclusion: "לא זוהו אירועים חריגים בתקופת הבקרה.",
    recommendation: "המשך מעקב שוטף.",
  }),
  rule({
    id: "R-006",
    category: "Reliability",
    title: "תקלה פתוחה בודדת ללא חזרתיות",
    severity: "low",
    evaluate: (m) => m.openFaults === 1 && m.recurringFaults === 0,
    finding: "קיימת תקלה פתוחה אחת.",
    conclusion: "לא זוהתה אינדיקציה לכשל מערכתי.",
    recommendation: "לוודא סגירת התקלה הפתוחה.",
  }),
  rule({
    id: "R-007",
    category: "Reliability",
    title: "תקלות חוזרות — אותו סוג באותה מעלית",
    severity: "medium",
    evaluate: (m) => m.recurringFaults > 0,
    finding: "זוהתה חזרתיות בתקלות — אותו סוג באותה מעלית.",
    conclusion: "זוהתה חזרתיות בתקלות.",
    recommendation: "לדרוש מחברת השירות: דוח תחקור, ניתוח שורש תקלה ותוכנית מניעה.",
  }),
  rule({
    id: "R-008",
    category: "Reliability",
    title: "מגמת החמרה בנפח תקלות",
    severity: "medium",
    evaluate: (m) => m.trend === "worsening",
    finding: "זוהתה מגמת החמרה בנפח התקלות.",
    conclusion: "נרשמה עלייה בקצב התקלות לעומת התקופה הקודמת.",
    recommendation: "להעמיק מעקב ולנתח גורמים לעלייה.",
  }),
  rule({
    id: "R-009",
    category: "Reliability",
    title: "מגמת שיפור בנפח תקלות",
    severity: "info",
    evaluate: (m) => m.trend === "improving" && m.totalFaults > 0,
    finding: "זוהתה מגמת שיפור בנפח התקלות.",
    conclusion: "נרשמה ירידה בקצב התקלות — מגמה חיובית.",
    recommendation: "להמשיך מעקב לווידוא התמדה.",
  }),
  rule({
    id: "R-010",
    category: "Reliability",
    title: "3 תקלות פתוחות ומעלה",
    severity: "high",
    evaluate: (m) => m.openFaults >= 3,
    finding: "ריבוי תקלות פתוחות בו-זמנית.",
    conclusion: "מצב תפעולי לחוץ — נדרש טיפול מיידי.",
    recommendation: "לדרוש סגירה מואצת ודוח סטטוס יומי מחברת השירות.",
  }),

  // ─── Doors D-001 – D-010 ─────────────────────────────────────────────────
  rule({
    id: "D-001",
    category: "Doors",
    title: "3 תקלות דלת ומעלה",
    severity: "medium",
    evaluate: (m) => m.doorFaults >= 3,
    finding: "ריבוי תקלות במערכת הדלתות.",
    conclusion:
      "קיימת אינדיקציה אפשרית לשחיקה או כיוון לקוי במערכת הדלתות.",
    recommendation:
      "בדיקת מפעיל דלת, גלגלים, מסילות, מנגנוני נעילה וכיוון דלתות.",
  }),
  rule({
    id: "D-002",
    category: "Doors",
    title: "תקלות דלת חוזרות",
    severity: "medium",
    evaluate: (m) => m.doorRecurringPatterns > 0,
    finding: "זוהתה חזרתיות בתקלות דלת.",
    conclusion: "דפוס חוזר בתקלות דלת מעיד על כשל לא מטופל.",
    recommendation: "לדרוש ניתוח שורש תקלה ייעודי למערכת הדלתות.",
  }),
  rule({
    id: "D-003",
    category: "Doors",
    title: "פתיחה חלקית / סגירה לא מלאה",
    severity: "low",
    evaluate: (m) => m.doorPartialOpenFaults > 0,
    finding: "נרשמו אירועי פתיחה חלקית או סגירה לא מלאה.",
    conclusion: "ייתכן כיוון לקוי או שחיקה במנגנון הסגירה.",
    recommendation: "לבדוק חיישני דלת, מפעיל וכיוון.",
  }),
  rule({
    id: "D-004",
    category: "Doors",
    title: "תקיעות דלת",
    severity: "medium",
    evaluate: (m) => m.doorStuckFaults > 0,
    finding: "נרשמו אירועי תקיעות דלת.",
    conclusion: "תקיעות חוזרות עלולות לפגוע בזמינות ובבטיחות.",
    recommendation: "לבדוק מסילות, גלגלים ומנגנוני נעילה.",
  }),
  rule({
    id: "D-005",
    category: "Doors",
    title: "כיוון דלת חוזר",
    severity: "medium",
    evaluate: (m) => m.doorAlignmentFaults >= 2,
    finding: "נרשמו מספר אירועי כיוון דלת.",
    conclusion: "כיוון דלת חוזר מעיד על בעיה מכanicית מתמשכת.",
    recommendation: "לדרוש כיוון מלא ותיעוד מדידות.",
  }),
  rule({
    id: "D-006",
    category: "Doors",
    title: "החלפת גלגלים — אינדיקציה",
    severity: "low",
    evaluate: (m) => m.doorWheelFaults > 0,
    finding: "נרשמו תקלות הקשורות לגלגלי דלת.",
    conclusion: "ייתכן שחיקה בגלגלים או במסילות.",
    recommendation: "לבדוק גלגלים, מסילות ולubrication.",
  }),
  rule({
    id: "D-007",
    category: "Doors",
    title: "תקלת דלת פתוחה",
    severity: "low",
    evaluate: (m) => m.doorFaults === 1 && m.openFaults >= 1,
    finding: "קיימת תקלת דלת פתוחה.",
    conclusion: "תקלת דלת בודדת — מעקב עד סגירה.",
    recommendation: "לוודא סגירת תקלת הדלת.",
  }),
  rule({
    id: "D-008",
    category: "Doors",
    title: "5 תקלות דלת ומעלה — חריג",
    severity: "high",
    evaluate: (m) => m.doorFaults >= 5,
    finding: "ריבוי חריג של תקלות דלת.",
    conclusion: "מערכת הדלתות דורשת בדיקה מקיפה.",
    recommendation: "לתאם ביקור מומחה דלתות ודוח מפורט.",
  }),
  rule({
    id: "D-009",
    category: "Doors",
    title: "תקלות דלת ב-30 יום",
    severity: "low",
    evaluate: (m) => m.doorFaults >= 1 && m.faults30 >= 1,
    finding: "נרשמו תקלות דלת בתקופה האחרונה.",
    conclusion: "נדרש מעקב על מערכת הדלתות.",
    recommendation: "לבדוק מפעיל דלת וחיישנים.",
  }),
  rule({
    id: "D-010",
    category: "Doors",
    title: "ללא תקלות דלת",
    severity: "info",
    evaluate: (m) => m.totalFaults > 0 && m.doorFaults === 0,
    finding: "לא זוהו תקלות דלת.",
    conclusion: "מערכת הדלתות לא הופיעה כגורם תקלה.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Control CTRL-001 – CTRL-005 ───────────────────────────────────────
  rule({
    id: "CTRL-001",
    category: "Control",
    title: "3 תקלות פיקוד ומעלה",
    severity: "medium",
    evaluate: (m) => m.controlFaults >= 3,
    finding: "ריבוי תקלות במערכת הפיקוד.",
    conclusion: "קיימת אינדיקציה לחוסר יציבות במערכת הפיקוד.",
    recommendation: "בדיקת בקר, תקשורת, כרטיסים אלקטרוניים וספקי כוח.",
  }),
  rule({
    id: "CTRL-002",
    category: "Control",
    title: "תקלות פיקוד חוזרות",
    severity: "high",
    evaluate: (m) => m.controlRecurringPatterns > 0,
    finding: "זוהתה חזרתיות בתקלות פיקוד.",
    conclusion: "חוסר יציבות חוזר בבקר — סיכון לכשלים נוספים.",
    recommendation: "לדרוש בדיקת בקר מלאה ודוח תקשורת.",
  }),
  rule({
    id: "CTRL-003",
    category: "Control",
    title: "תקלת פיקוד פתוחה",
    severity: "low",
    evaluate: (m) => m.controlFaults >= 1 && m.openFaults >= 1,
    finding: "קיימת תקלת פיקוד פתוחה.",
    conclusion: "תקלת פיקוד פתוחה דורשת מעקב.",
    recommendation: "לוודא טיפול וסגירה בבקר.",
  }),
  rule({
    id: "CTRL-004",
    category: "Control",
    title: "5 תקלות פיקוד — חריג",
    severity: "high",
    evaluate: (m) => m.controlFaults >= 5,
    finding: "ריבוי חריג של תקלות פיקוד.",
    conclusion: "מערכת הפיקוד אינה יציבה.",
    recommendation: "בדיקה מקיפה של כל רכיבי הבקרה.",
  }),
  rule({
    id: "CTRL-005",
    category: "Control",
    title: "ללא תקלות פיקוד",
    severity: "info",
    evaluate: (m) => m.totalFaults > 0 && m.controlFaults === 0,
    finding: "לא זוהו תקלות פיקוד.",
    conclusion: "מערכת הפיקוד לא הופיעה כגורם תקלה.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Drive DRV-001 – DRV-005 ───────────────────────────────────────────
  rule({
    id: "DRV-001",
    category: "Drive",
    title: "3 תקלות הינע ומעלה",
    severity: "medium",
    evaluate: (m) => m.driveFaults >= 3,
    finding: "נרשמו תקלות במערכת ההינע.",
    conclusion: "ריבוי תקלות הינע מעיד על שחיקה או כשל מכני.",
    recommendation: "לבדוק מנוע, בלמים, כבלים ומערכת הינע.",
  }),
  rule({
    id: "DRV-002",
    category: "Drive",
    title: "תקלות הינע חוזרות",
    severity: "high",
    evaluate: (m) => m.driveRecurringPatterns > 0,
    finding: "זוהתה חזרתיות בתקלות מערכת ההינע.",
    conclusion: "כשל חוזר במערכת ההינע — סיכון להשבתה.",
    recommendation: "לדרוש בדיקה מכanicית מלאה ודוח הנדסי.",
  }),
  rule({
    id: "DRV-003",
    category: "Drive",
    title: "תקלת הינע פתוחה",
    severity: "medium",
    evaluate: (m) => m.driveFaults >= 1 && m.openFaults >= 1 && m.totalFaults >= 2,
    finding: "קיימת תקלה פתוחה במערכת ההינע.",
    conclusion: "תקלת הינע פתוחה — מעקב מיידי.",
    recommendation: "לוודא טיפול וסגירה.",
  }),
  rule({
    id: "DRV-004",
    category: "Drive",
    title: "רעש חריג — אינדיקציה להינע",
    severity: "low",
    evaluate: (m) => m.driveFaults >= 1 && m.totalFaults > 0,
    finding: "נרשמו אירועים הקשורים למערכת ההינע.",
    conclusion: "רעש או תקלה בהינע — מעקב מומלץ.",
    recommendation: "לבדוק מנוע, הולכים ומסילות.",
  }),
  rule({
    id: "DRV-005",
    category: "Drive",
    title: "ללא תקלות הינע",
    severity: "info",
    evaluate: (m) => m.totalFaults > 0 && m.driveFaults === 0,
    finding: "לא זוהו תקלות הינע.",
    conclusion: "מערכת ההינע לא הופיעה כגורם תקלה.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Rescue RES-001 – RES-005 ────────────────────────────────────────────
  rule({
    id: "RES-001",
    category: "Rescue",
    title: "אירוע חילוץ נוסעים",
    severity: "critical",
    evaluate: (m) => m.rescueEvents >= 1,
    finding: "נרשם אירוע חילוץ נוסעים.",
    conclusion: "נרשם אירוע חילוץ נוסעים.",
    recommendation: "לדרוש דוח אירוע מפורט מחברת המעליות.",
  }),
  rule({
    id: "RES-002",
    category: "Rescue",
    title: "2 אירועי חילוץ ומעלה",
    severity: "critical",
    evaluate: (m) => m.rescueEvents >= 2,
    finding: "נרשמו מספר אירועי חילוץ.",
    conclusion: "ריבוי אירועי חילוץ — מצב חריג.",
    recommendation: "בדיקה מערכתית מלאה ודוח בטיחות.",
  }),
  rule({
    id: "RES-003",
    category: "Rescue",
    title: "חילוץ עם מעלית מושבתת",
    severity: "critical",
    evaluate: (m) => m.rescueEvents >= 1 && m.disabledElevators > 0,
    finding: "אירוע חילוץ עם מעלית מושבתת.",
    conclusion: "חילוץ במקביל להשבתה — חומרה גבוהה.",
    recommendation: "לדרוש דוח אירוע ותוכנית מניעה.",
  }),
  rule({
    id: "RES-004",
    category: "Rescue",
    title: "תקיעה בין קומות — ללא חילוץ מלא",
    severity: "high",
    evaluate: (m) => m.rescueEvents >= 1 && m.openFaults > 0,
    finding: "אירוע תקיעה/חילוץ עם תקלה פתוחה.",
    conclusion: "האירוע טרם נסגר — מעקב דחוף.",
    recommendation: "לוודא סגירת התקלה ודוח אירוע.",
  }),
  rule({
    id: "RES-005",
    category: "Rescue",
    title: "ללא אירועי חילוץ",
    severity: "info",
    evaluate: (m) => m.totalFaults > 0 && m.rescueEvents === 0,
    finding: "לא נרשמו אירועי חילוץ.",
    conclusion: "לא זוהו אירועי חילוץ בתקופה.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Safety SAFE-001 – SAFE-005 ──────────────────────────────────────────
  rule({
    id: "SAFE-001",
    category: "Safety",
    title: "תקלות בטיחות רשומות",
    severity: "high",
    evaluate: (m) => m.safetyFaults >= 1,
    finding: "נרשמו תקלות הקשורות לבטיחות.",
    conclusion: "תקלות בטיחות דורשות טיפול מיידי.",
    recommendation: "לבדוק מערכות בטיחות ודוח תאימות.",
  }),
  rule({
    id: "SAFE-002",
    category: "Safety",
    title: "2 תקלות בטיחות ומעלה",
    severity: "critical",
    evaluate: (m) => m.safetyFaults >= 2,
    finding: "ריבוי תקלות בטיחות.",
    conclusion: "מצב בטיחותי לחוץ.",
    recommendation: "בדיקה מיידית של כל מערכות הבטיחות.",
  }),
  rule({
    id: "SAFE-003",
    category: "Safety",
    title: "השבתה עם תקלת בטיחות",
    severity: "critical",
    evaluate: (m) => m.safetyFaults >= 1 && m.shutdownEvents >= 1,
    finding: "תקלת בטיחות עם השבתת מעלית.",
    conclusion: "השבתה על רקע בטיחות — חומרה גבוהה.",
    recommendation: "לדרוש דוח בטיחות מפורט.",
  }),
  rule({
    id: "SAFE-004",
    category: "Safety",
    title: "תקלות פתוחות עם השפעה בטיחותית",
    severity: "high",
    evaluate: (m) => m.safetyFaults >= 1 && m.openFaults >= 1,
    finding: "תקלת בטיחות פתוחה.",
    conclusion: "תקלה בטיחותית לא נסגרה.",
    recommendation: "סגירה מיידית ותיעוד.",
  }),
  rule({
    id: "SAFE-005",
    category: "Safety",
    title: "ללא תקלות בטיחות",
    severity: "info",
    evaluate: (m) => m.totalFaults > 0 && m.safetyFaults === 0,
    finding: "לא זוהו תקלות בטיחות ייעודיות.",
    conclusion: "לא נרשמו אירועי בטיחות חריגים.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Availability AV-001 – AV-005 ───────────────────────────────────────
  rule({
    id: "AV-001",
    category: "Availability",
    title: "זמינות גבוהה מ-99%",
    severity: "info",
    evaluate: (m) => m.availability != null && m.availability >= 99,
    finding: "זמינות המעליות גבוהה.",
    conclusion: "רמת זמינות תקינה.",
    recommendation: "המשך מעקב שוטף.",
  }),
  rule({
    id: "AV-002",
    category: "Availability",
    title: "זמינות מתחת ל-95%",
    severity: "medium",
    evaluate: (m) => m.availability != null && m.availability < 95,
    finding: "ירידה בזמינות המעליות.",
    conclusion: "רמת השירות נפגעה — זמינות נמוכה.",
    recommendation: "לנתח גורמי השבתה ולדרוש שיפור.",
  }),
  rule({
    id: "AV-003",
    category: "Availability",
    title: "2 אירועי השבתה ומעלה",
    severity: "critical",
    evaluate: (m) => m.shutdownEvents >= 2,
    finding: "נרשמו אירועי השבתה מרובים.",
    conclusion: "רמת השירות נפגעה באופן משמעותי.",
    recommendation: "לבצע בדיקה מערכתית מלאה.",
  }),
  rule({
    id: "AV-004",
    category: "Availability",
    title: "מעלית מושבתת",
    severity: "high",
    evaluate: (m) => m.disabledElevators >= 1,
    finding: "קיימת מעלית מושבתת.",
    conclusion: "השבתת מעלית מפחיתה זמינות.",
    recommendation: "לוודא החזרה לשירות ודוח סטטוס.",
  }),
  rule({
    id: "AV-005",
    category: "Availability",
    title: "זמינות מתחת ל-90%",
    severity: "high",
    evaluate: (m) => m.availability != null && m.availability < 90,
    finding: "זמינות נמוכה במיוחד.",
    conclusion: "מצב זמינות חריג.",
    recommendation: "פגישת חירום עם חברת השירות.",
  }),

  // ─── Service SR-001 – SR-005 ─────────────────────────────────────────────
  rule({
    id: "SR-001",
    category: "Service",
    title: "תקלה חוזרת תוך 14 יום",
    severity: "medium",
    evaluate: (m) => m.repeatWithin14Days,
    finding: "זוהתה תקלה חוזרת בתוך 14 יום.",
    conclusion: "טיפול לא מספק — חזרתיות מהירה.",
    recommendation: "לדרוש ניתוח שורש תקלה ותיקון מלא.",
  }),
  rule({
    id: "SR-002",
    category: "Service",
    title: "יחס תקלות פתוחות גבוה",
    severity: "medium",
    evaluate: (m) => m.totalFaults >= 3 && m.unresolvedOpenRatio >= 0.4,
    finding: "חלק גבוה מהתקלות עדיין פתוחות.",
    conclusion: "איכות השירות נפגעת — סגירה איטית.",
    recommendation: "לדרוש SLA מואץ ודוח פתוחות.",
  }),
  rule({
    id: "SR-003",
    category: "Service",
    title: "תקלה פתוחה מעל 7 יום",
    severity: "high",
    evaluate: (m) => m.openFaultDurationDays >= 7,
    finding: "תקלה פתוחה לתקופה ממושכת.",
    conclusion: "זמן טיפול חורג — נדרש מעקב.",
    recommendation: "לדרוש הסבר מחברת השירות ותאריך סגירה.",
  }),
  rule({
    id: "SR-004",
    category: "Service",
    title: "ממוצע תקלות חודשי גבוה",
    severity: "medium",
    evaluate: (m) => m.avgFaultsPerMonth >= 4,
    finding: "קצב תקלות חודשי גבוה.",
    conclusion: "עומס תקלות מעיד על שירות לא יציב.",
    recommendation: "לדרוש תוכנית שיפור שירות.",
  }),
  rule({
    id: "SR-005",
    category: "Service",
    title: "שירות תקין — סגירות בזמן",
    severity: "info",
    evaluate: (m) =>
      m.totalFaults > 0 &&
      m.openFaults === 0 &&
      m.unresolvedOpenRatio === 0,
    finding: "כל התקלות נסגרו.",
    conclusion: "אין תקלות פתוחות — שירות מעודכן.",
    recommendation: "המשך מעקב שוטף.",
  }),

  // ─── Maintenance MAINT-001 – MAINT-005 ───────────────────────────────────
  rule({
    id: "MAINT-001",
    category: "Maintenance",
    title: "צורך בתחזוקה מונעת — ריבוי תקלות",
    severity: "medium",
    evaluate: (m) => m.faults90 >= 5,
    finding: "ריבוי תקלות מעיד על צורך בתחזוקה מונעת.",
    conclusion: "תחזוקה מונעת נדרשת.",
    recommendation: "לתאם ביקור תחזוקה מונעת מורחב.",
  }),
  rule({
    id: "MAINT-002",
    category: "Maintenance",
    title: "תחזוקה — תקלות דלת ופיקוד משולבות",
    severity: "medium",
    evaluate: (m) => m.doorFaults >= 2 && m.controlFaults >= 1,
    finding: "שילוב תקלות דלת ופיקוד.",
    conclusion: "ייתכן קשר בין רכיבים — בדיקה מקיפה.",
    recommendation: "ביקור תחזוקה כולל דלתות ובקר.",
  }),
  rule({
    id: "MAINT-003",
    category: "Maintenance",
    title: "תחזוקה — ללא תקלות 60 יום",
    severity: "info",
    evaluate: (m) => m.faults60 === 0 && m.totalFaults > 0,
    finding: "60 יום אחרונים ללא תקלות חדשות.",
    conclusion: "מגמת יציבות — תחזוקה אפקטיבית.",
    recommendation: "המשך לוח תחזוקה שוטף.",
  }),
  rule({
    id: "MAINT-004",
    category: "Maintenance",
    title: "תחזוקה — השבתות חוזרות",
    severity: "high",
    evaluate: (m) => m.shutdownEvents >= 2,
    finding: "השבתות חוזרות דורשות תחזוקה מערכתית.",
    conclusion: "תחזוקה לא מספקת למניעת השבתות.",
    recommendation: "ביקור תחזוקה מקיפה ודוח ממצאים.",
  }),
  rule({
    id: "MAINT-005",
    category: "Maintenance",
    title: "תחזוקה — מעלית יחידה עם ריבוי תקלות",
    severity: "medium",
    evaluate: (m) => m.recurringFaults >= 1 && m.elevatorCount >= 2,
    finding: "ריכוז תקלות במעלית אחת.",
    conclusion: "מעלית בעייתית — בדיקה ייעודית.",
    recommendation: "ביקור תחזוקה ממוקד למעלית.",
  }),

  // ─── Modernization MOD-001 – MOD-005 ─────────────────────────────────────
  rule({
    id: "MOD-001",
    category: "Modernization",
    title: "מועמד למודרניזציה — ריבוי תקלות",
    severity: "medium",
    evaluate: (m) => m.faults90 >= 8,
    finding: "ריבוי תקלות — מועמד לשקול מודרניזציה.",
    conclusion: "ייתכן שהמערכת הגיעה לגיל שירות שדורש שדרוג.",
    recommendation: "להעריך עלות-תועלת למודרניזציה.",
  }),
  rule({
    id: "MOD-002",
    category: "Modernization",
    title: "מודרניזציה — תקלות פיקוד והינע",
    severity: "high",
    evaluate: (m) => m.controlFaults >= 2 && m.driveFaults >= 2,
    finding: "שילוב תקלות בפיקוד והינע.",
    conclusion: "רכיבים מרכזיים מראים שחיקה — שקול שדרוג.",
    recommendation: "הערכת הנדסית למודרניזציה חלקית או מלאה.",
  }),
  rule({
    id: "MOD-003",
    category: "Modernization",
    title: "מודרניזציה — אין צורך מיידי",
    severity: "info",
    evaluate: (m) => m.faults90 <= 2 && m.totalFaults > 0,
    finding: "קצב תקלות נמוך.",
    conclusion: "לא נדרשת מודרניזציה בשלב זה.",
    recommendation: "המשך מעקב תקופתי.",
  }),
  rule({
    id: "MOD-004",
    category: "Modernization",
    title: "מודרניזציה — אחרי אירוע חילוץ",
    severity: "high",
    evaluate: (m) => m.rescueEvents >= 1 && m.faults90 >= 3,
    finding: "אירוע חילוץ עם ריבוי תקלות.",
    conclusion: "שקול מודרניזציה לאחר אירוע חילוץ.",
    recommendation: "הערכת מומחה למודרניזציה.",
  }),
  rule({
    id: "MOD-005",
    category: "Modernization",
    title: "מודרניזציה — מערכת דלתות ישנה",
    severity: "medium",
    evaluate: (m) => m.doorFaults >= 4 && m.doorRecurringPatterns >= 1,
    finding: "ריבוי וחזרתיות בתקלות דלת.",
    conclusion: "מערכת דלתות עשויה לדרוש שדרוג.",
    recommendation: "הערכת עלות להחלפת/שדרוג מערכת דלתות.",
  }),
];

export function getProfessionalRuleById(id: string): ProfessionalRule | undefined {
  return PROFESSIONAL_RULES.find((r) => r.id === id);
}

export function getRulesByCategory(category: RuleCategory): ProfessionalRule[] {
  return PROFESSIONAL_RULES.filter((r) => r.category === category);
}

export function evaluateProfessionalRules(
  metrics: AssessmentMetrics,
  rules: ProfessionalRule[] = PROFESSIONAL_RULES
): RuleEvaluationResult {
  const activatedRules: ActivatedProfessionalRule[] = [];
  const findings: string[] = [];
  const conclusions: string[] = [];
  const recommendations: string[] = [];
  let highestSeverity: RuleSeverity | null = null;

  for (const ruleDef of rules) {
    if (!ruleDef.evaluate(metrics)) continue;

    let finding = ruleDef.finding;
    if (ruleDef.id === "R-004") {
      finding = `נרשמו ${metrics.faults90} תקלות ב-90 הימים האחרונים.`;
    }
    if (ruleDef.id === "R-008" && metrics.faults30 > 0) {
      finding = `${finding} (${metrics.faults30} ב-30 יום)`;
    }

    activatedRules.push({
      id: ruleDef.id,
      category: ruleDef.category,
      title: ruleDef.title,
      severity: ruleDef.severity,
      finding,
      conclusion: ruleDef.conclusion,
      recommendation: ruleDef.recommendation,
    });

    if (finding) findings.push(finding);
    if (ruleDef.conclusion) conclusions.push(ruleDef.conclusion);
    if (ruleDef.recommendation) recommendations.push(ruleDef.recommendation);

    if (
      !highestSeverity ||
      SEVERITY_RANK[ruleDef.severity] > SEVERITY_RANK[highestSeverity]
    ) {
      highestSeverity = ruleDef.severity;
    }
  }

  return {
    activatedRules,
    findings: [...new Set(findings)],
    conclusions: [...new Set(conclusions)],
    recommendations: [...new Set(recommendations)],
    highestSeverity,
  };
}

export function exportRulesAsJson(): string {
  return JSON.stringify(
    PROFESSIONAL_RULES.map(({ evaluate: _e, ...rest }) => rest),
    null,
    2
  );
}
