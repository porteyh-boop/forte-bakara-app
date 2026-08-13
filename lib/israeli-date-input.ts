/** Display/parse helpers for DD/MM/YYYY ↔ YYYY-MM-DD (UI only). */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoToIsraeliDisplay(iso: string): string {
  const match = ISO_DATE_RE.exec(iso.trim());
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function israeliDisplayToIso(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return null;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidIsoDate(iso: string): boolean {
  return israeliDisplayToIso(isoToIsraeliDisplay(iso)) === iso.trim();
}

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const ISRAELI_DATE_PLACEHOLDER = "DD/MM/YYYY";

export const ISRAELI_DATE_INVALID_MESSAGE =
  "יש להזין תאריך בפורמט DD/MM/YYYY (למשל 12/08/2026).";
