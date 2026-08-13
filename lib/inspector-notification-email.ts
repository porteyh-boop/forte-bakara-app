import { Resend } from "resend";
import type { InspectorLegacyNotificationType } from "./document-inspector-notifications";

export const INSPECTOR_NOTIFY_EMAIL = "lifts.forte@gmail.com";

export interface InspectorNotificationEmailPayload {
  buildingName: string;
  elevatorLabel: string;
  reportDate: string;
  inspectorName: string;
  daysSinceReport: number;
  statusLabel: string;
  documentUrl: string;
}

export function buildInspectorNotificationSubject(
  type: InspectorLegacyNotificationType
): string {
  switch (type) {
    case "day_35":
      return "תסקיר בודק מתקרב למועד היעד";
    case "day_40":
      return "נותרו 5 ימים לסגירת הערות בודק";
    case "day_45_plus":
      return "חריגה ממועד טיפול בתסקיר בודק";
  }
}

export function buildInspectorNotificationEmailText(
  payload: InspectorNotificationEmailPayload
): string {
  return [
    "התראה אוטומטית — מעקב תסקיר בודק.",
    "",
    `בניין: ${payload.buildingName}`,
    `מעלית: ${payload.elevatorLabel}`,
    `תאריך תסקיר: ${payload.reportDate}`,
    `שם בודק: ${payload.inspectorName}`,
    `ימים שחלפו: ${payload.daysSinceReport}`,
    `סטטוס: ${payload.statusLabel}`,
    `קישור למסמך: ${payload.documentUrl}`,
  ].join("\n");
}

function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
}

export async function sendInspectorNotificationEmail(
  type: InspectorLegacyNotificationType,
  payload: InspectorNotificationEmailPayload
): Promise<{ ok: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const resend = new Resend(resendApiKey);
  const subject = buildInspectorNotificationSubject(type);
  const text = buildInspectorNotificationEmailText(payload);

  const { error } = await resend.emails.send({
    from: getResendFromEmail(),
    to: INSPECTOR_NOTIFY_EMAIL,
    subject,
    text,
  });

  if (error) {
    console.error("[inspector-notification-email] resend failed:", error);
    return { ok: false, error: error.message ?? "Email send failed" };
  }

  return { ok: true };
}
