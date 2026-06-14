export const CLIENT_TYPE_OPTIONS = [
  "ועד בית",
  "חברת ניהול",
  "עורך דין",
  "חברת ביטוח",
  "אדריכל",
  "יזם",
  "שמאי מקרקעין",
  "משקיע / רוכש נכס",
  "קבלן",
  "אחר",
] as const;

/** סוגים ישנים שנשמרים לתאימות לאחור בלבד */
export const LEGACY_CLIENT_TYPE_OPTIONS = ["דייר", "נציג בניין"] as const;

export type ClientType = (typeof CLIENT_TYPE_OPTIONS)[number];
export type LegacyClientType = (typeof LEGACY_CLIENT_TYPE_OPTIONS)[number];
export type StoredClientType = ClientType | LegacyClientType;

export const CLIENT_TYPE_NOT_SET_LABEL = "לא מוגדר";

export const DEFAULT_CLIENT_WELCOME_MESSAGE =
  "ברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן המידע הזמין עבורכם במערכת.";

export const CLIENT_TYPE_WELCOME_MESSAGES: Record<StoredClientType, string> = {
  "ועד בית":
    "שלום ועד הבית,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הבניין המעודכנים הזמינים עבורכם במערכת.",
  "חברת ניהול":
    "שלום לצוות הניהול,\nברוכים הבאים לפורטל הבקרה של פורטה.\nלהלן נתוני הבניינים והמידע התפעולי הזמין עבורכם במערכת.",
  "עורך דין":
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן המידע והמסמכים הזמינים עבורכם במערכת.",
  "חברת ביטוח":
    "שלום,\nברוכים הבאים לפורטל הבקרה של פורטה.\nלהלן נתוני הבניין והמידע הזמין עבורכם במערכת.",
  אדריכל:
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הבניין והמידע המקצועי הזמין עבורכם במערכת.",
  יזם:
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הפרויקט והמידע הזמין עבורכם במערכת.",
  "שמאי מקרקעין":
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הנכס והמידע הזמין עבורכם במערכת.",
  "משקיע / רוכש נכס":
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הנכס והמידע הזמין עבורכם במערכת.",
  קבלן:
    "שלום,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הבניין והמידע התפעולי הזמין עבורכם במערכת.",
  אחר: DEFAULT_CLIENT_WELCOME_MESSAGE,
  דייר:
    "שלום,\nברוכים הבאים לפורטל הדיירים של פורטה בקרה.\nכאן ניתן לצפות במידע שהוגדר עבורכם ולדווח על תקלות.",
  "נציג בניין":
    "שלום נציג הבניין,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הבניין והמידע הזמין עבורכם במערכת.",
};

export function isClientType(value: string | null | undefined): value is ClientType {
  if (!value) return false;
  return (CLIENT_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function isStoredClientType(
  value: string | null | undefined
): value is StoredClientType {
  if (!value) return false;
  return (
    isClientType(value) ||
    (LEGACY_CLIENT_TYPE_OPTIONS as readonly string[]).includes(value)
  );
}

export function getClientTypeFormOptions(
  currentValue?: string | null
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [
    { value: "", label: CLIENT_TYPE_NOT_SET_LABEL },
  ];

  for (const option of CLIENT_TYPE_OPTIONS) {
    options.push({ value: option, label: option });
  }

  if (
    currentValue &&
    isStoredClientType(currentValue) &&
    !isClientType(currentValue)
  ) {
    options.push({
      value: currentValue,
      label: `${currentValue} (סוג קודם)`,
    });
  }

  return options;
}

export function formatClientTypeDisplay(
  value: StoredClientType | null | undefined
): string {
  if (!value) return CLIENT_TYPE_NOT_SET_LABEL;
  return value;
}

export function getDefaultWelcomeMessageForClientType(
  clientType: StoredClientType | null | undefined
): string {
  if (clientType && isStoredClientType(clientType)) {
    return CLIENT_TYPE_WELCOME_MESSAGES[clientType];
  }
  return DEFAULT_CLIENT_WELCOME_MESSAGE;
}

export function resolveClientWelcomeMessage(
  welcomeMessage: string | null | undefined,
  clientType?: StoredClientType | null
): string {
  const trimmed = welcomeMessage?.trim();
  if (trimmed) return trimmed;
  return getDefaultWelcomeMessageForClientType(clientType);
}

export function hydrateWelcomeMessageForEdit(
  welcomeMessage: string | null | undefined,
  clientType: StoredClientType | null | undefined
): string {
  const trimmed = welcomeMessage?.trim();
  if (trimmed) return trimmed;
  return getDefaultWelcomeMessageForClientType(clientType);
}

export function normalizeWelcomeMessageForSave(
  welcomeMessage: string,
  clientType: StoredClientType | null | undefined
): string | null {
  const trimmed = welcomeMessage.trim();
  if (!trimmed) return null;
  if (trimmed === getDefaultWelcomeMessageForClientType(clientType).trim()) {
    return null;
  }
  return trimmed;
}

export function formatClientPortalLastUpdated(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function computePortalDataLastUpdated(
  timestamps: Array<string | null | undefined>
): string | null {
  let maxMs = 0;

  for (const value of timestamps) {
    if (!value) continue;
    const ms = new Date(value).getTime();
    if (!Number.isNaN(ms) && ms > maxMs) {
      maxMs = ms;
    }
  }

  return maxMs > 0 ? new Date(maxMs).toISOString() : null;
}
