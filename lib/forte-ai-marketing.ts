export const AI_AGENT_KEYS = [
  "manager",
  "scout",
  "qualifier",
  "content",
  "distribution",
  "engagement",
  "sales",
] as const;

export type AiAgentKey = (typeof AI_AGENT_KEYS)[number];

export const AI_AGENT_STATUS_IDS = [
  "idle",
  "active",
  "paused",
  "error",
] as const;

export type AiAgentStatusId = (typeof AI_AGENT_STATUS_IDS)[number];

export const AI_TASK_STATUS_IDS = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AiTaskStatusId = (typeof AI_TASK_STATUS_IDS)[number];

export const AI_APPROVAL_STATUS_IDS = [
  "pending",
  "approved",
  "rejected",
  "executed",
] as const;

export type AiApprovalStatusId = (typeof AI_APPROVAL_STATUS_IDS)[number];

export const AI_ACTION_RISK_LEVELS = [
  "internal",
  "system_change",
  "external",
] as const;

export type AiActionRiskLevel = (typeof AI_ACTION_RISK_LEVELS)[number];

/** External-facing actions — always require human approval before execution. */
export const AI_APPROVAL_REQUIRED_ACTION_TYPES = [
  "publish_content",
  "publish_campaign",
  "send_social_post",
  "send_message",
  "send_whatsapp",
  "send_email",
  "send_proposal",
  "make_commitment",
] as const;

export type AiApprovalRequiredActionType =
  (typeof AI_APPROVAL_REQUIRED_ACTION_TYPES)[number];

/** @deprecated Prefer FORTE_AI_AGENT_DISPLAY_NAMES from forte-ai-display-he in UI. */
export const AI_AGENT_LABELS: Record<AiAgentKey, string> = {
  manager: "מנהל",
  scout: "מאתר",
  qualifier: "מסנן",
  content: "כותב",
  distribution: "מפיץ",
  engagement: "עוקב",
  sales: "מכירות",
};

export const AI_AGENT_STATUS_LABELS: Record<AiAgentStatusId, string> = {
  idle: "ממתין",
  active: "פעיל",
  paused: "מושהה",
  error: "שגיאה",
};

export const AI_TASK_STATUS_LABELS: Record<AiTaskStatusId, string> = {
  pending: "ממתינה",
  running: "בתהליך",
  completed: "הושלמה",
  failed: "נכשלה",
  cancelled: "בוטלה",
};

export const AI_APPROVAL_STATUS_LABELS: Record<AiApprovalStatusId, string> = {
  pending: "ממתין לאישור",
  approved: "אושר",
  rejected: "נדחה",
  executed: "בוצע",
};

export function actionTypeRequiresApproval(actionType: string): boolean {
  const normalized = actionType.trim().toLowerCase();
  return (AI_APPROVAL_REQUIRED_ACTION_TYPES as readonly string[]).includes(
    normalized
  );
}

export function classifyActionRisk(actionType: string): AiActionRiskLevel {
  if (actionTypeRequiresApproval(actionType)) return "external";
  const normalized = actionType.trim().toLowerCase();
  if (
    normalized.startsWith("system_") ||
    normalized.includes("permission") ||
    normalized.includes("config")
  ) {
    return "system_change";
  }
  return "internal";
}

export type AiAgentDto = {
  id: string;
  agentKey: AiAgentKey;
  displayName: string;
  description: string;
  status: AiAgentStatusId;
  updatedAt: string;
};

export type AiTaskDto = {
  id: string;
  agentId: string;
  agentKey: AiAgentKey | null;
  taskType: string;
  title: string;
  description: string;
  status: AiTaskStatusId;
  priority: number;
  leadId: string | null;
  dueAt: string | null;
  updatedAt: string;
};

export type AiActionDto = {
  id: string;
  agentId: string;
  agentKey: AiAgentKey | null;
  taskId: string | null;
  actionType: string;
  riskLevel: AiActionRiskLevel;
  requiresApproval: boolean;
  summary: string;
  createdAt: string;
};

export type AiApprovalDto = {
  id: string;
  actionId: string;
  approvalKind: string;
  status: AiApprovalStatusId;
  approverLabel: string;
  decisionNote: string;
  summary: string;
  agentKey: AiAgentKey | null;
  createdAt: string;
  updatedAt: string;
};

export type ForteAiMarketingSummaryDto = {
  leadsOpen: number;
  contentItems: number;
  campaigns: number;
  interestedLeads: number;
  salesWins: number;
};

export type ForteAiMarketingDashboardDto = {
  agents: AiAgentDto[];
  activeTasks: AiTaskDto[];
  recentActions: AiActionDto[];
  pendingApprovals: AiApprovalDto[];
  summary: ForteAiMarketingSummaryDto;
};
