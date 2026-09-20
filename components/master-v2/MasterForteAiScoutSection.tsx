"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  runQualifierOnCandidate,
  runScoutTask,
} from "@/lib/scout/scout-api";
import { createContentOutreachDraft } from "@/lib/content/content-api";
import {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_LABELS,
  type ContentChannelId,
} from "@/lib/content/content-types";
import {
  AI_TASK_STATUS_LABELS,
  type AiTaskStatusId,
} from "@/lib/forte-ai-marketing";
import {
  QUALIFY_VERDICT_LABELS,
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
  const [expandedTaskId, setExpandedTaskId] = useState<string>("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [candidates, setCandidates] = useState<ScoutLeadCandidateDto[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const expandedPanelRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contentChannelById, setContentChannelById] = useState<
    Record<string, ContentChannelId>
  >({});
  const [contentDraftById, setContentDraftById] = useState<Record<string, string>>({});

  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [targetType, setTargetType] = useState<ScoutCandidateTypeId>("vaad_bayit");
  const [maxResults, setMaxResults] = useState("5");

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

  async function toggleTaskExpand(taskId: string) {
    if (expandedTaskId === taskId) {
      setExpandedTaskId("");
      setSelectedTaskId("");
      setCandidates([]);
      setSelectedIds(new Set());
      return;
    }
    setExpandedTaskId(taskId);
    setSelectedTaskId(taskId);
    setSelectedIds(new Set());
    setDetailLoading(true);
    setError(null);
    await loadTaskDetail(taskId);
    setDetailLoading(false);
    requestAnimationFrame(() => {
      expandedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function selectTask(taskId: string) {
    void toggleTaskExpand(taskId);
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
          ? "חיפוש לא מוגדר — הגדירו SCOUT_WEB_SEARCH_API_KEY (Serper)."
          : result.error
      );
      await refreshTasks();
      await loadTaskDetail(selectedTaskId);
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

  async function handleRunQualifier(candidateId: string) {
    setBusy(true);
    setError(null);
    const result = await runQualifierOnCandidate(candidateId);
    setBusy(false);
    if (result.error) {
      setError(
        result.error === "qualifier_agent_missing"
          ? "סוכן QUALIFIER לא מוגדר — הריצו migration 049."
          : result.error
      );
      return;
    }
    await loadTaskDetail(selectedTaskId);
  }

  function contentChannelFor(candidateId: string): ContentChannelId {
    return contentChannelById[candidateId] ?? "whatsapp";
  }

  async function handleCreateContentDraft(candidateId: string) {
    setBusy(true);
    setError(null);
    const channel = contentChannelFor(candidateId);
    const result = await createContentOutreachDraft({ candidateId, channel });
    setBusy(false);
    if (result.error || !result.draft) {
      setError(
        result.error === "not_approved"
          ? "CONTENT זמין רק למועמדים שאושרו או יובאו."
          : result.error === "content_agent_missing"
            ? "סוכן CONTENT לא מוגדר — הריצו migration 047/050."
            : result.error ?? "יצירת טיוטה נכשלה"
      );
      return;
    }
    setContentDraftById((prev) => ({
      ...prev,
      [candidateId]: result.draft!.draftText,
    }));
    setMessage("טיוטת CONTENT נוצרה — ניתן לערוך ולהעתיק.");
  }

  async function handleCopyContentDraft(candidateId: string) {
    const text = contentDraftById[candidateId];
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setMessage("הטיוטה הועתקה ללוח.");
    } catch {
      setError("העתקה ללוח נכשלה.");
    }
  }

  function qualifyTone(
    verdict: ScoutLeadCandidateDto["qualifyVerdict"]
  ): "success" | "warning" | "danger" | "neutral" {
    if (verdict === "suitable") return "success";
    if (verdict === "review") return "warning";
    if (verdict === "unsuitable") return "danger";
    return "neutral";
  }

  function locationLine(c: ScoutLeadCandidateDto): string {
    const parts = [c.city, c.address, c.buildingName].filter(Boolean);
    return parts.length ? parts.join(" · ") : "—";
  }

  function renderCandidatesBody(taskTitle: string) {
    return (
      <>
        <div className="flex flex-wrap gap-2 p-2 border-b border-forte-border/60 bg-white/80">
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

        {detailLoading ? (
          <p className="text-sm text-forte-text-secondary p-3">טוען מועמדים...</p>
        ) : candidates.length === 0 ? (
          <ForteV2EmptyState
            title="אין מועמדים"
            description={`לא נמצאו מועמדים למשימה «${taskTitle}». הריצו מחקר Serper אם טרם הורצה.`}
          />
        ) : (
          <ul className="space-y-3 p-2 max-h-[32rem] overflow-y-auto overflow-x-hidden">
            {candidates.map((c) => (
              <li
                key={c.id}
                className="min-w-0 max-w-full overflow-x-hidden rounded-lg border border-forte-border p-3 text-sm space-y-2 bg-white"
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
                        {c.organizationName || c.buildingName || "—"}
                      </span>
                      <span className="text-xs rounded-full bg-forte-blue-light px-2 py-0.5">
                        ציון {c.matchScore}
                      </span>
                      <span className="text-xs text-forte-text-secondary">
                        {SCOUT_REVIEW_STATUS_LABELS[c.reviewStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-forte-text-secondary mt-1">
                      {locationLine(c)}
                    </p>
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
                    <div className="mt-3 rounded-md border border-forte-border/70 bg-forte-blue-light/20 px-3 py-2">
                      <p className="text-[11px] font-semibold text-forte-text">QUALIFIER</p>
                      {c.qualifyVerdict ? (
                        <div className="mt-1 space-y-1">
                          <ForteV2StatusBadge tone={qualifyTone(c.qualifyVerdict)}>
                            {QUALIFY_VERDICT_LABELS[c.qualifyVerdict]}
                          </ForteV2StatusBadge>
                          <p className="text-xs text-forte-text-secondary whitespace-pre-wrap">
                            {c.qualifyReason}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-forte-text-secondary mt-1">
                          טרם הורץ סינון QUALIFIER.
                        </p>
                      )}
                      <div className="mt-2">
                        <ForteV2SecondaryButton
                          size="sm"
                          disabled={busy || c.reviewStatus === "imported"}
                          onClick={() => void handleRunQualifier(c.id)}
                        >
                          {c.qualifyVerdict ? "הרץ QUALIFIER שוב" : "הרץ QUALIFIER"}
                        </ForteV2SecondaryButton>
                      </div>
                    </div>
                    {c.reviewStatus === "approved" || c.reviewStatus === "imported" ? (
                      <div className="mt-3 min-w-0 w-full max-w-full overflow-hidden rounded-md border border-forte-border/70 bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-forte-text">
                          CONTENT — הכנת פנייה
                        </p>
                        <p className="text-xs text-forte-text-secondary mt-1">
                          טיוטה בלבד — ללא שליחה מהמערכת.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <ForteV2FormLabel htmlFor={`content-ch-${c.id}`}>
                            <span className="text-xs">ערוץ</span>
                          </ForteV2FormLabel>
                          <select
                            id={`content-ch-${c.id}`}
                            className="text-xs rounded-md border border-forte-border px-2 py-1"
                            value={contentChannelFor(c.id)}
                            disabled={busy}
                            onChange={(e) =>
                              setContentChannelById((prev) => ({
                                ...prev,
                                [c.id]: e.target.value as ContentChannelId,
                              }))
                            }
                          >
                            {CONTENT_CHANNELS.map((ch) => (
                              <option key={ch} value={ch}>
                                {CONTENT_CHANNEL_LABELS[ch]}
                              </option>
                            ))}
                          </select>
                          <ForteV2PrimaryButton
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleCreateContentDraft(c.id)}
                          >
                            צור טיוטה
                          </ForteV2PrimaryButton>
                        </div>
                        {contentDraftById[c.id] ? (
                          <div className="mt-2 min-w-0 w-full max-w-full space-y-2">
                            <textarea
                              dir="rtl"
                              rows={8}
                              spellCheck={false}
                              aria-label="טיוטת פנייה"
                              className="box-border block w-full max-w-full min-w-0 min-h-[180px] resize-y overflow-x-hidden rounded-md border border-forte-border bg-white px-3 py-3 font-sans text-sm leading-6 text-forte-text text-right whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]"
                              value={contentDraftById[c.id]}
                              onChange={(e) =>
                                setContentDraftById((prev) => ({
                                  ...prev,
                                  [c.id]: e.target.value,
                                }))
                              }
                            />
                            <ForteV2SecondaryButton
                              size="sm"
                              onClick={() => void handleCopyContentDraft(c.id)}
                            >
                              העתק
                            </ForteV2SecondaryButton>
                          </div>
                        ) : null}
                      </div>
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
      </>
    );
  }

  return (
    <section className="space-y-4" dir="rtl">
      <ForteV2Panel className="p-4 sm:p-5">
        <h2 className="text-base font-bold text-forte-text">SCOUT — איתור לידים</h2>
        <p className="text-xs text-forte-text-secondary mt-1">
          מחקר ציבורי בלבד (Serper). ללא פנייה ללקוחות. ייבוא ללידים רק לאחר אישורך.
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
            הרץ מחקר (Serper)
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
            {tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              return (
                <li key={task.id} className="py-2 px-2">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    className={`w-full text-right rounded-lg p-2 hover:bg-forte-blue-light/30 transition-colors ${
                      isExpanded ? "bg-forte-blue-light/50 ring-1 ring-forte-border/60" : ""
                    }`}
                    onClick={() => void toggleTaskExpand(task.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-forte-text flex items-center gap-2">
                        <span
                          className="inline-block text-forte-text-secondary transition-transform"
                          aria-hidden
                          style={{
                            transform: isExpanded ? "rotate(-90deg)" : "rotate(90deg)",
                          }}
                        >
                          ◀
                        </span>
                        {task.title}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-forte-primary font-medium">
                          {isExpanded ? "הסתר מועמדים" : "הצג מועמדים"}
                        </span>
                        <ForteV2StatusBadge tone={taskStatusTone(task.status)}>
                          {AI_TASK_STATUS_LABELS[task.status as AiTaskStatusId] ??
                            task.status}
                        </ForteV2StatusBadge>
                      </div>
                    </div>
                    <p className="text-xs text-forte-text-secondary mt-1 pe-6">
                      {SCOUT_CANDIDATE_TYPE_LABELS[task.payload.targetType]} ·{" "}
                      {task.candidateCount} מועמדים
                    </p>
                  </button>

                  {isExpanded ? (
                    <div
                      ref={expandedTaskId === task.id ? expandedPanelRef : undefined}
                      className="mt-2 ms-1 me-1 rounded-lg border border-forte-border/80 bg-forte-blue-light/10 overflow-hidden"
                    >
                      <p className="text-xs font-semibold text-forte-text px-3 py-2 border-b border-forte-border/60">
                        מועמדים — {task.title}
                      </p>
                      {renderCandidatesBody(task.title)}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </ForteV2TableCard>
    </section>
  );
}
