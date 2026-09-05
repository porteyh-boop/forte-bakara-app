import { normalizeContactPhoneForLookup } from "@/lib/contacts";
import {
  emptySalesLeadDraft,
  isOpenSalesLead,
  salesLeadToDraft,
  type SalesLead,
  type SalesLeadDraft,
} from "@/lib/sales-leads";
import {
  isServiceType,
  SERVICE_TYPE_OTHER,
  validateServiceTypeFields,
} from "@/lib/service-type";

export const PUBLIC_SALES_LEAD_FORM_PATH = "/lead";
export const PUBLIC_SALES_LEAD_FORM_API_PATH = "/api/public/sales-lead";

export const PUBLIC_SALES_LEAD_SOURCE = "טופס דיגיטלי ללקוח";
export const PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT = "פרטים התקבלו מטופס לקוח";
export const PUBLIC_SALES_LEAD_FORM_SUCCESS_TEXT =
  "הפרטים התקבלו בהצלחה. נציג FORTE יחזור אליכם בהקדם.";
export const PUBLIC_SALES_LEAD_FORM_BADGE = "התקבלה מטופס דיגיטלי";
export const PUBLIC_SALES_LEAD_FORM_SUBMIT_LABEL = "שליחת הפרטים";

export const PUBLIC_FORM_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const PUBLIC_FORM_RATE_LIMIT_MAX = 5;
export const PUBLIC_FORM_MIN_DWELL_MS = 2000;
export const PUBLIC_FORM_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IDEMPOTENCY_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicSalesLeadFormInput = {
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  buildingName: string;
  address: string;
  city: string;
  serviceType: string;
  serviceTypeOther: string;
  needDescription: string;
  preferredContactAt: string;
};

export type PublicSalesLeadFormParseResult =
  | { ok: true; input: PublicSalesLeadFormInput; honeypotFilled: boolean }
  | { ok: false; error: string };

export function isPublicSalesLeadFormPath(pathname: string): boolean {
  return pathname === PUBLIC_SALES_LEAD_FORM_PATH;
}

export function emptyPublicSalesLeadFormInput(): PublicSalesLeadFormInput {
  return {
    clientName: "",
    contactName: "",
    phone: "",
    email: "",
    buildingName: "",
    address: "",
    city: "",
    serviceType: "",
    serviceTypeOther: "",
    needDescription: "",
    preferredContactAt: "",
  };
}

export function parsePublicSalesLeadIdempotencyKey(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return IDEMPOTENCY_KEY_RE.test(trimmed) ? trimmed : null;
}

export function normalizeSalesLeadPhoneForMatch(phone: string): string {
  let digits = normalizeContactPhoneForLookup(phone);
  if (digits.startsWith("972") && digits.length >= 11) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

export function phonesMatchForPublicSalesLead(
  left: string,
  right: string
): boolean {
  const a = normalizeSalesLeadPhoneForMatch(left);
  const b = normalizeSalesLeadPhoneForMatch(right);
  return Boolean(a && b && a === b);
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function asFormString(value: unknown, max: number): string {
  return clip(typeof value === "string" ? value : "", max);
}

export function parsePublicSalesLeadFormBody(
  body: unknown
): PublicSalesLeadFormParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_request" };
  }
  const raw = body as Record<string, unknown>;
  const honeypotFilled = Boolean(
    asFormString(raw.companyWebsite ?? raw.website ?? raw.fax, 120)
  );
  const input: PublicSalesLeadFormInput = {
    clientName: asFormString(raw.clientName, 160),
    contactName: asFormString(raw.contactName, 160),
    phone: asFormString(raw.phone, 40),
    email: asFormString(raw.email, 160),
    buildingName: asFormString(raw.buildingName, 160),
    address: asFormString(raw.address, 200),
    city: asFormString(raw.city, 80),
    serviceType: asFormString(raw.serviceType, 80),
    serviceTypeOther: asFormString(raw.serviceTypeOther, 160),
    needDescription: asFormString(raw.needDescription, 2000),
    preferredContactAt: asFormString(raw.preferredContactAt, 160),
  };
  return { ok: true, input, honeypotFilled };
}

export function validatePublicSalesLeadFormInput(
  input: PublicSalesLeadFormInput
): string | null {
  if (!input.clientName.trim()) {
    return "שם הלקוח / שם החברה או ועד הבית הוא שדה חובה.";
  }
  if (!input.contactName.trim()) return "שם איש הקשר הוא שדה חובה.";
  const phone = normalizeSalesLeadPhoneForMatch(input.phone);
  if (!phone || phone.length < 9) return "טלפון הוא שדה חובה.";
  const email = input.email.trim();
  if (email && !EMAIL_RE.test(email)) return "כתובת המייל אינה תקינה.";
  const serviceType = input.serviceType.trim();
  if (serviceType && !isServiceType(serviceType)) return "סוג שירות לא תקין.";
  if (isServiceType(serviceType)) {
    const serviceError = validateServiceTypeFields(
      serviceType,
      input.serviceTypeOther
    );
    if (serviceError) return serviceError;
  }
  return null;
}

export function preferredContactToNextAction(preferredContactAt: string): string {
  const trimmed = preferredContactAt.trim();
  return trimmed ? `מועד מועדף: ${trimmed}` : "";
}

export function publicFormPayloadHash(input: PublicSalesLeadFormInput): string {
  return JSON.stringify({
    clientName: input.clientName.trim(),
    contactName: input.contactName.trim(),
    phone: normalizeSalesLeadPhoneForMatch(input.phone),
    email: input.email.trim().toLowerCase(),
    buildingName: input.buildingName.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    serviceType: input.serviceType.trim(),
    serviceTypeOther:
      input.serviceType.trim() === SERVICE_TYPE_OTHER
        ? input.serviceTypeOther.trim()
        : "",
    needDescription: input.needDescription.trim(),
    preferredContactAt: input.preferredContactAt.trim(),
  });
}

export function findOpenMatchingSalesLead(
  leads: Array<
    Pick<SalesLead, "id" | "phone" | "email" | "status" | "updatedAt">
  >,
  input: Pick<PublicSalesLeadFormInput, "phone" | "email">
): string | null {
  const open = leads.filter((lead) => isOpenSalesLead(lead));
  const phone = normalizeSalesLeadPhoneForMatch(input.phone);
  if (phone) {
    const matches = open.filter((lead) =>
      phonesMatchForPublicSalesLead(lead.phone, input.phone)
    );
    if (matches.length > 0) {
      return [...matches].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )[0].id;
    }
  }

  const email = input.email.trim().toLowerCase();
  if (email) {
    const matches = open.filter(
      (lead) =>
        !normalizeSalesLeadPhoneForMatch(lead.phone) &&
        lead.email.trim().toLowerCase() === email
    );
    if (matches.length > 0) {
      return [...matches].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt)
      )[0].id;
    }
  }

  return null;
}

export function shouldCreateNewLeadForClosedMatch(
  lead: Pick<SalesLead, "status"> | null
): boolean {
  return !lead || !isOpenSalesLead(lead);
}

export function mapPublicFormToCreateDraft(
  input: PublicSalesLeadFormInput
): SalesLeadDraft {
  return {
    ...emptySalesLeadDraft(),
    clientName: input.clientName.trim(),
    contactName: input.contactName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    buildingName: input.buildingName.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    serviceType: input.serviceType.trim(),
    serviceTypeOther:
      input.serviceType.trim() === SERVICE_TYPE_OTHER
        ? input.serviceTypeOther.trim()
        : "",
    needDescription: input.needDescription.trim(),
    source: PUBLIC_SALES_LEAD_SOURCE,
    nextAction: preferredContactToNextAction(input.preferredContactAt),
    status: "חדש",
    note: PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  };
}

export function mapPublicFormToUpdateDraft(
  input: PublicSalesLeadFormInput,
  existing: SalesLead
): SalesLeadDraft {
  const draft = salesLeadToDraft(existing);
  const nextAction = preferredContactToNextAction(input.preferredContactAt);
  return {
    ...draft,
    clientName: input.clientName.trim() || existing.clientName,
    contactName: input.contactName.trim() || existing.contactName,
    phone: input.phone.trim() || existing.phone,
    email: input.email.trim() || existing.email,
    buildingName: input.buildingName.trim() || existing.buildingName,
    address: input.address.trim() || existing.address,
    city: input.city.trim() || existing.city,
    serviceType: input.serviceType.trim() || existing.serviceType,
    serviceTypeOther:
      (input.serviceType.trim() || existing.serviceType) === SERVICE_TYPE_OTHER
        ? input.serviceTypeOther.trim() || existing.serviceTypeOther
        : "",
    needDescription: input.needDescription.trim() || existing.needDescription,
    nextAction: nextAction || existing.nextAction,
    status: existing.status,
    note: PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  };
}

export function isDigitalFormSalesLead(
  lead: Pick<SalesLead, "source" | "history">
): boolean {
  if (lead.source === PUBLIC_SALES_LEAD_SOURCE) return true;
  return lead.history.some(
    (entry) => entry.text === PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT
  );
}

export function parsePublicFormStartedAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function isPublicFormDwellTooShort(
  startedAt: number | null,
  now: number = Date.now()
): boolean {
  if (startedAt == null) return true;
  return now - startedAt < PUBLIC_FORM_MIN_DWELL_MS;
}

export type RateLimitBucket = { count: number; resetAt: number };

export function consumeRateLimitBucket(
  buckets: Map<string, RateLimitBucket>,
  key: string,
  now: number,
  windowMs: number = PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
  max: number = PUBLIC_FORM_RATE_LIMIT_MAX
): boolean {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

export type IdempotencyRecord = {
  payloadHash: string;
  createdAt: number;
  outcome: "ok";
};

export function readIdempotencyRecord(
  store: Map<string, IdempotencyRecord>,
  key: string,
  payloadHash: string,
  now: number
): "miss" | "replay" | "conflict" {
  const existing = store.get(key);
  if (!existing) return "miss";
  if (now - existing.createdAt > PUBLIC_FORM_IDEMPOTENCY_TTL_MS) {
    store.delete(key);
    return "miss";
  }
  if (existing.payloadHash !== payloadHash) return "conflict";
  return "replay";
}

export function rememberIdempotencyRecord(
  store: Map<string, IdempotencyRecord>,
  key: string,
  payloadHash: string,
  now: number
): void {
  store.set(key, { payloadHash, createdAt: now, outcome: "ok" });
}
