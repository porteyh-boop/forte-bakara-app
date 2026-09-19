"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ForteV2EmptyState,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2Panel,
  ForteV2PrimaryButton,
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
  ForteV2TableCard,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import {
  bulkImportScoutCandidates,
  bulkScoutCandidateReview,
  createScoutTask,
  fetchScoutTaskDetail,
  importScoutCandidate,
  listScoutTasks,
  patchScoutCandidateReview,
  runScoutTask,
} from "@/lib/scout/scout-api";
import {
  AI_TASK_STATUS_LABELS,
  type AiTaskStatusId,
} from "@/lib/forte-ai-marketing";
import {
  SCOUT_CANDIDATE_TYPES,
  SCOUT_CANDIDATE_TYPE_LABELS,
  SCOUT_REVIEW_STATUS_LABELS,
  type ScoutCandidateTypeId,
  type ScoutLeadCandidateDto,
  type ScoutTaskDto,
} from "@/lib/scout/scout-types";

function taskStatusTone(
  status: string
): "success" | "warning" | "danger" | "neutral" {
  if (status === "completed") return "success";
  if (status === "running") return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export default function MasterForteAiScoutSection() {
  const [tasks, setTasks] = useState<ScoutTaskDto[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [candidates, setCandidates] = useState<ScoutLeadCandidateDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [targetType, setTargetType] = useState<ScoutCandidateTypeId>("vaad_bayit");
  const [maxResults, setMaxResults] = useState("5");

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const refreshTasks = useCallback(async () => {
    const result = await listScoutTasks();
    setTasks(result.tasks);
    if (result.error) setError(result.error);
  }, []);

  const loadTaskDetail = useCallback(async (taskId: string) => {
    if (!taskId) {
      setCandidates([]);
      return;
    }
    const result = await fetchScoutTaskDetail(taskId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCandidates(result.task?.candidates ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refreshTasks();
      setLoading(false);
    })();
  }, [refreshTasks]);

  function selectTask(taskId: string) {
    setSelectedTaskId(taskId);
    void loadTaskDetail(taskId);
  }

  async function handleCreateTask() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await createScoutTask({
      city: city.trim(),
      region: region.trim(),
      targetType,
      maxResults: Number(maxResults) || 5,
    });
    setBusy(false);
    if (result.error || !result.task) {
      setError(result.error ?? "יצירת משימה נכשלה");
      return;
    }
    setMessage("משימת SCOUT נוצרה. לחצו «הרץ מחקר».");
    await refreshTasks();
    selectTask(result.task.id);
  }

  async function handleRunTask() {
    if (!selectedTaskId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await runScoutTask(selectedTaskId);
    setBusy(false);
    if (result.error) {
      setError(
        result.error === "search_unconfigured"
          ? "חיפוש לא מוגדר — הגדירו SCOUT_WEB_SEARCH_API_KEY (Tavily)."
          : result.error
      );
      return;
    }
    setMessage(`המחקר הושלם — ${result.candidatesAdded} מועמדים נוספו.`);
    await refreshTasks();
    await loadTaskDetail(selectedTaskId);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkReview(status: "approved" | "rejected") {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBusy(true);
    const result = await bulkScoutCandidateReview({ candidateIds: ids, reviewStatus: status });
    setBusy(false);
    if (result.error) setError(result.error);
    else setMessage(`עודכנו ${result.updated} מועמדים.`);
    setSelectedIds(new Set());
    await loadTaskDetail(selectedTaskId);
  }

  async function handleBulkImport() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBusy(true);
    const result = await bulkImportScoutCandidates(ids);
    setBusy(false);
    if (result.error) {
      setError(
        result.error === "duplicate_blocked"
          ? "לא ניתן לייבא מועמד עם כפילות — אשרו רק מועמדים ללא כפילות."
          : result.error
      );
    } else setMessage(`יובאו ${result.imported} מועמדים ללידים.`);
    setSelectedIds(new Set());
    await loadTaskDetail(selectedTaskId);
  }

  async function handleSingleImport(candidate: ScoutLeadCandidateDto) {
    setBusy(true);
    const result = await importScoutCandidate(candidate.id);
    setBusy(false);
    if (result.error) {
      setError(
        result.error === "duplicate_blocked"
          ? "מועמד עם כפילות — לא ייובא."
          : result.error === "invalid_status"
            ? "יש לאשר את המועמד לפני ייבוא."
            : result.error
      );
      return;
    }
    setMessage("המועמד יובא ל-sales_leads.");
    await loadTaskDetail(selectedTaskId);
  }

  return (
    <section className="space-y-4" dir="rtl">
      <ForteV2Panel className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-forte-text">SCOUT — איתור לידים</h2>
        <p className="text-xs text-forte-text-secondary mt-1">
          מחקר ציבורי בלבד (Tavily). ללא פנייה ללקוחות. ייבוא ללידים רק לאחר אישורך.
        </p>

        {error ? (
          <div className="mt-3">
            <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner>
          </div>
        ) : null}
        {message ? (
          <div className="mt-3">
            <ForteV2StatusBanner tone="info">{message}</ForteV2StatusBanner>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <label className="block space-y-1">
            <ForteV2FormLabel>עיר *</ForteV2FormLabel>
            <ForteV2FormInput value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <ForteV2FormLabel>אזור (אופציונלי)</ForteV2FormLabel>
            <ForteV2FormInput value={region} onChange={(e) => setRegion(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <ForteV2FormLabel>סוג יעד</ForteV2FormLabel>
            <select
              className="form-input text-sm py-2 w-full"
              value={targetType}
              onChange={(e) =>
                setTargetType(e.target.value as ScoutCandidateTypeId)
              }
            >
              {SCOUT_CANDIDATE_TYPES.map((id) => (
                <option key={id} value={id}>
                  {SCOUT_CANDIDATE_TYPE_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <ForteV2FormLabel>מספר תוצאות (1–15)</ForteV2FormLabel>
            <ForteV2FormInput
              type="number"
              min={1}
              max={15}
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <ForteV2PrimaryButton disabled={busy || !city.trim()} onClick={() => void handleCreateTask()}>
            צור משימת איתור
          </ForteV2PrimaryButton>
          <ForteV2SecondaryButton
            disabled={busy || !selectedTaskId}
            onClick={() => void handleRunTask()}
          >
            הרץ מחקר (Tavily)
          </ForteV2SecondaryButton>
        </div>
      </ForteV2Panel>

      <ForteV2TableCard title="משימות SCOUT">
        {loading ? (
          <p className="text-sm text-forte-text-secondary p-3">טוען...</p>
        ) : tasks.length === 0 ? (
          <ForteV2EmptyState
            title="אין משימות SCOUT"
            description="צרו משימה חדשה כדי להתחיל מחקר."
          />
        ) : (
          <ul className="divide-y divide-forte-border/60">
            {tasks.map((task) => (
              <li key={task.id} className="py-3 px-2">
                <button
                  type="button"
                  className={`w-full text-right rounded-lg p-2 hover:bg-forte-blue-light/30 ${
                    selectedTaskId === task.id ? "bg-forte-blue-light/50" : ""
                  }`}
                  onClick={() => selectTask(task.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-forte-text">
                      {task.title}
                    </span>
                    <ForteV2StatusBadge tone={taskStatusTone(task.status)}>
                      {AI_TASK_STATUS_LABELS[task.status as AiTaskStatusId] ??
                        task.status}
                    </ForteV2StatusBadge>
                  </div>
                  <p className="text-xs text-forte-text-secondary mt-1">
                    {SCOUT_CANDIDATE_TYPE_LABELS[task.payload.targetType]} ·{" "}
                    {task.candidateCount} מועמדים
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ForteV2TableCard>

      {selectedTask ? (
        <ForteV2TableCard title={`מועמדים — ${selectedTask.title}`}>
          <div className="flex flex-wrap gap-2 p-2 border-b border-forte-border/60">
            <ForteV2SecondaryButton
              size="sm"
              disabled={busy || selectedIds.size === 0}
              onClick={() => void handleBulkReview("approved")}
            >
              אשר נבחרים
            </ForteV2SecondaryButton>
            <ForteV2SecondaryButton
              size="sm"
              disabled={busy || selectedIds.size === 0}
              onClick={() => void handleBulkReview("rejected")}
            >
              דחה נבחרים
            </ForteV2SecondaryButton>
            <ForteV2PrimaryButton
              size="sm"
              disabled={busy || selectedIds.size === 0}
              onClick={() => void handleBulkImport()}
            >
              ייבא מאושרים ללידים
            </ForteV2PrimaryButton>
          </div>

          {candidates.length === 0 ? (
            <ForteV2EmptyState
              title="אין מועמדים"
              description="הריצו מחקר Tavily למשימה זו."
            />
          ) : (
            <ul className="space-y-3 p-2 max-h-[32rem] overflow-y-auto">
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-forte-border p-3 text-sm space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      aria-label="בחר מועמד"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-forte-text">
                          {c.organizationName || "—"}
                        </span>
                        <span className="text-xs rounded-full bg-forte-blue-light px-2 py-0.5">
                          ציון {c.matchScore}
                        </span>
                        <span className="text-xs text-forte-text-secondary">
                          {SCOUT_REVIEW_STATUS_LABELS[c.reviewStatus]}
                        </span>
                      </div>
                      <p className="text-xs text-forte-text-secondary mt-1">
                        {c.scoreRationale}
                      </p>
                      {c.duplicateLeadId ? (
                        <p className="text-xs text-amber-900 mt-1">
                          כפילות: {c.duplicateMatchReason}
                        </p>
                      ) : null}
                      <p className="text-xs mt-2 whitespace-pre-wrap line-clamp-4">
                        {c.publicNotes}
                      </p>
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-forte-primary underline break-all mt-1 inline-block"
                      >
                        מקור: {c.sourceTitle || c.sourceUrl}
                      </a>
                      {c.phone ? (
                        <p className="text-xs text-forte-text-secondary">
                          טלפון (מהמקור): {c.phone}
                        </p>
                      ) : null}
                      {c.email ? (
                        <p className="text-xs text-forte-text-secondary">
                          דוא&quot;ל (מהמקור): {c.email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <ForteV2SecondaryButton
                      size="sm"
                      disabled={busy || c.reviewStatus === "imported"}
                      onClick={() =>
                        void patchScoutCandidateReview({
                          candidateId: c.id,
                          reviewStatus: "approved",
                        }).then(() => loadTaskDetail(selectedTaskId))
                      }
                    >
                      אשר
                    </ForteV2SecondaryButton>
                    <ForteV2SecondaryButton
                      size="sm"
                      disabled={busy || c.reviewStatus === "imported"}
                      onClick={() =>
                        void patchScoutCandidateReview({
                          candidateId: c.id,
                          reviewStatus: "rejected",
                        }).then(() => loadTaskDetail(selectedTaskId))
                      }
                    >
                      דחה
                    </ForteV2SecondaryButton>
                    <ForteV2PrimaryButton
                      size="sm"
                      disabled={
                        busy ||
                        c.reviewStatus !== "approved" ||
                        Boolean(c.duplicateLeadId)
                      }
                      onClick={() => void handleSingleImport(c)}
                    >
                      ייבא ללידים
                    </ForteV2PrimaryButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ForteV2TableCard>
      ) : null}
    </section>
  );
}
