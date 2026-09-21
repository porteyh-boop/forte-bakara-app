import {
  AI_TASK_STATUS_LABELS,
  type AiActionDto,
  type AiAgentKey,
  type AiTaskStatusId,
} from "@/lib/forte-ai-marketing";
import { QUALIFY_VERDICT_LABELS } from "@/lib/qualifier/qualifier-types";

/** User-facing agent names (internal agent_key unchanged). */
export const FORTE_AI_AGENT_DISPLAY_NAMES: Record<AiAgentKey, string> = {
  manager: "מנהל",
  scout: "מאתר",
  qualifier: "מסנן",
  content: "כותב",
  distribution: "מפיץ",
  engagement: "עוקב",
  sales: "מכירות",
};

export const FORTE_AI_AGENT_DESCRIPTIONS_HE: Record<AiAgentKey, string> = {
  manager: "מנהל ומתאם את עבודת הסוכנים",
  scout: "מאתר לקוחות פוטנציאליים ממקורות ציבוריים",
  qualifier: "בוחן את התאמת הלקוח הפוטנציאלי",
  content: "מכין טיוטת פנייה מותאמת",
  distribution: "מנהל את הוצאת הפנייה לאחר אישורך",
  engagement: "מנהל מעקב אחר פניות ותגובות",
  sales: "מנהל את המשך תהליך המכירה",
};

/** Product capability — not DB ai_agents.status (idle/active). */
export const FORTE_AI_AGENT_CAPABILITY_ACTIVE: Record<AiAgentKey, boolean> = {
  manager: false,
  scout: true,
  qualifier: true,
  content: true,
  distribution: false,
  engagement: false,
  sales: false,
};

export const FORTE_AI_AGENT_CAPABILITY_LABELS = {
  active: "פעיל",
  inactive: "טרם הופעל",
} as const;

const AI_ACTION_TYPE_DISPLAY: Record<string, string> = {
  content_draft_created: "נוצרה טיוטת פנייה",
  content_draft_deleted: "טיוטת פנייה נמחקה",
  qualifier_completed: "בדיקת התאמה הושלמה",
  scout_task_created: "נוצרה משימת איתור",
  scout_task_deleted: "משימת איתור נמחקה",
  scout_research_started: "האיתור התחיל",
  scout_research_failed: "האיתור נכשל",
  scout_research_completed: "האיתור הושלם",
  scout_candidate_saved: "נשמר מועמד חדש",
  scout_duplicate_flagged: "מועמד סומן ככפילות",
  scout_candidate_approved: "מועמד אושר",
  scout_candidate_rejected: "מועמד נדחה",
  scout_candidate_deleted: "מועמד הוסר מרשימת האיתור",
  scout_lead_imported: "מועמד הועבר ללקוחות פוטנציאליים",
  scout_cleanup_completed: "ניקוי משימות איתור הושלם",
  scout_candidates_cleanup_completed: "ניקוי מועמדים הושלם",
};

export function formatAgentDisplayName(agentKey: AiAgentKey | null | undefined): string {
  if (!agentKey) return "סוכן";
  return FORTE_AI_AGENT_DISPLAY_NAMES[agentKey] ?? agentKey;
}

export function formatAgentCapabilityLabel(agentKey: AiAgentKey): string {
  return FORTE_AI_AGENT_CAPABILITY_ACTIVE[agentKey]
    ? FORTE_AI_AGENT_CAPABILITY_LABELS.active
    : FORTE_AI_AGENT_CAPABILITY_LABELS.inactive;
}

export function agentCapabilityTone(
  agentKey: AiAgentKey
): "success" | "neutral" {
  return FORTE_AI_AGENT_CAPABILITY_ACTIVE[agentKey] ? "success" : "neutral";
}

/** @deprecated Use formatAgentCapabilityLabel — DB agent status is not shown on marketing cards. */
export function agentUiRolloutLabel(_agentKey: AiAgentKey): string | null {
  return null;
}

function localizeLegacyActionSummary(summary: string): string {
  let text = summary.trim();
  text = text.replace(/^SCOUT:\s*/i, "");
  text = text.replace(/^QUALIFIER:\s*/i, "");
  text = text.replace(/^CONTENT:\s*/i, "");
  text = text.replace(/^SCOUT\s+/i, "");
  for (const [id, label] of Object.entries(QUALIFY_VERDICT_LABELS)) {
    text = text.replace(new RegExp(`\\b${id}\\b`, "g"), label);
  }
  text = text.replace(/\bwhatsapp\b/gi, "WhatsApp");
  text = text.replace(/\bemail\b/gi, "דוא\"ל");
  return text.trim();
}

export function formatRecentActionDisplay(action: AiActionDto): string {
  const agent = formatAgentDisplayName(action.agentKey);
  const typed = AI_ACTION_TYPE_DISPLAY[action.actionType.trim().toLowerCase()];
  if (typed) {
    const extra = localizeLegacyActionSummary(action.summary);
    if (extra && !typed.includes(extra) && extra.length < 120) {
      return `${agent}: ${typed} — ${extra}`;
    }
    return `${agent}: ${typed}`;
  }
  const localized = localizeLegacyActionSummary(action.summary);
  return localized ? `${agent}: ${localized}` : `${agent}: פעולה מתועדת`;
}

export function formatTaskStatusLabel(status: string): string {
  const id = status as AiTaskStatusId;
  if (id in AI_TASK_STATUS_LABELS) {
    return AI_TASK_STATUS_LABELS[id];
  }
  return status;
}
