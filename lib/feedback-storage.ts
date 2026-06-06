import { getAllBuildingIds, isValidBuildingId } from "./buildings";
import type { FeedbackSubmissionInput, PilotFeedback } from "./types";

export const FEEDBACK_STORAGE_PREFIX = "forte-feedback";
export const FEEDBACK_UPDATED_EVENT = "forte-feedback-updated";

export const FEEDBACK_RESET_CONFIRM_ALL =
  "האם לאפס את כל משובי הפיילוט? פעולה זו תמחק את כל המשובים שנשמרו בדפדפן זה.";

export const FEEDBACK_RESET_CONFIRM_BUILDING =
  "האם לאפס את משובי הבניין הנבחר? פעולה זו תמחק משובים של בניין זה בלבד.";

export const FEEDBACK_RESET_SUCCESS_MESSAGE = "משובי הפיילוט אופסו בהצלחה.";

export type FeedbackStorageLike = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getFeedbackStorageKey(buildingId: string): string {
  return `${FEEDBACK_STORAGE_PREFIX}-${buildingId}`;
}

export function generateFeedbackId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildFeedbackFromInput(
  input: FeedbackSubmissionInput,
  buildingId: string,
  buildingName: string
): PilotFeedback {
  return {
    id: generateFeedbackId(),
    buildingId,
    buildingName,
    senderName: input.senderName.trim(),
    senderRole: input.senderRole,
    rating: input.rating,
    wouldUseRegularly: input.wouldUseRegularly,
    unclearOrMissing: input.unclearOrMissing.trim(),
    expectedFeature: input.expectedFeature.trim(),
    wouldRecommend: input.wouldRecommend,
    createdAt: new Date().toISOString(),
  };
}

function parseFeedbackList(raw: string | null): PilotFeedback[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PilotFeedback[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readFeedbackFromStorage(
  storage: FeedbackStorageLike,
  buildingId: string
): PilotFeedback[] {
  if (!isValidBuildingId(buildingId)) return [];
  return parseFeedbackList(storage.getItem(getFeedbackStorageKey(buildingId)));
}

export function writeFeedbackToStorage(
  storage: FeedbackStorageLike,
  buildingId: string,
  items: PilotFeedback[]
): void {
  if (!isValidBuildingId(buildingId)) return;
  storage.setItem(getFeedbackStorageKey(buildingId), JSON.stringify(items));
}

export function getFeedbackByBuilding(buildingId: string): PilotFeedback[] {
  if (!isBrowser()) return [];
  return readFeedbackFromStorage(localStorage, buildingId);
}

export function saveFeedback(
  feedback: PilotFeedback,
  storage: FeedbackStorageLike = isBrowser() ? localStorage : (null as never)
): void {
  if (!storage || !isValidBuildingId(feedback.buildingId)) return;
  const existing = readFeedbackFromStorage(storage, feedback.buildingId);
  writeFeedbackToStorage(storage, feedback.buildingId, [...existing, feedback]);
}

export function getAllFeedbackStorageKeys(
  storage: FeedbackStorageLike
): string[] {
  const keys = new Set<string>();
  for (const buildingId of getAllBuildingIds()) {
    keys.add(getFeedbackStorageKey(buildingId));
  }
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(`${FEEDBACK_STORAGE_PREFIX}-`)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}

export function getAllFeedbackFromStorage(
  storage: FeedbackStorageLike
): PilotFeedback[] {
  const all: PilotFeedback[] = [];
  for (const key of getAllFeedbackStorageKeys(storage)) {
    const raw = storage.getItem(key);
    all.push(...parseFeedbackList(raw));
  }
  return all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getAllFeedback(): PilotFeedback[] {
  if (!isBrowser()) return [];
  return getAllFeedbackFromStorage(localStorage);
}

export function clearFeedbackByBuilding(
  buildingId: string,
  storage: FeedbackStorageLike = isBrowser() ? localStorage : (null as never)
): boolean {
  if (!storage || !isValidBuildingId(buildingId)) return false;
  storage.removeItem(getFeedbackStorageKey(buildingId));
  return true;
}

export function clearAllFeedbackFromStorage(
  storage: FeedbackStorageLike
): string[] {
  const keys = getAllFeedbackStorageKeys(storage);
  for (const key of keys) {
    storage.removeItem(key);
  }
  return keys;
}

export function clearAllFeedback(): boolean {
  if (!isBrowser()) return false;
  clearAllFeedbackFromStorage(localStorage);
  return true;
}

export function notifyFeedbackUpdated(buildingId?: string): void {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent(FEEDBACK_UPDATED_EVENT, { detail: { buildingId } })
  );
}

export function saveFeedbackAndNotify(
  input: FeedbackSubmissionInput,
  buildingId: string,
  buildingName: string
): PilotFeedback | null {
  if (!isBrowser() || !isValidBuildingId(buildingId)) return null;
  const feedback = buildFeedbackFromInput(input, buildingId, buildingName);
  saveFeedback(feedback, localStorage);
  notifyFeedbackUpdated(buildingId);
  return feedback;
}

export function isFeedbackFormValid(input: Partial<FeedbackSubmissionInput>): boolean {
  return Boolean(
    input.senderName?.trim() &&
      input.senderRole &&
      input.rating &&
      input.wouldUseRegularly &&
      input.wouldRecommend
  );
}
