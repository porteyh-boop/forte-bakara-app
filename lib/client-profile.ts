export const CLIENT_TYPE_OPTIONS = [
  "ועד בית",
  "חברת ניהול",
  "דייר",
  "נציג בניין",
  "אחר",
] as const;

export type ClientType = (typeof CLIENT_TYPE_OPTIONS)[number];

export const DEFAULT_CLIENT_WELCOME_MESSAGE =
  "ברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן המידע הזמין עבורכם במערכת.";

export function isClientType(value: string | null | undefined): value is ClientType {
  if (!value) return false;
  return (CLIENT_TYPE_OPTIONS as readonly string[]).includes(value);
}

export function resolveClientWelcomeMessage(
  welcomeMessage: string | null | undefined
): string {
  const trimmed = welcomeMessage?.trim();
  return trimmed || DEFAULT_CLIENT_WELCOME_MESSAGE;
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

export function computePortalDataLastUpdated(timestamps: Array<string | null | undefined>): string | null {
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
