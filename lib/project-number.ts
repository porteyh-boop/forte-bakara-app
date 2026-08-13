import { normalizeBuildingId } from "@/lib/buildings-cloud";

/** 2026 → 826, 2027 → 827 */
export function getProjectNumberYearPrefix(
  year: number = new Date().getFullYear()
): string {
  return String(800 + (year - 2000));
}

export function parseProjectNumberSequence(
  value: string,
  prefix: string
): number | null {
  const normalized = normalizeProjectNumber(value);
  if (!normalized.startsWith(prefix)) return null;
  const suffix = normalized.slice(prefix.length);
  if (!/^\d{3}$/.test(suffix)) return null;
  const seq = Number.parseInt(suffix, 10);
  return Number.isFinite(seq) && seq >= 101 ? seq : null;
}

export function normalizeProjectNumber(value: string): string {
  return value.trim();
}

/** 826101 — 6 ספרות, קידומת שנה + סדרה 101–999 */
export function isValidProjectNumberFormat(value: string): boolean {
  const normalized = normalizeProjectNumber(value);
  if (!/^\d{6}$/.test(normalized)) return false;

  const prefix = normalized.slice(0, 3);
  const year = 2000 + (Number(prefix) - 800);
  if (!Number.isFinite(year) || year < 2020 || year > 2099) return false;

  const seq = Number(normalized.slice(3));
  return Number.isFinite(seq) && seq >= 101 && seq <= 999;
}

export function isAutoFormatProjectNumber(value: string): boolean {
  const normalized = normalizeProjectNumber(value);
  if (!/^\d{6}$/.test(normalized)) return false;
  const prefix = normalized.slice(0, 3);
  const year = 2000 + (Number(prefix) - 800);
  if (!Number.isFinite(year) || year < 2020 || year > 2099) return false;
  const seq = Number(normalized.slice(3));
  return seq >= 101 && seq <= 999;
}

/** תצוגה: project_number אם קיים; אחרת building_id בפורmat אוטומטי (legacy) */
export function resolveDisplayProjectNumber(input: {
  projectNumber?: string | null;
  buildingId?: string | null;
}): string {
  const explicit = input.projectNumber?.trim();
  if (explicit) return explicit;

  const buildingId = input.buildingId?.trim() ?? "";
  if (buildingId && isAutoFormatProjectNumber(buildingId)) {
    return buildingId;
  }

  return "—";
}

export function resolveEditableProjectNumber(input: {
  projectNumber?: string | null;
  buildingId?: string | null;
}): string {
  const explicit = input.projectNumber?.trim();
  if (explicit) return explicit;

  const buildingId = input.buildingId?.trim() ?? "";
  if (buildingId && isAutoFormatProjectNumber(buildingId)) {
    return buildingId;
  }

  return "";
}

function collectAllocatedProjectNumbers(
  existingBuildingIds: string[],
  existingProjectNumbers: string[]
): Set<string> {
  const allocated = new Set<string>();

  for (const id of existingBuildingIds) {
    const normalized = normalizeBuildingId(id);
    if (normalized) allocated.add(normalized);
  }

  for (const number of existingProjectNumbers) {
    const normalized = normalizeProjectNumber(number);
    if (normalized) allocated.add(normalized);
  }

  return allocated;
}

/**
 * יוצר מספר פרויקט בפורmat 826101, 826102...
 * הסדרה מתחילה ב-101 בכל שנה.
 * הרצף מבוסס על MAX(building_id) בלבד — מספרים ידניים ב-project_number
 * לא מקדמים את הרצף, אך חוסמים הקצאה כפולה.
 */
export function generateNextProjectBuildingId(
  existingBuildingIds: string[],
  existingProjectNumbers: string[] = [],
  year: number = new Date().getFullYear()
): string {
  const prefix = getProjectNumberYearPrefix(year);
  let maxSeq = 100;

  for (const id of existingBuildingIds) {
    const seq = parseProjectNumberSequence(id, prefix);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }

  const allocated = collectAllocatedProjectNumbers(
    existingBuildingIds,
    existingProjectNumbers
  );

  for (let nextSeq = maxSeq + 1; nextSeq <= 999; nextSeq++) {
    const candidate = `${prefix}${nextSeq}`;
    if (!allocated.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("project_number_sequence_exhausted");
}

export const PROJECT_NUMBER_DUPLICATE_ERROR =
  "מספר הפרויקט כבר קיים במערכת. יש לבחור מספר אחר.";

export const PROJECT_NUMBER_INVALID_FORMAT_ERROR =
  "מספר פרויקט חייב להיות בפורmat 826101 (6 ספרות).";
