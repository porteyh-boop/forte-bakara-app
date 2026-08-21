export const SERVICE_TYPES = [
  "ייעוץ",
  "בקרת שירות",
  "בדק בית / חוות דעת",
  "בדיקת חוזה והצעות מחיר",
  "מודרניזציה / שדרוג",
  "תכנון ופיקוח",
  "בדיקה וקבלת מעלית",
  "שמאות / חוות דעת מומחה",
  "אחר",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_OTHER: ServiceType = "אחר";

export const SERVICE_TYPE_UNDEFINED_FILTER = "לא מוגדר";

export const SERVICE_TYPE_FILTER_OPTIONS = [
  "הכל",
  ...SERVICE_TYPES,
  SERVICE_TYPE_UNDEFINED_FILTER,
] as const;

export function isServiceType(value: string): value is ServiceType {
  return SERVICE_TYPES.includes(value as ServiceType);
}

export function normalizeServiceType(value: unknown): ServiceType | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isServiceType(trimmed) ? trimmed : null;
}

/** Label shown in lists and detail read mode. */
export function resolveServiceTypeDisplayLabel(
  serviceType: ServiceType | null,
  serviceTypeOther: string | null | undefined
): string | null {
  if (!serviceType) return null;
  if (serviceType === SERVICE_TYPE_OTHER) {
    const trimmed = serviceTypeOther?.trim();
    return trimmed || null;
  }
  return serviceType;
}

export function formatServiceTypeDisplay(
  serviceType: ServiceType | null,
  serviceTypeOther: string | null | undefined
): string {
  return resolveServiceTypeDisplayLabel(serviceType, serviceTypeOther) ?? "—";
}

export function validateServiceTypeFields(
  serviceType: ServiceType | "" | null | undefined,
  serviceTypeOther: string
): string | null {
  if (!serviceType) return null;
  if (serviceType === SERVICE_TYPE_OTHER && !serviceTypeOther.trim()) {
    return "יש להגדיר סוג שירות אחר.";
  }
  if (!isServiceType(serviceType)) {
    return "סוג שירות לא תקין.";
  }
  return null;
}

/** Normalize values before persisting to DB. */
export function normalizeServiceTypePersistence(input: {
  serviceType?: ServiceType | null;
  serviceTypeOther?: string | null;
}): { serviceType: ServiceType | null; serviceTypeOther: string | null } {
  const type = input.serviceType ?? null;
  if (!type) {
    return { serviceType: null, serviceTypeOther: null };
  }
  if (type === SERVICE_TYPE_OTHER) {
    return {
      serviceType: type,
      serviceTypeOther: input.serviceTypeOther?.trim() || null,
    };
  }
  return { serviceType: type, serviceTypeOther: null };
}

export function serviceTypeMatchesFilter(
  filter: string,
  serviceType: ServiceType | null
): boolean {
  if (filter === "הכל") return true;
  if (filter === SERVICE_TYPE_UNDEFINED_FILTER) return serviceType == null;
  if (filter === SERVICE_TYPE_OTHER) return serviceType === SERVICE_TYPE_OTHER;
  return serviceType === filter;
}

export function serviceTypeSearchHaystack(
  serviceType: ServiceType | null,
  serviceTypeOther: string | null | undefined
): string {
  const parts: string[] = [];
  if (serviceType) parts.push(serviceType);
  if (serviceTypeOther?.trim()) parts.push(serviceTypeOther.trim());
  const label = resolveServiceTypeDisplayLabel(serviceType, serviceTypeOther);
  if (label) parts.push(label);
  return parts.join(" ").toLowerCase();
}
