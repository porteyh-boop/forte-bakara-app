"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ForteV2DangerButton,
  ForteV2Dialog,
  ForteV2DialogOverlay,
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
  deleteScoutCandidate,
  deleteScoutTask,
  executeScoutCandidateCleanup,
  executeScoutTaskCleanup,
  fetchScoutTaskDetail,
  importScoutCandidate,
  listScoutTasks,
  patchScoutCandidateReview,
  previewScoutCandidateCleanup,
  previewScoutTaskCleanup,
  runQualifierOnCandidate,
  runScoutTask,
  type ScoutCandidateCleanupOptions,
  type ScoutTaskCleanupOptions,
} from "@/lib/scout/scout-api";
import {
  createContentOutreachDraft,
  deleteContentOutreachDraft,
} from "@/lib/content/content-api";
import { formatTaskStatusLabel } from "@/lib/forte-ai-display-he";
import {
  CONTENT_CHANNELS,
  CONTENT_CHANNEL_LABELS,
  type ContentChannelId,
} from "@/lib/content/content-types";
import {
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
  const [contentDraftIdById, setContentDraftIdById] = useState<Record<string, string>>({});
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ScoutTaskDto | null>(null);
  const [deleteCandidateTarget, setDeleteCandidateTarget] =
    useState<ScoutLeadCandidateDto | null>(null);
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<{
    candidateId: string;
    draftId: string;
  } | null>(null);
  const [bulkTaskOpen, setBulkTaskOpen] = useState(false);
  const [bulkCandidateOpen, setBulkCandidateOpen] = useState(false);
  const [taskCleanupOpts, setTaskCleanupOpts] = useState<ScoutTaskCleanupOptions>({
    failed: true,
    completed: false,
    emptyStale: false,
  });
  const [candidateCleanupOpts, setCandidateCleanupOpts] =
    useState<ScoutCandidateCleanupOptions>({
      rejected: true,
      unsuitable: false,
      imported: false,
    });
  const [cleanupPreviewCount, setCleanupPreviewCount] = useState(0);

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
    setMessage("משימת איתור נוצרה. לחצו «התחל איתור».");
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
          ? "חיפוש אינטרנט לא מוגדר בשרת (Serper). פנו למנהל המערכת."
          : result.error
      );
      await refreshTasks();
      await loadTaskDetail(selectedTaskId);
      return;
    }
    setMessage(`האיתור הושלם — ${result.candidatesAdded} מועמדים נוספו.`);
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
    } else setMessage(`הועברו ${result.imported} מועמדים ללקוחות פוטנציאליים.`);
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
    setMessage("המועמד הועבר ללקוחות פוטנציאליים.");
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
          ? "סוכן המסנן לא מוגדר במערכת. פנו למנהל המערכת."
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
          ? "הכותב זמין רק למועמדים שאושרו או הועברו ללקוחות פוטנציאליים."
          : result.error === "content_agent_missing"
            ? "סוכן הכותב לא מוגדר במערכת. פנו למנהל המערכת."
            : result.error ?? "יצירת טיוטה נכשלה"
      );
      return;
    }
    setContentDraftById((prev) => ({
      ...prev,
      [candidateId]: result.draft!.draftText,
    }));
    setContentDraftIdById((prev) => ({
      ...prev,
      [candidateId]: result.draft!.id,
    }));
    setMessage("טיוטת הפנייה נוצרה — ניתן לערוך ולהעתיק.");
  }

  async function handleDeleteTaskConfirm() {
    if (!deleteTaskTarget) return;
    const removedId = deleteTaskTarget.id;
    setBusy(true);
    setError(null);
    const result = await deleteScoutTask(removedId);
    setBusy(false);
    if (result.error) {
      setError(
        result.error === "task_running"
          ? "לא ניתן למחוק משימה שנמצאת בתהליך."
          : result.error
      );
      return;
    }
    setDeleteTaskTarget(null);
    setMessage("משימת האיתור נמחקה.");
    if (expandedTaskId === removedId) {
      setExpandedTaskId("");
      setSelectedTaskId("");
      setCandidates([]);
    }
    await refreshTasks();
  }

  async function handleDeleteCandidateConfirm() {
    if (!deleteCandidateTarget) return;
    setBusy(true);
    const id = deleteCandidateTarget.id;
    const result = await deleteScoutCandidate(id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleteCandidateTarget(null);
    setContentDraftById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setContentDraftIdById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setMessage("המועמד הוסר מרשימת האיתור.");
    await loadTaskDetail(selectedTaskId);
    await refreshTasks();
  }

  async function handleDeleteDraftConfirm() {
    if (!deleteDraftTarget) return;
    setBusy(true);
    const { candidateId, draftId } = deleteDraftTarget;
    const result = await deleteContentOutreachDraft(draftId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDeleteDraftTarget(null);
    setContentDraftById((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
    setContentDraftIdById((prev) => {
      const next = { ...prev };
      delete next[candidateId];
      return next;
    });
    setMessage("הטיוטה נמחקה.");
  }

  async function refreshTaskCleanupPreview(opts: ScoutTaskCleanupOptions) {
    const result = await previewScoutTaskCleanup(opts);
    setCleanupPreviewCount(result.count);
  }

  async function refreshCandidateCleanupPreview(opts: ScoutCandidateCleanupOptions) {
    const result = await previewScoutCandidateCleanup(opts);
    setCleanupPreviewCount(result.count);
  }

  async function handleBulkTaskCleanupConfirm() {
    setBusy(true);
    const result = await executeScoutTaskCleanup(taskCleanupOpts);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBulkTaskOpen(false);
    setMessage(`הוסרו ${result.deleted} משימות איתור.`);
    setExpandedTaskId("");
    setSelectedTaskId("");
    setCandidates([]);
    await refreshTasks();
  }

  async function handleBulkCandidateCleanupConfirm() {
    setBusy(true);
    const result = await executeScoutCandidateCleanup(candidateCleanupOpts);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBulkCandidateOpen(false);
    setMessage(`הוסרו ${result.deleted} מועמדים מרשימת האיתור.`);
    await loadTaskDetail(selectedTaskId);
    await refreshTasks();
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
            העבר מאושרים ללקוחות פוטנציאליים
          </ForteV2PrimaryButton>
        </div>

        {detailLoading ? (
          <p className="text-sm text-forte-text-secondary p-3">טוען מועמדים...</p>
        ) : candidates.length === 0 ? (
          <ForteV2EmptyState
            title="אין מועמדים"
            description={`לא נמצאו מועמדים למשימה «${taskTitle}». לחצו «התחל איתור» אם טרם הורצה.`}
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
                        ציון התאמה {c.matchScore}
                      </span>
                      <span className="text-xs text-forte-text-secondary">
                        {SCOUT_REVIEW_STATUS_LABELS[c.reviewStatus]}
                      </span>
                    </div>
                    <p className="text-xs text-forte-text-secondary mt-1">
                      {locationLine(c)}
                    </p>
                    <p className="text-xs text-forte-text-secondary mt-1">
                      <span className="font-medium text-forte-text">סיבת ההתאמה: </span>
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
                    <div className="mt-3 rounded-md border border-forte-border/70 bg-forte-blue-light/20 px-3 py-2 min-w-0">
                      <p className="text-[11px] font-semibold text-forte-text">
                        מסנן — בדיקת התאמה
                      </p>
                      {c.qualifyVerdict ? (
                        <div className="mt-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-forte-text-secondary">
                            <span>התאמה:</span>
                            <ForteV2StatusBadge tone={qualifyTone(c.qualifyVerdict)}>
                              {QUALIFY_VERDICT_LABELS[c.qualifyVerdict]}
                            </ForteV2StatusBadge>
                          </div>
                          <p className="text-xs text-forte-text-secondary whitespace-pre-wrap">
                            {c.qualifyReason}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-forte-text-secondary mt-1">
                          טרם בוצעה בדיקת התאמה.
                        </p>
                      )}
                      <div className="mt-2">
                        <ForteV2SecondaryButton
                          size="sm"
                          disabled={busy || c.reviewStatus === "imported"}
                          onClick={() => void handleRunQualifier(c.id)}
                        >
                          {c.qualifyVerdict ? "בדוק שוב" : "בדוק התאמה"}
                        </ForteV2SecondaryButton>
                      </div>
                    </div>
                    {c.reviewStatus === "approved" || c.reviewStatus === "imported" ? (
                      <div className="mt-3 min-w-0 w-full max-w-full overflow-hidden rounded-md border border-forte-border/70 bg-white px-3 py-2">
                        <p className="text-[11px] font-semibold text-forte-text">
                          כותב — הכנת פנייה
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
                            {contentDraftIdById[c.id] ? (
                              <ForteV2DangerButton
                                outline
                                disabled={busy}
                                onClick={() =>
                                  setDeleteDraftTarget({
                                    candidateId: c.id,
                                    draftId: contentDraftIdById[c.id],
                                  })
                                }
                              >
                                מחק טיוטה
                              </ForteV2DangerButton>
                            ) : null}
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
                    העבר ללקוחות פוטנציאליים
                  </ForteV2PrimaryButton>
                  <ForteV2DangerButton
                    outline
                    disabled={busy}
                    onClick={() => setDeleteCandidateTarget(c)}
                  >
                    מחק מועמד
                  </ForteV2DangerButton>
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
        <h2 className="text-base font-bold text-forte-text">
          מאתר — איתור לקוחות פוטנציאליים
        </h2>
        <p className="text-xs text-forte-text-secondary mt-1 max-w-3xl">
          המערכת מחפשת לקוחות פוטנציאליים ממקורות ציבוריים ושומרת אותם לבדיקה לפני
          העברה למכירות. ללא פנייה אוטומטית ללקוחות.
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
            <ForteV2FormLabel>סוג לקוח</ForteV2FormLabel>
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
            <ForteV2FormLabel>מספר תוצאות</ForteV2FormLabel>
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
            צור משימה
          </ForteV2PrimaryButton>
          <ForteV2SecondaryButton
            disabled={busy || !selectedTaskId}
            onClick={() => void handleRunTask()}
          >
            התחל איתור
          </ForteV2SecondaryButton>
        </div>
      </ForteV2Panel>

      <ForteV2TableCard title="משימות איתור">
        <div className="flex flex-wrap gap-2 px-2 pb-2 border-b border-forte-border/60">
          <ForteV2SecondaryButton
            size="sm"
            disabled={busy}
            onClick={() => {
              setBulkTaskOpen(true);
              void refreshTaskCleanupPreview(taskCleanupOpts);
            }}
          >
            נקה משימות
          </ForteV2SecondaryButton>
          <ForteV2SecondaryButton
            size="sm"
            disabled={busy || !selectedTaskId}
            onClick={() => {
              setBulkCandidateOpen(true);
              void refreshCandidateCleanupPreview(candidateCleanupOpts);
            }}
          >
            נקה מועמדים
          </ForteV2SecondaryButton>
        </div>
        {loading ? (
          <p className="text-sm text-forte-text-secondary p-3">טוען...</p>
        ) : tasks.length === 0 ? (
          <ForteV2EmptyState
            title="אין משימות איתור"
            description="צרו משימה חדשה כדי להתחיל איתור."
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
                          {formatTaskStatusLabel(task.status as AiTaskStatusId)}
                        </ForteV2StatusBadge>
                        {task.status !== "running" ? (
                          <span
                            className="inline-block"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            role="presentation"
                          >
                            <ForteV2DangerButton
                              outline
                              disabled={busy}
                              onClick={() => setDeleteTaskTarget(task)}
                            >
                              מחק משימה
                            </ForteV2DangerButton>
                          </span>
                        ) : null}
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

      {deleteTaskTarget ? (
        <ForteV2DialogOverlay onClose={() => !busy && setDeleteTaskTarget(null)}>
          <ForteV2Dialog
            title="למחוק את משימת האיתור?"
            onClose={() => !busy && setDeleteTaskTarget(null)}
          >
            <div className="space-y-3 text-sm text-forte-text-secondary">
              <p>
                המשימה והמועמדים המשויכים אליה יוסרו ממסך האיתור. לקוחות פוטנציאליים
                שכבר הועברו למערכת המכירות לא יימחקו.
              </p>
              <p className="font-medium text-forte-text">{deleteTaskTarget.title}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <ForteV2DangerButton disabled={busy} onClick={() => void handleDeleteTaskConfirm()}>
                  מחק
                </ForteV2DangerButton>
                <ForteV2SecondaryButton disabled={busy} onClick={() => setDeleteTaskTarget(null)}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {deleteCandidateTarget ? (
        <ForteV2DialogOverlay onClose={() => !busy && setDeleteCandidateTarget(null)}>
          <ForteV2Dialog
            title="למחוק את המועמד?"
            onClose={() => !busy && setDeleteCandidateTarget(null)}
          >
            <div className="space-y-3 text-sm text-forte-text-secondary">
              <p>
                המועמד יוסר מרשימת האיתור. הליד שכבר נוצר במערכת המכירות יישאר.
              </p>
              <p className="font-medium text-forte-text">
                {deleteCandidateTarget.organizationName ||
                  deleteCandidateTarget.buildingName ||
                  "מועמד"}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <ForteV2DangerButton
                  disabled={busy}
                  onClick={() => void handleDeleteCandidateConfirm()}
                >
                  מחק
                </ForteV2DangerButton>
                <ForteV2SecondaryButton
                  disabled={busy}
                  onClick={() => setDeleteCandidateTarget(null)}
                >
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {deleteDraftTarget ? (
        <ForteV2DialogOverlay onClose={() => !busy && setDeleteDraftTarget(null)}>
          <ForteV2Dialog
            title="למחוק את הטיוטה?"
            onClose={() => !busy && setDeleteDraftTarget(null)}
          >
            <div className="space-y-3 text-sm text-forte-text-secondary">
              <p>רק טיוטת הפנייה תימחק. המועמד, סטטוס האישור ובדיקת ההתאמה לא ישתנו.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                <ForteV2DangerButton disabled={busy} onClick={() => void handleDeleteDraftConfirm()}>
                  מחק
                </ForteV2DangerButton>
                <ForteV2SecondaryButton disabled={busy} onClick={() => setDeleteDraftTarget(null)}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {bulkTaskOpen ? (
        <ForteV2DialogOverlay onClose={() => !busy && setBulkTaskOpen(false)}>
          <ForteV2Dialog title="נקה משימות איתור" onClose={() => !busy && setBulkTaskOpen(false)}>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={taskCleanupOpts.failed}
                  onChange={(e) => {
                    const next = { ...taskCleanupOpts, failed: e.target.checked };
                    setTaskCleanupOpts(next);
                    void refreshTaskCleanupPreview(next);
                  }}
                />
                משימות שנכשלו
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={taskCleanupOpts.completed}
                  onChange={(e) => {
                    const next = { ...taskCleanupOpts, completed: e.target.checked };
                    setTaskCleanupOpts(next);
                    void refreshTaskCleanupPreview(next);
                  }}
                />
                משימות שהושלמו
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={taskCleanupOpts.emptyStale}
                  onChange={(e) => {
                    const next = { ...taskCleanupOpts, emptyStale: e.target.checked };
                    setTaskCleanupOpts(next);
                    void refreshTaskCleanupPreview(next);
                  }}
                />
                משימות ישנות ללא מועמדים
              </label>
              <p className="text-forte-text-secondary">
                יימחקו {cleanupPreviewCount} משימות. משימות בתהליך לא יימחקו.
              </p>
              <div className="flex flex-wrap gap-2">
                <ForteV2DangerButton
                  disabled={busy || cleanupPreviewCount === 0}
                  onClick={() => void handleBulkTaskCleanupConfirm()}
                >
                  נקה
                </ForteV2DangerButton>
                <ForteV2SecondaryButton disabled={busy} onClick={() => setBulkTaskOpen(false)}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {bulkCandidateOpen ? (
        <ForteV2DialogOverlay onClose={() => !busy && setBulkCandidateOpen(false)}>
          <ForteV2Dialog title="נקה מועמדים" onClose={() => !busy && setBulkCandidateOpen(false)}>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={candidateCleanupOpts.rejected}
                  onChange={(e) => {
                    const next = { ...candidateCleanupOpts, rejected: e.target.checked };
                    setCandidateCleanupOpts(next);
                    void refreshCandidateCleanupPreview(next);
                  }}
                />
                מועמדים שנדחו
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={candidateCleanupOpts.unsuitable}
                  onChange={(e) => {
                    const next = { ...candidateCleanupOpts, unsuitable: e.target.checked };
                    setCandidateCleanupOpts(next);
                    void refreshCandidateCleanupPreview(next);
                  }}
                />
                מועמדים שסומנו «לא מתאים»
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={candidateCleanupOpts.imported}
                  onChange={(e) => {
                    const next = { ...candidateCleanupOpts, imported: e.target.checked };
                    setCandidateCleanupOpts(next);
                    void refreshCandidateCleanupPreview(next);
                  }}
                />
                מועמדים שכבר הועברו למכירות
              </label>
              <p className="text-forte-text-secondary">
                יימחקו {cleanupPreviewCount} מועמדים מרשימת האיתור. לקוחות פוטנציאליים
                במערכת המכירות יישארו.
              </p>
              <div className="flex flex-wrap gap-2">
                <ForteV2DangerButton
                  disabled={busy || cleanupPreviewCount === 0}
                  onClick={() => void handleBulkCandidateCleanupConfirm()}
                >
                  נקה
                </ForteV2DangerButton>
                <ForteV2SecondaryButton
                  disabled={busy}
                  onClick={() => setBulkCandidateOpen(false)}
                >
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </section>
  );
}
