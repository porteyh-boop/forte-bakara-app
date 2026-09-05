import { SERVICE_TYPES } from "./service-type";

export const JERUSALEM_TIME_ZONE = "Asia/Jerusalem";

export const SALES_LEAD_STATUSES = [
  "חדש",
  "נוצר קשר",
  "בירור-פגישה",
  "הצעה נשלחה",
  "משא ומתן",
  "זכייה",
  "לא נסגר",
] as const;

export type SalesLeadStatus = (typeof SALES_LEAD_STATUSES)[number];

export const CLOSED_SALES_LEAD_STATUSES: readonly SalesLeadStatus[] = [
  "זכייה",
  "לא נסגר",
];

export const SALES_LEAD_SOURCES = [
  "אתר",
  "המלצה",
  "שיחה יזומה",
  "שלט",
  "לקוח חוזר",
] as const;

export const SALES_LEAD_CHANNELS = [
  "טלפון",
  "וואטסאפ",
  "דוא\"ל",
  "פגישה",
] as const;

export const SALES_LEAD_SERVICE_TYPES = SERVICE_TYPES;

export const SALES_LEAD_FILTERS = [
  "הכול",
  "לטיפול היום",
  "באיחור",
  "ללא מועד מעקב",
] as const;

export type SalesLeadFilter = (typeof SALES_LEAD_FILTERS)[number];

export type SalesLeadHistoryKind = "note" | "status" | "created";

export type SalesLeadHistoryEntry = {
  id: string;
  at: string;
  kind: SalesLeadHistoryKind;
  text: string;
  status?: SalesLeadStatus;
};

export type SalesLead = {
  id: string;
  clientName: string;
  buildingName: string;
  address: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  needDescription: string;
  serviceType: string;
  source: string;
  sourceDetail: string;
  contactChannel: string;
  status: SalesLeadStatus;
  estimatedValue: number | null;
  nextAction: string;
  followUpDate: string | null;
  history: SalesLeadHistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SalesLeadDraft = {
  clientName: string;
  buildingName: string;
  address: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  needDescription: string;
  serviceType: string;
  source: string;
  sourceDetail: string;
  contactChannel: string;
  status: SalesLeadStatus;
  estimatedValue: string;
  nextAction: string;
  followUpDate: string;
  note: string;
};

export type SalesLeadSummary = {
  newLeads: number;
  followUpsToday: number;
  overdueFollowUps: number;
  pendingProposals: number;
};

export function jerusalemCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JERUSALEM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftCalendarDate(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return ymd;
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatSalesLeadDate(ymd: string | null): string {
  if (!ymd?.trim()) return "—";
  const [year, month, day] = ymd.split("-");
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year}`;
}

export function isClosedSalesLeadStatus(status: SalesLeadStatus): boolean {
  return CLOSED_SALES_LEAD_STATUSES.includes(status);
}

export function isOpenSalesLead(lead: Pick<SalesLead, "status">): boolean {
  return !isClosedSalesLeadStatus(lead.status);
}

export function isFollowUpDueToday(
  lead: Pick<SalesLead, "status" | "followUpDate">,
  today: string
): boolean {
  return isOpenSalesLead(lead) && lead.followUpDate === today;
}

export function isFollowUpOverdue(
  lead: Pick<SalesLead, "status" | "followUpDate">,
  today: string
): boolean {
  return (
    isOpenSalesLead(lead) &&
    Boolean(lead.followUpDate) &&
    (lead.followUpDate as string) < today
  );
}

export function summarizeSalesLeads(
  leads: SalesLead[],
  today: string
): SalesLeadSummary {
  return {
    newLeads: leads.filter((lead) => lead.status === "חדש").length,
    followUpsToday: leads.filter((lead) => isFollowUpDueToday(lead, today)).length,
    overdueFollowUps: leads.filter((lead) => isFollowUpOverdue(lead, today)).length,
    pendingProposals: leads.filter((lead) => lead.status === "הצעה נשלחה").length,
  };
}

export function salesLeadMatchesSearch(lead: SalesLead, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    lead.clientName,
    lead.buildingName,
    lead.contactName,
    lead.serviceType,
    lead.status,
    lead.city,
    lead.phone,
    lead.nextAction,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterSalesLeads(
  leads: SalesLead[],
  filter: SalesLeadFilter,
  today: string,
  query = ""
): SalesLead[] {
  return leads.filter((lead) => {
    if (!salesLeadMatchesSearch(lead, query)) return false;
    if (filter === "לטיפול היום") return isFollowUpDueToday(lead, today);
    if (filter === "באיחור") return isFollowUpOverdue(lead, today);
    if (filter === "ללא מועד מעקב") return !lead.followUpDate;
    return true;
  });
}

export function emptySalesLeadDraft(): SalesLeadDraft {
  return {
    clientName: "",
    buildingName: "",
    address: "",
    city: "",
    contactName: "",
    phone: "",
    email: "",
    needDescription: "",
    serviceType: "",
    source: "",
    sourceDetail: "",
    contactChannel: "",
    status: "חדש",
    estimatedValue: "",
    nextAction: "",
    followUpDate: "",
    note: "",
  };
}

export function salesLeadToDraft(lead: SalesLead): SalesLeadDraft {
  return {
    clientName: lead.clientName,
    buildingName: lead.buildingName,
    address: lead.address,
    city: lead.city,
    contactName: lead.contactName,
    phone: lead.phone,
    email: lead.email,
    needDescription: lead.needDescription,
    serviceType: lead.serviceType,
    source: lead.source,
    sourceDetail: lead.sourceDetail,
    contactChannel: lead.contactChannel,
    status: lead.status,
    estimatedValue: lead.estimatedValue == null ? "" : String(lead.estimatedValue),
    nextAction: lead.nextAction,
    followUpDate: lead.followUpDate ?? "",
    note: "",
  };
}

export function validateSalesLeadDraft(draft: SalesLeadDraft): string | null {
  if (!draft.clientName.trim()) return "שם לקוח הוא שדה חובה.";
  if (draft.status && !SALES_LEAD_STATUSES.includes(draft.status)) {
    return "סטטוס לא תקין.";
  }
  if (draft.estimatedValue.trim()) {
    const value = Number(draft.estimatedValue);
    if (!Number.isFinite(value) || value < 0) return "שווי משוער אינו תקין.";
  }
  return null;
}

function parseEstimatedValue(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function newId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function applySalesLeadDraft(
  draft: SalesLeadDraft,
  existing: SalesLead | null,
  now: Date = new Date()
): { lead: SalesLead; error: string | null } {
  const error = validateSalesLeadDraft(draft);
  if (error) return { lead: existing ?? createBlankLead(now), error };

  const iso = now.toISOString();
  const nextAction = draft.nextAction.trim();
  const followUpDate = draft.followUpDate.trim() || null;
  const note = draft.note.trim();
  const history = existing ? [...existing.history] : [];

  if (!existing) {
    history.push({
      id: newId("hist"),
      at: iso,
      kind: "created",
      text: "פנייה נוצרה בתצוגת הדגמה.",
      status: draft.status,
    });
  } else if (existing.status !== draft.status) {
    history.push({
      id: newId("hist"),
      at: iso,
      kind: "status",
      text: `סטטוס עודכן מ-${existing.status} ל-${draft.status}.`,
      status: draft.status,
    });
  }

  if (note) {
    history.push({
      id: newId("hist"),
      at: iso,
      kind: "note",
      text: note,
    });
  }

  const lead: SalesLead = {
    id: existing?.id ?? newId("syn-lead"),
    clientName: draft.clientName.trim(),
    buildingName: draft.buildingName.trim(),
    address: draft.address.trim(),
    city: draft.city.trim(),
    contactName: draft.contactName.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
    needDescription: draft.needDescription.trim(),
    serviceType: draft.serviceType.trim(),
    source: draft.source.trim(),
    sourceDetail: draft.sourceDetail.trim(),
    contactChannel: draft.contactChannel.trim(),
    status: draft.status,
    estimatedValue: parseEstimatedValue(draft.estimatedValue),
    nextAction,
    followUpDate,
    history,
    createdAt: existing?.createdAt ?? iso,
    updatedAt: iso,
  };

  return { lead, error: null };
}

function createBlankLead(now: Date): SalesLead {
  const iso = now.toISOString();
  return {
    id: newId("syn-lead"),
    clientName: "",
    buildingName: "",
    address: "",
    city: "",
    contactName: "",
    phone: "",
    email: "",
    needDescription: "",
    serviceType: "",
    source: "",
    sourceDetail: "",
    contactChannel: "",
    status: "חדש",
    estimatedValue: null,
    nextAction: "",
    followUpDate: null,
    history: [],
    createdAt: iso,
    updatedAt: iso,
  };
}

function historyEntry(
  id: string,
  at: string,
  kind: SalesLeadHistoryKind,
  text: string,
  status?: SalesLeadStatus
): SalesLeadHistoryEntry {
  return { id, at, kind, text, status };
}

export function createSyntheticSalesLeads(now: Date = new Date()): SalesLead[] {
  const today = jerusalemCalendarDate(now);
  const yesterday = shiftCalendarDate(today, -1);
  const lastWeek = shiftCalendarDate(today, -7);
  const tomorrow = shiftCalendarDate(today, 1);
  const created = "2026-08-01T08:00:00.000Z";

  return [
    {
      id: "syn-lead-new-today",
      clientName: "ועד בית הדגמה אלון",
      buildingName: "מגדל סינתטי 1",
      address: "רחוב הדגמה 12",
      city: "עיר בדיקה",
      contactName: "נועה דמה",
      phone: "050-0000101",
      email: "alon-demo@example.invalid",
      needDescription: "בקשת ייעוץ ראשונית לבדיקת מצב המעליות.",
      serviceType: "ייעוץ",
      source: "אתר",
      sourceDetail: "טופס יצירת קשר סינתטי",
      contactChannel: "דוא\"ל",
      status: "חדש",
      estimatedValue: 8500,
      nextAction: "שיחת היכרות",
      followUpDate: today,
      history: [
        historyEntry("h1", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
      ],
      createdAt: created,
      updatedAt: created,
    },
    {
      id: "syn-lead-overdue",
      clientName: "חברת ניהול סינתטית דקל",
      buildingName: "מתחם בדיקה דרום",
      address: "שדרות הדוגמה 8",
      city: "עיר בדיקה",
      contactName: "יואב דמה",
      phone: "050-0000102",
      email: "dekel-demo@example.invalid",
      needDescription: "מעקב אחרי שיחה ראשונה שטרם נסגרה.",
      serviceType: "בקרת שירות",
      source: "המלצה",
      sourceDetail: "המלצת לקוח פיקטיבית",
      contactChannel: "טלפון",
      status: "נוצר קשר",
      estimatedValue: 14000,
      nextAction: "לחזור עם הצעת מסגרת",
      followUpDate: yesterday,
      history: [
        historyEntry("h2", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry(
          "h2b",
          "2026-08-10T10:00:00.000Z",
          "status",
          "סטטוס עודכן מ-חדש לנוצר קשר.",
          "נוצר קשר"
        ),
      ],
      createdAt: created,
      updatedAt: "2026-08-10T10:00:00.000Z",
    },
    {
      id: "syn-lead-no-date",
      clientName: "נציגות בניין בדיקה",
      buildingName: "בית הדגמה מערב",
      address: "סמטת הסימולציה 3",
      city: "עיר דמה",
      contactName: "מאיה דמה",
      phone: "050-0000103",
      email: "maaya-demo@example.invalid",
      needDescription: "בירור לגבי פגישת אתר — בלי מועד מעקב.",
      serviceType: "בדק בית / חוות דעת",
      source: "שיחה יזומה",
      sourceDetail: "חיוג יזום מרשימת הדגמה",
      contactChannel: "וואטסאפ",
      status: "בירור-פגישה",
      estimatedValue: 6200,
      nextAction: "לקבוע מועד פגישה",
      followUpDate: null,
      history: [
        historyEntry("h3", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry(
          "h3b",
          "2026-08-12T09:00:00.000Z",
          "note",
          "ממתינים לתיאום יומן. אין תאריך מעקב."
        ),
      ],
      createdAt: created,
      updatedAt: "2026-08-12T09:00:00.000Z",
    },
    {
      id: "syn-lead-proposal",
      clientName: "אגודת דיירים סינתטית",
      buildingName: "מגדלי הדוגמה",
      address: "דרך הפיקציה 21",
      city: "עיר בדיקה",
      contactName: "עמית דמה",
      phone: "050-0000104",
      email: "amit-demo@example.invalid",
      needDescription: "הצעת בקרת שירות ממתינה לתשובת הלקוח.",
      serviceType: "בקרת שירות",
      source: "שלט",
      sourceDetail: "שלט כניסה סינתטי",
      contactChannel: "דוא\"ל",
      status: "הצעה נשלחה",
      estimatedValue: 22000,
      nextAction: "לוודא קבלת ההצעה",
      followUpDate: tomorrow,
      history: [
        historyEntry("h4", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry(
          "h4b",
          "2026-08-18T11:00:00.000Z",
          "status",
          "סטטוס עודכן להצעה נשלחה.",
          "הצעה נשלחה"
        ),
      ],
      createdAt: created,
      updatedAt: "2026-08-18T11:00:00.000Z",
    },
    {
      id: "syn-lead-negotiate",
      clientName: "ועד סימולציה צפון",
      buildingName: "מגדל תרגול 7",
      address: "כיכר הניסוי 4",
      city: "עיר דמה",
      contactName: "ליאור דמה",
      phone: "050-0000105",
      email: "lior-demo@example.invalid",
      needDescription: "משא ומתן על היקף פיקוח.",
      serviceType: "תכנון ופיקוח",
      source: "לקוח חוזר",
      sourceDetail: "פנייה חוזרת מתיק הדגמה",
      contactChannel: "פגישה",
      status: "משא ומתן",
      estimatedValue: 31000,
      nextAction: "לשלוח תיקוף היקף",
      followUpDate: today,
      history: [
        historyEntry("h5", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry(
          "h5b",
          "2026-08-20T14:00:00.000Z",
          "note",
          "סוכם עקרונית על היקף ביניים."
        ),
      ],
      createdAt: created,
      updatedAt: "2026-08-20T14:00:00.000Z",
    },
    {
      id: "syn-lead-won",
      clientName: "חברת הדגמה ירוקה",
      buildingName: "מתחם סגור לדוגמה",
      address: "שביל ההצלחה 9",
      city: "עיר בדיקה",
      contactName: "דנה דמה",
      phone: "050-0000106",
      email: "dana-demo@example.invalid",
      needDescription: "זכייה סינתטית — לא בתור מעקבים פתוחים.",
      serviceType: "בדיקה וקבלת מעלית",
      source: "המלצה",
      sourceDetail: "המלצה פיקטיבית",
      contactChannel: "טלפון",
      status: "זכייה",
      estimatedValue: 18000,
      nextAction: "לא רלוונטי — נסגר",
      followUpDate: today,
      history: [
        historyEntry("h6", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry("h6b", lastWeek + "T12:00:00.000Z", "status", "זכייה.", "זכייה"),
      ],
      createdAt: created,
      updatedAt: lastWeek + "T12:00:00.000Z",
    },
    {
      id: "syn-lead-lost",
      clientName: "ועד תרגול דרום",
      buildingName: "בניין שלא נסגר",
      address: "רחוב הסגירה 2",
      city: "עיר דמה",
      contactName: "רון דמה",
      phone: "050-0000107",
      email: "ron-demo@example.invalid",
      needDescription: "לא נסגר — תאריך מעקב ישן לא נספר בתור הפתוח.",
      serviceType: "מודרניזציה / שדרוג",
      source: "אתר",
      sourceDetail: "פנייה ישנה מהדגמה",
      contactChannel: "וואטסאפ",
      status: "לא נסגר",
      estimatedValue: 45000,
      nextAction: "אין מעקב פתוח",
      followUpDate: lastWeek,
      history: [
        historyEntry("h7", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
        historyEntry(
          "h7b",
          lastWeek + "T15:00:00.000Z",
          "status",
          "הפנייה לא נסגרה.",
          "לא נסגר"
        ),
      ],
      createdAt: created,
      updatedAt: lastWeek + "T15:00:00.000Z",
    },
    {
      id: "syn-lead-new-nodate",
      clientName: "נציג בניין סימולציה",
      buildingName: "בית הדוגמאות",
      address: "סמטה ללא מעקב 5",
      city: "עיר בדיקה",
      contactName: "שירה דמה",
      phone: "050-0000108",
      email: "shira-demo@example.invalid",
      needDescription: "פנייה חדשה בלי מועד מעקב.",
      serviceType: "שמאות / חוות דעת מומחה",
      source: "שיחה יזומה",
      sourceDetail: "שיחה יזומה מהדגמה",
      contactChannel: "טלפון",
      status: "חדש",
      estimatedValue: null,
      nextAction: "",
      followUpDate: null,
      history: [
        historyEntry("h8", created, "created", "פנייה סינתטית נקלטה.", "חדש"),
      ],
      createdAt: created,
      updatedAt: created,
    },
  ];
}

export function salesLeadStatusTone(
  status: SalesLeadStatus
): "blue" | "neutral" | "success" | "warning" | "danger" {
  if (status === "זכייה") return "success";
  if (status === "לא נסגר") return "danger";
  if (status === "הצעה נשלחה" || status === "משא ומתן") return "warning";
  if (status === "חדש") return "blue";
  return "neutral";
}

export function formatEstimatedValue(value: number | null): string {
  if (value == null) return "—";
  return `₪${value.toLocaleString("he-IL")}`;
}
