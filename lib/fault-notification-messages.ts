import type { FaultNotificationDispatchInput } from "./fault-notifications";
import { FAULT_NOTIFICATION_EVENT_LABELS } from "./fault-notifications";
import { buildMasterProjectV2FaultPath } from "./master-project-v2-routes";

function formatHebrewDate(iso: string | undefined): string {
  if (!iso) {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  }
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatFaultSource(source: string | null | undefined): string | null {
  if (!source?.trim()) return "דיווח ישיר";
  return source.trim();
}

function buildMasterLink(
  input: FaultNotificationDispatchInput,
  origin?: string | null
): string | null {
  if (!input.faultId || !input.buildingId) return null;
  const path = buildMasterProjectV2FaultPath(input.buildingId, input.faultId);
  if (origin?.trim()) return `${origin.replace(/\/$/, "")}${path}`;
  return path;
}

function baseLines(input: FaultNotificationDispatchInput): string[] {
  return [
    `מספר תקלה: ${input.ticketNumber}`,
    `בניין: ${input.buildingName}`,
    `מעלית: ${input.elevatorName}`,
  ];
}

export function buildFaultNotificationTelegramMessage(
  input: FaultNotificationDispatchInput,
  options?: { origin?: string | null }
): string {
  const masterLink = buildMasterLink(input, options?.origin);

  switch (input.eventType) {
    case "FAULT_CREATED": {
      const lines = [
        "🚨 תקלה חדשה",
        ...baseLines(input),
        input.faultType ? `סוג תקלה: ${input.faultType}` : null,
        `תיאור: ${input.description}`,
        `תאריך פתיחה: ${formatHebrewDate(input.createdAt)}`,
        formatFaultSource(input.faultSource)
          ? `מקור: ${formatFaultSource(input.faultSource)}`
          : null,
        input.isDisabled ? "⚠️ מעלית מושבתת" : null,
        input.hasImage ? "📷 יש תמונה מצורפת במערכת" : null,
        masterLink ? `פתח ב-FORTE: ${masterLink}` : null,
      ];
      return lines.filter((line): line is string => Boolean(line)).join("\n");
    }
    case "FAULT_TREATMENT_STARTED": {
      const lines = [
        "🔧 תקלה הועברה לטיפול",
        ...baseLines(input),
        input.treatmentNote?.trim()
          ? `הערת טיפול: ${input.treatmentNote.trim()}`
          : null,
        masterLink ? `פתח ב-FORTE: ${masterLink}` : null,
      ];
      return lines.filter((line): line is string => Boolean(line)).join("\n");
    }
    case "FAULT_TREATMENT_UPDATED": {
      const lines = [
        "📝 עדכון הערת טיפול",
        ...baseLines(input),
        input.treatmentNote?.trim()
          ? `הערת טיפול: ${input.treatmentNote.trim()}`
          : "הערת טיפול עודכנה",
        masterLink ? `פתח ב-FORTE: ${masterLink}` : null,
      ];
      return lines.filter((line): line is string => Boolean(line)).join("\n");
    }
    case "FAULT_CLOSED": {
      const lines = [
        "✅ תקלה נסגרה",
        ...baseLines(input),
        input.closureNote?.trim()
          ? `סיכום סגירה: ${input.closureNote.trim()}`
          : null,
        masterLink ? `פתח ב-FORTE: ${masterLink}` : null,
      ];
      return lines.filter((line): line is string => Boolean(line)).join("\n");
    }
    case "FAULT_REOPENED": {
      const lines = [
        "🔄 תקלה נפתחה מחדש",
        ...baseLines(input),
        input.status ? `סטטוס: ${input.status}` : null,
        masterLink ? `פתח ב-FORTE: ${masterLink}` : null,
      ];
      return lines.filter((line): line is string => Boolean(line)).join("\n");
    }
    default:
      return `${FAULT_NOTIFICATION_EVENT_LABELS[input.eventType]}\n${baseLines(input).join("\n")}`;
  }
}

/** Legacy-compatible FAULT_CREATED body (original lines preserved). */
export function buildLegacyPilotFaultTelegramMessage(input: {
  ticketNumber: string;
  buildingName: string;
  elevatorName: string;
  description: string;
  createdAt: string;
}): string {
  return [
    "🚨 תקלה חדשה",
    `מספר תקלה: ${input.ticketNumber}`,
    `בניין: ${input.buildingName}`,
    `מעלית: ${input.elevatorName}`,
    `תיאור: ${input.description}`,
    `תאריך פתיחה: ${formatHebrewDate(input.createdAt)}`,
  ].join("\n");
}
