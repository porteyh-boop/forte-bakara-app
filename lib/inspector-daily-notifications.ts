import type { InspectorLegacyNotificationType } from "./document-inspector-notifications";
import { listAllDocumentInspectorMeta } from "./document-inspector-meta";
import {
  INSPECTOR_ALERT_DAY,
  INSPECTOR_REMINDER_DAY,
  INSPECTOR_URGENT_DAY,
} from "./inspector-report-tracking";

export interface InspectorDailyNotificationRunResult {
  ok: boolean;
  scanned: number;
  sent: Record<InspectorLegacyNotificationType, number>;
  skipped: number;
  errors: string[];
  legacyEmailsDisabled: boolean;
}

/** @deprecated Phase 2 — legacy 35/40/45 model; retained for QA / history reads */
export function resolveInspectorNotificationType(
  daysSince: number
): InspectorLegacyNotificationType | null {
  if (daysSince >= INSPECTOR_URGENT_DAY) return "day_45_plus";
  if (daysSince >= INSPECTOR_ALERT_DAY) return "day_40";
  if (daysSince >= INSPECTOR_REMINDER_DAY) return "day_35";
  return null;
}

/** @deprecated Phase 2 — legacy 35/40/45 model; retained for QA / history reads */
export function pickInspectorNotificationToSend(
  daysSince: number,
  alreadySent: ReadonlySet<InspectorLegacyNotificationType>
): InspectorLegacyNotificationType | null {
  const type = resolveInspectorNotificationType(daysSince);
  if (!type || alreadySent.has(type)) return null;
  return type;
}

/**
 * Phase 2: מכתבי מעקב 45 יום מנוהלים ב-UI (LETTER_1/2/3).
 * התראות 35/40/45 הישנות ב-Resend הושבתו — היסטוריה נשמרת ב-DB.
 */
export async function runInspectorDailyNotifications(
  _now: Date = new Date()
): Promise<InspectorDailyNotificationRunResult> {
  const metaRows = await listAllDocumentInspectorMeta();
  const openCount = metaRows.filter(
    (meta) => meta.status === "open" && meta.has_remarks
  ).length;

  return {
    ok: true,
    scanned: openCount,
    sent: { day_35: 0, day_40: 0, day_45_plus: 0 },
    skipped: openCount,
    errors: [],
    legacyEmailsDisabled: true,
  };
}
