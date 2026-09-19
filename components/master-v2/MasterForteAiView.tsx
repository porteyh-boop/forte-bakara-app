"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
  ForteV2EmptyState,
  ForteV2PageHeader,
  ForteV2Panel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
  ForteV2TableCard,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  AI_AGENT_LABELS,
  AI_AGENT_STATUS_LABELS,
  AI_APPROVAL_STATUS_LABELS,
  AI_TASK_STATUS_LABELS,
  type AiAgentDto,
  type AiAgentKey,
  type ForteAiMarketingDashboardDto,
} from "@/lib/forte-ai-marketing";
import MasterForteAiScoutSection from "@/components/master-v2/MasterForteAiScoutSection";
import {
  fetchForteAiMarketingDashboard,
  patchForteAiApproval,
} from "@/lib/forte-ai-marketing-api";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";

const MARKETING_AGENT_KEYS: AiAgentKey[] = [
  "scout",
  "content",
  "distribution",
  "engagement",
  "sales",
];

function agentStatusTone(
  status: AiAgentDto["status"]
): "success" | "warning" | "danger" | "neutral" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "error") return "danger";
  return "neutral";
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-forte-border bg-white px-4 py-3 shadow-sm min-w-0">
      <p className="text-[11px] text-forte-text-secondary truncate">{label}</p>
      <p className="mt-1 text-xl font-semibold text-forte-text tabular-nums">{value}</p>
    </div>
  );
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function MasterForteAiView() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ForteAiMarketingDashboardDto | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchForteAiMarketingDashboard();
    setDashboard(result.dashboard);
    setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isMasterAuthenticated()) {
        setChecking(false);
        return;
      }
      const ok = await ensureMasterV2SessionsValid();
      if (cancelled) return;
      if (!ok) {
        setMasterAuthenticated(false);
        setAuthed(false);
      } else {
        setAuthed(true);
        await refresh();
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const managerAgent = useMemo(
    () => dashboard?.agents.find((a) => a.agentKey === "manager") ?? null,
    [dashboard]
  );

  const marketingAgents = useMemo(() => {
    if (!dashboard) return [];
    const byKey = new Map(dashboard.agents.map((a) => [a.agentKey, a]));
    return MARKETING_AGENT_KEYS.map((key) => byKey.get(key)).filter(
      Boolean
    ) as AiAgentDto[];
  }, [dashboard]);

  async function handleApproval(
    approvalId: string,
    status: "approved" | "rejected"
  ) {
    setActionId(approvalId);
    const result = await patchForteAiApproval({ approvalId, status });
    setActionId(null);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    await refresh();
  }

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-forte-text-secondary">
        טוען...
      </div>
    );
  }

  if (!authed) {
    return (
      <MasterCodeGate
        onSuccess={() => {
          setAuthed(true);
          void refresh();
        }}
      />
    );
  }

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="forte-ai">
      <div className="space-y-5 pb-8" dir="rtl">
        <ForteV2PageHeader
          title="FORTE AI"
          subtitle="תשתית Multi-Agent לשיווק — ניטור, משימות, תיעוד ואישורים. ללא פרסום או הודעות חיצוניות בשלב זה."
        />

        {loadError ? (
          <ForteV2StatusBanner tone="error">
            {loadError === "load_failed"
              ? "טעינת לוח הבקרה נכשלה. ודאו ש-migration 047 הורץ ב-Supabase."
              : loadError}
          </ForteV2StatusBanner>
        ) : null}

        {loading && !dashboard ? (
          <p className="text-sm text-forte-text-secondary py-8 text-center">
            טוען נתוני AI...
          </p>
        ) : null}

        {dashboard ? (
          <>
            <section>
              <h2 className="text-sm font-bold text-forte-text mb-2">סיכום</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <SummaryCard label="לידים פתוחים" value={dashboard.summary.leadsOpen} />
                <SummaryCard label="פריטי תוכן" value={dashboard.summary.contentItems} />
                <SummaryCard label="קמפיינים" value={dashboard.summary.campaigns} />
                <SummaryCard
                  label="מתעניינים"
                  value={dashboard.summary.interestedLeads}
                />
                <SummaryCard label="מכירות (זכייה)" value={dashboard.summary.salesWins} />
              </div>
            </section>

            {managerAgent ? (
              <ForteV2Panel className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs text-forte-text-secondary">סוכן מנהל</p>
                    <h3 className="text-base font-bold text-forte-text">
                      {managerAgent.displayName}
                    </h3>
                    <p className="text-sm text-forte-text-secondary mt-1 max-w-2xl">
                      {managerAgent.description}
                    </p>
                  </div>
                  <ForteV2StatusBadge tone={agentStatusTone(managerAgent.status)}>
                    {AI_AGENT_STATUS_LABELS[managerAgent.status]}
                  </ForteV2StatusBadge>
                </div>
              </ForteV2Panel>
            ) : null}

            <section>
              <h2 className="text-sm font-bold text-forte-text mb-3">
                סוכני שיווק
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {marketingAgents.map((agent) => (
                  <ForteV2Panel key={agent.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-forte-primary uppercase tracking-wide">
                          {agent.agentKey}
                        </p>
                        <h3 className="text-sm font-bold text-forte-text mt-0.5">
                          {AI_AGENT_LABELS[agent.agentKey]}
                        </h3>
                        <p className="text-xs text-forte-text-secondary mt-2 line-clamp-3">
                          {agent.description}
                        </p>
                      </div>
                      <ForteV2StatusBadge tone={agentStatusTone(agent.status)}>
                        {AI_AGENT_STATUS_LABELS[agent.status]}
                      </ForteV2StatusBadge>
                    </div>
                  </ForteV2Panel>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ForteV2TableCard title="משימות פעילות">
                {dashboard.activeTasks.length === 0 ? (
                  <ForteV2EmptyState
                    title="אין משימות פעילות"
                    description="משימות יופיעו כאשר סוכנים יופעלו בשלבים הבאים."
                  />
                ) : (
                  <ul className="divide-y divide-forte-border/60">
                    {dashboard.activeTasks.map((task) => (
                      <li key={task.id} className="py-3 px-1 text-sm">
                        <p className="font-semibold text-forte-text">{task.title}</p>
                        <p className="text-xs text-forte-text-secondary mt-1">
                          {task.agentKey?.toUpperCase() ?? "—"} ·{" "}
                          {AI_TASK_STATUS_LABELS[task.status]}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ForteV2TableCard>

              <ForteV2TableCard title="פעולות אחרונות">
                {dashboard.recentActions.length === 0 ? (
                  <ForteV2EmptyState
                    title="אין פעולות מתועדות"
                    description="כל פעולת Agent תירשם ב-ai_actions."
                  />
                ) : (
                  <ul className="divide-y divide-forte-border/60 max-h-80 overflow-y-auto">
                    {dashboard.recentActions.map((action) => (
                      <li key={action.id} className="py-3 px-1 text-sm">
                        <p className="font-medium text-forte-text">{action.summary}</p>
                        <p className="text-xs text-forte-text-secondary mt-1">
                          {action.agentKey?.toUpperCase() ?? "—"} ·{" "}
                          {formatDateTime(action.createdAt)}
                          {action.requiresApproval ? " · נדרש אישור" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ForteV2TableCard>
            </div>

            <MasterForteAiScoutSection />

            <ForteV2TableCard title="אישורים הממתינים ליהודה">
              {dashboard.pendingApprovals.length === 0 ? (
                <ForteV2EmptyState
                  title="אין אישורים ממתינים"
                  description="פרסום, הודעות, מיילים והצעות יופיעו כאן לפני ביצוע."
                />
              ) : (
                <ul className="space-y-3">
                  {dashboard.pendingApprovals.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-lg border border-forte-border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-forte-text">
                          {row.summary || row.approvalKind}
                        </p>
                        <p className="text-xs text-forte-text-secondary mt-1">
                          {row.agentKey?.toUpperCase() ?? "—"} ·{" "}
                          {AI_APPROVAL_STATUS_LABELS[row.status]} ·{" "}
                          {row.approverLabel}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        <ForteV2PrimaryButton
                          size="sm"
                          disabled={actionId === row.id}
                          onClick={() => void handleApproval(row.id, "approved")}
                        >
                          אישור
                        </ForteV2PrimaryButton>
                        <ForteV2SecondaryButton
                          size="sm"
                          disabled={actionId === row.id}
                          onClick={() => void handleApproval(row.id, "rejected")}
                        >
                          דחייה
                        </ForteV2SecondaryButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ForteV2TableCard>
          </>
        ) : null}
      </div>
    </MasterShellLayout>
  );
}
