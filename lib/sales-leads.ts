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

export const SALES_LEAD_CREATED_HISTORY_TEXT = "פנייה נוצרה.";

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
): { lead: SalesLead; newHistory: SalesLeadHistoryEntry[]; error: string | null } {
  const error = validateSalesLeadDraft(draft);
  if (error) {
    return { lead: existing ?? createBlankLead(now), newHistory: [], error };
  }

  const iso = now.toISOString();
  const nextAction = draft.nextAction.trim();
  const followUpDate = draft.followUpDate.trim() || null;
  const note = draft.note.trim();
  const history = existing ? [...existing.history] : [];

  const newHistory: SalesLeadHistoryEntry[] = [];

  if (!existing) {
    newHistory.push({
      id: newId("hist"),
      at: iso,
      kind: "created",
      text: SALES_LEAD_CREATED_HISTORY_TEXT,
      status: draft.status,
    });
  } else if (existing.status !== draft.status) {
    newHistory.push({
      id: newId("hist"),
      at: iso,
      kind: "status",
      text: `סטטוס עודכן מ-${existing.status} ל-${draft.status}.`,
      status: draft.status,
    });
  }

  if (note) {
    newHistory.push({
      id: newId("hist"),
      at: iso,
      kind: "note",
      text: note,
    });
  }

  history.push(...newHistory);

  const lead: SalesLead = {
    id: existing?.id ?? newId("lead"),
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

  return { lead, newHistory, error: null };
}

function createBlankLead(now: Date): SalesLead {
  const iso = now.toISOString();
  return {
    id: newId("lead"),
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
