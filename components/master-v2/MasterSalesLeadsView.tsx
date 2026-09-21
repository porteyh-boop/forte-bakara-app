"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import { useMasterSalesLeadNotifications } from "@/components/master-v2/MasterSalesLeadNotificationsProvider";
import MasterSalesLeadTrialPortalSection from "@/components/master-v2/MasterSalesLeadTrialPortalSection";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
  ForteV2DangerButton,
  ForteV2DataTable,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2EmptyState,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PageHeader,
  ForteV2PrimaryButton,
  ForteV2SearchField,
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
  ForteV2TableCard,
  ForteV2ToolbarCard,
  ForteV2ToolbarRow,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { parseSalesLeadIdParam } from "@/lib/sales-lead-notifications";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";
import {
  salesWinMissingFieldLabel,
  type SalesWinMissingField,
} from "@/lib/sales-lead-ops";
import {
  isDigitalFormSalesLead,
  PUBLIC_SALES_LEAD_FORM_BADGE,
} from "@/lib/sales-lead-public-form";
import {
  createSalesLead,
  deleteSalesLead,
  executeSalesLeadCleanup,
  listSalesLeads,
  previewSalesLeadCleanup,
  updateSalesLead,
  type SalesLeadCleanupOptions,
} from "@/lib/sales-leads-api";
import { SERVICE_TYPE_OTHER } from "@/lib/service-type";
import {
  emptySalesLeadDraft,
  filterSalesLeads,
  formatSalesLeadDate,
  jerusalemCalendarDate,
  salesLeadStatusTone,
  salesLeadToDraft,
  SALES_LEAD_CHANNELS,
  SALES_LEAD_FILTERS,
  SALES_LEAD_SERVICE_TYPES,
  SALES_LEAD_SOURCES,
  SALES_LEAD_STATUSES,
  isSalesLeadDeletableForUi,
  salesLeadDeleteBlockedMessage,
  summarizeSalesLeads,
  type SalesLead,
  type SalesLeadDraft,
  type SalesLeadFilter,
} from "@/lib/sales-leads";

const EMPTY_CLEANUP_OPTS: SalesLeadCleanupOptions = {
  closedNotWon: false,
  newUnconverted: false,
  staleInactive: false,
};

function leadDisplayName(lead: SalesLead): string {
  const client = lead.clientName.trim();
  const building = lead.buildingName.trim();
  if (client && building) return `${client} · ${building}`;
  return client || building || "ליד";
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-forte-border bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-forte-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-forte-text">{value}</p>
    </div>
  );
}

export default function MasterSalesLeadsView({
  initialLeadId = "",
}: {
  initialLeadId?: string;
}) {
  const searchParams = useSearchParams();
  const salesNotifications = useMasterSalesLeadNotifications();
  const openedLeadIdRef = useRef<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SalesLeadFilter>("הכול");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SalesLeadDraft>(emptySalesLeadDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [winMissing, setWinMissing] = useState<SalesWinMissingField[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalesLead | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [bulkCleanupOpen, setBulkCleanupOpen] = useState(false);
  const [cleanupOpts, setCleanupOpts] =
    useState<SalesLeadCleanupOptions>(EMPTY_CLEANUP_OPTS);
  const [cleanupPreview, setCleanupPreview] = useState<{
    count: number;
    sampleNames: string[];
  }>({ count: 0, sampleNames: [] });
  const [cleanupBusy, setCleanupBusy] = useState(false);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listSalesLeads();
    setLeads(result.leads);
    if (result.error) setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) void refresh();
  }, [authed, refresh]);

  useEffect(() => {
    if (!authed || loading) return;
    const fromQuery = parseSalesLeadIdParam(searchParams.get("leadId"));
    const leadId = fromQuery ?? parseSalesLeadIdParam(initialLeadId);
    if (!leadId || openedLeadIdRef.current === leadId) return;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;
    openedLeadIdRef.current = leadId;
    openLead(lead);
  }, [authed, loading, leads, initialLeadId, searchParams]);

  const today = jerusalemCalendarDate();
  const summary = useMemo(() => summarizeSalesLeads(leads, today), [leads, today]);
  const visibleLeads = useMemo(
    () => filterSalesLeads(leads, filter, today, search),
    [leads, filter, today, search]
  );
  const editingLead = editingId
    ? leads.find((lead) => lead.id === editingId) ?? null
    : null;

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  function openCreate() {
    setEditingId(null);
    setDraft(emptySalesLeadDraft());
    setFormError(null);
    setDialogOpen(true);
  }

  function openLead(lead: SalesLead) {
    setEditingId(lead.id);
    setDraft(salesLeadToDraft(lead));
    setFormError(null);
    setDialogOpen(true);
    void salesNotifications?.markLeadRead(lead.id);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setDraft(emptySalesLeadDraft());
    setFormError(null);
    setWinMissing(null);
  }

  function openProjectCard(buildingId: string) {
    window.location.assign(buildMasterProjectV2Path(buildingId));
  }

  function upsertLead(next: SalesLead) {
    setLeads((current) => {
      const index = current.findIndex((lead) => lead.id === next.id);
      if (index === -1) return [next, ...current];
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
  }

  function patchDraft<K extends keyof SalesLeadDraft>(key: K, value: SalesLeadDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (formError) setFormError(null);
  }

  async function persistDraft(nextDraft: SalesLeadDraft): Promise<boolean> {
    if (saving) return false;
    setSaving(true);
    setFormError(null);
    const result = editingId
      ? await updateSalesLead(editingId, nextDraft)
      : await createSalesLead(nextDraft);
    setSaving(false);
    if (result.error || !result.lead) {
      setFormError(result.error ?? "השמירה נכשלה. נסו שוב.");
      return false;
    }

    upsertLead(result.lead);
    setEditingId(result.lead.id);
    setDraft({ ...salesLeadToDraft(result.lead), note: "" });

    if (result.projectConversion?.required) {
      setWinMissing(result.projectConversion.missing);
      setDialogOpen(false);
      return true;
    }

    setWinMissing(null);
    if (result.openedProject) {
      closeDialog();
      openProjectCard(result.openedProject.buildingId);
      return true;
    }

    setMessage(editingLead ? "הכרטיס עודכן." : "הפנייה נשמרה.");
    closeDialog();
    return true;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    await persistDraft(draft);
  }

  async function handleWinCompletion(event: React.FormEvent) {
    event.preventDefault();
    await persistDraft(draft);
  }

  const refreshCleanupPreview = useCallback(async (opts: SalesLeadCleanupOptions) => {
    const any =
      opts.closedNotWon || opts.newUnconverted || opts.staleInactive;
    if (!any) {
      setCleanupPreview({ count: 0, sampleNames: [] });
      return;
    }
    const result = await previewSalesLeadCleanup(opts);
    if (result.error) {
      setError(result.error);
      setCleanupPreview({ count: 0, sampleNames: [] });
      return;
    }
    setCleanupPreview({ count: result.count, sampleNames: result.sampleNames });
  }, []);

  function openBulkCleanup() {
    setCleanupOpts(EMPTY_CLEANUP_OPTS);
    setCleanupPreview({ count: 0, sampleNames: [] });
    setBulkCleanupOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleteBusy) return;
    if (!isSalesLeadDeletableForUi(deleteTarget)) return;
    setDeleteBusy(true);
    const result = await deleteSalesLead(deleteTarget.id);
    setDeleteBusy(false);
    if (!result.deleted || result.error) {
      setFormError(result.error ?? "מחיקת הליד נכשלה.");
      return;
    }
    setLeads((current) => current.filter((lead) => lead.id !== deleteTarget.id));
    if (editingId === deleteTarget.id) closeDialog();
    setDeleteTarget(null);
    setMessage("הליד הוסר מרשימת המכירות.");
  }

  async function handleBulkCleanupConfirm() {
    if (cleanupBusy) return;
    const any =
      cleanupOpts.closedNotWon ||
      cleanupOpts.newUnconverted ||
      cleanupOpts.staleInactive;
    if (!any || cleanupPreview.count === 0) return;
    setCleanupBusy(true);
    const result = await executeSalesLeadCleanup(cleanupOpts);
    setCleanupBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBulkCleanupOpen(false);
    setMessage(`הוסרו ${result.deleted} לידים.`);
    await refresh();
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="sales">
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="מכירות ולידים"
          subtitle="תור פניות ומעקב מכירות"
          actions={
            <div className="flex flex-wrap gap-2">
              <ForteV2SecondaryButton onClick={openBulkCleanup}>
                נקה לידים
              </ForteV2SecondaryButton>
              <ForteV2PrimaryButton onClick={openCreate}>פנייה חדשה</ForteV2PrimaryButton>
            </div>
          }
        />

        <div className="fv2-workspace-content space-y-4">
          {error ? (
            <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner>
          ) : null}

          {message ? (
            <ForteV2StatusBanner tone="info">{message}</ForteV2StatusBanner>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <KpiCard label="פניות חדשות" value={summary.newLeads} />
            <KpiCard label="מעקבים להיום" value={summary.followUpsToday} />
            <KpiCard label="מעקבים באיחור" value={summary.overdueFollowUps} />
            <KpiCard label="הצעות שממתינות לתשובה" value={summary.pendingProposals} />
          </div>

          <ForteV2ToolbarCard>
            <ForteV2ToolbarRow>
              <ForteV2SearchField
                value={search}
                onChange={setSearch}
                placeholder="חיפוש לפי לקוח, בניין, איש קשר או סוג שירות..."
              />
              <div className="flex flex-wrap gap-2">
                {SALES_LEAD_FILTERS.map((option) => (
                  <ForteV2SecondaryButton
                    key={option}
                    size="sm"
                    onClick={() => setFilter(option)}
                  >
                    <span
                      className={
                        filter === option ? "font-semibold text-forte-primary" : ""
                      }
                    >
                      {option}
                    </span>
                  </ForteV2SecondaryButton>
                ))}
              </div>
            </ForteV2ToolbarRow>
          </ForteV2ToolbarCard>

          <ForteV2TableCard
            title="רשימת לידים"
            count={loading ? undefined : visibleLeads.length}
          >
            {loading ? (
              <p className="text-sm text-forte-text-secondary py-10 text-center">
                טוען לידים...
              </p>
            ) : visibleLeads.length === 0 ? (
              <ForteV2EmptyState
                icon="☎"
                title="אין לידים להצגה"
                description={
                  leads.length === 0
                    ? "עדיין אין פניות. פתחו פנייה חדשה כדי להתחיל."
                    : "נסו מסנן אחר או פתחו פנייה חדשה."
                }
                actions={
                  <ForteV2PrimaryButton onClick={openCreate}>
                    פנייה חדשה
                  </ForteV2PrimaryButton>
                }
              />
            ) : (
              <ForteV2DataTable>
                <thead>
                  <tr>
                    <th className="w-10 fv2-card-hide-mobile" aria-hidden="true" />
                    <th>לקוח / בניין</th>
                    <th>איש קשר</th>
                    <th>סוג שירות</th>
                    <th>סטטוס</th>
                    <th>פעולה הבאה</th>
                    <th>תאריך מעקב</th>
                    <th className="w-24">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="fv2-row-clickable"
                      onClick={() => openLead(lead)}
                    >
                      <td className="text-forte-text-secondary/60 text-center fv2-card-hide-mobile">
                        ›
                      </td>
                      <td className="fv2-card-primary" data-label="לקוח / בניין">
                        <span className="fv2-cell-name">{lead.clientName}</span>
                        <span className="block text-xs text-forte-text-secondary">
                          {lead.buildingName || "ללא בניין"}
                        </span>
                        {isDigitalFormSalesLead(lead) ? (
                          <span className="mt-1 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800">
                            {PUBLIC_SALES_LEAD_FORM_BADGE}
                          </span>
                        ) : null}
                        {lead.convertedBuildingId ? (
                          <span
                            className="mt-1 flex flex-wrap items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <span className="text-xs text-emerald-700">נפתח פרויקט</span>
                            <ForteV2SecondaryButton
                              size="sm"
                              onClick={() => openProjectCard(lead.convertedBuildingId!)}
                            >
                              פתח כרטיס
                            </ForteV2SecondaryButton>
                          </span>
                        ) : null}
                      </td>
                      <td className="text-forte-text/85" data-label="איש קשר">
                        {lead.contactName || "—"}
                      </td>
                      <td className="text-forte-text/85" data-label="סוג שירות">
                        {lead.serviceType || "—"}
                      </td>
                      <td data-label="סטטוס">
                        <ForteV2StatusBadge tone={salesLeadStatusTone(lead.status)}>
                          {lead.status}
                        </ForteV2StatusBadge>
                      </td>
                      <td className="text-forte-text/85" data-label="פעולה הבאה">
                        {lead.nextAction || "—"}
                      </td>
                      <td className="text-forte-text/85" data-label="תאריך מעקב">
                        {formatSalesLeadDate(lead.followUpDate)}
                      </td>
                      <td data-label="פעולות" onClick={(event) => event.stopPropagation()}>
                        <ForteV2DangerButton onClick={() => setDeleteTarget(lead)}>
                          מחק
                        </ForteV2DangerButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ForteV2DataTable>
            )}
          </ForteV2TableCard>
        </div>
      </div>

      {dialogOpen ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog
            title={editingLead ? "כרטיס פנייה" : "פנייה חדשה"}
            onClose={closeDialog}
            size="xl"
          >
            {editingLead ? (
              <MasterSalesLeadTrialPortalSection
                lead={editingLead}
                onLeadUpdated={(updated) => {
                  upsertLead(updated);
                  if (editingId === updated.id) {
                    setDraft(salesLeadToDraft(updated));
                  }
                }}
                onMessage={setMessage}
              />
            ) : null}

            <form className="space-y-4" onSubmit={(event) => void handleSave(event)}>
              {formError ? (
                <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>
              ) : null}

              {editingLead && isDigitalFormSalesLead(editingLead) ? (
                <p className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  {PUBLIC_SALES_LEAD_FORM_BADGE}
                </p>
              ) : null}

              {editingLead?.convertedBuildingId ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-forte-border bg-forte-background/60 px-3 py-2">
                  <p className="text-sm text-forte-text">נפתח פרויקט</p>
                  <ForteV2SecondaryButton
                    size="sm"
                    onClick={() => openProjectCard(editingLead.convertedBuildingId!)}
                  >
                    פתח כרטיס
                  </ForteV2SecondaryButton>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>שם לקוח *</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.clientName}
                    onChange={(e) => patchDraft("clientName", e.target.value)}
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>בניין</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.buildingName}
                    onChange={(e) => patchDraft("buildingName", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>עיר</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.city}
                    onChange={(e) => patchDraft("city", e.target.value)}
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>כתובת</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.address}
                    onChange={(e) => patchDraft("address", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>איש קשר</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.contactName}
                    onChange={(e) => patchDraft("contactName", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>טלפון</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.phone}
                    onChange={(e) => patchDraft("phone", e.target.value)}
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>דוא״ל</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="email"
                    value={draft.email}
                    onChange={(e) => patchDraft("email", e.target.value)}
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>תיאור הצורך</ForteV2FormLabel>
                  <textarea
                    className="fv2-input w-full min-h-[88px]"
                    value={draft.needDescription}
                    onChange={(e) => patchDraft("needDescription", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>סוג שירות</ForteV2FormLabel>
                  <select
                    className="fv2-input w-full"
                    value={draft.serviceType}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDraft((current) => ({
                        ...current,
                        serviceType: next,
                        serviceTypeOther:
                          next === SERVICE_TYPE_OTHER ? current.serviceTypeOther : "",
                      }));
                      if (formError) setFormError(null);
                    }}
                  >
                    <option value="">לא נבחר</option>
                    {SALES_LEAD_SERVICE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.serviceType === SERVICE_TYPE_OTHER ? (
                  <label className="block space-y-1">
                    <ForteV2FormLabel>הגדר סוג שירות אחר *</ForteV2FormLabel>
                    <ForteV2FormInput
                      value={draft.serviceTypeOther}
                      onChange={(e) => patchDraft("serviceTypeOther", e.target.value)}
                      placeholder="לדוגמה: בדיקת נזק למעלית"
                    />
                  </label>
                ) : null}
                <label className="block space-y-1">
                  <ForteV2FormLabel>סטטוס</ForteV2FormLabel>
                  <select
                    className="fv2-input w-full"
                    value={draft.status}
                    onChange={(e) =>
                      patchDraft("status", e.target.value as SalesLeadDraft["status"])
                    }
                  >
                    {SALES_LEAD_STATUSES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>מקור פנייה</ForteV2FormLabel>
                  <select
                    className="fv2-input w-full"
                    value={draft.source}
                    onChange={(e) => patchDraft("source", e.target.value)}
                  >
                    <option value="">לא נבחר</option>
                    {SALES_LEAD_SOURCES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>פירוט מקור</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.sourceDetail}
                    onChange={(e) => patchDraft("sourceDetail", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>ערוץ קשר</ForteV2FormLabel>
                  <select
                    className="fv2-input w-full"
                    value={draft.contactChannel}
                    onChange={(e) => patchDraft("contactChannel", e.target.value)}
                  >
                    <option value="">לא נבחר</option>
                    {SALES_LEAD_CHANNELS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>שווי משוער</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="number"
                    min="0"
                    value={draft.estimatedValue}
                    onChange={(e) => patchDraft("estimatedValue", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>פעולה הבאה</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.nextAction}
                    onChange={(e) => patchDraft("nextAction", e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>תאריך מעקב</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="date"
                    value={draft.followUpDate}
                    onChange={(e) => patchDraft("followUpDate", e.target.value)}
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>הערת מעקב</ForteV2FormLabel>
                  <textarea
                    className="fv2-input w-full min-h-[72px]"
                    value={draft.note}
                    onChange={(e) => patchDraft("note", e.target.value)}
                    placeholder="ההערה תישמר בהיסטוריה"
                  />
                </label>
              </div>

              {editingLead ? (
                <section className="space-y-2">
                  <h4 className="text-sm font-semibold text-forte-text">
                    היסטוריית הערות ושינויי סטטוס
                  </h4>
                  <ul className="space-y-2 max-h-40 overflow-auto">
                    {editingLead.history.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-lg border border-forte-border bg-forte-background/60 px-3 py-2 text-sm"
                      >
                        <p className="text-[11px] text-forte-text-secondary">
                          {new Date(entry.at).toLocaleString("he-IL", {
                            timeZone: "Asia/Jerusalem",
                          })}
                          {entry.status ? ` · ${entry.status}` : ""}
                        </p>
                        <p className="text-forte-text">{entry.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="flex flex-wrap justify-between gap-2">
                {editingLead && isSalesLeadDeletableForUi(editingLead) ? (
                  <ForteV2DangerButton
                    type="button"
                    disabled={saving}
                    onClick={() => setDeleteTarget(editingLead)}
                  >
                    מחק
                  </ForteV2DangerButton>
                ) : (
                  <span />
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <ForteV2SecondaryButton onClick={closeDialog} disabled={saving}>
                    ביטול
                  </ForteV2SecondaryButton>
                  <ForteV2PrimaryButton type="submit" disabled={saving}>
                    {saving ? "שומר..." : "שמירה"}
                  </ForteV2PrimaryButton>
                </div>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {deleteTarget ? (
        <ForteV2DialogOverlay onClose={() => !deleteBusy && setDeleteTarget(null)}>
          <ForteV2Dialog
            title="למחוק את הליד?"
            onClose={() => !deleteBusy && setDeleteTarget(null)}
          >
            <div className="space-y-3 text-sm text-forte-text">
              <p className="font-medium">{leadDisplayName(deleteTarget)}</p>
              {isSalesLeadDeletableForUi(deleteTarget) ? (
                <>
                  <p className="text-forte-text-secondary">
                    הליד יימחק מרשימת המכירות. פעולה זו אינה ניתנת לביטול.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <ForteV2DangerButton disabled={deleteBusy} onClick={() => void handleDeleteConfirm()}>
                      {deleteBusy ? "מוחק..." : "מחק"}
                    </ForteV2DangerButton>
                    <ForteV2SecondaryButton
                      disabled={deleteBusy}
                      onClick={() => setDeleteTarget(null)}
                    >
                      ביטול
                    </ForteV2SecondaryButton>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-forte-text-secondary">
                    {salesLeadDeleteBlockedMessage(deleteTarget)}
                  </p>
                  <ForteV2SecondaryButton onClick={() => setDeleteTarget(null)}>
                    סגור
                  </ForteV2SecondaryButton>
                </>
              )}
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {bulkCleanupOpen ? (
        <ForteV2DialogOverlay onClose={() => !cleanupBusy && setBulkCleanupOpen(false)}>
          <ForteV2Dialog
            title="נקה לידים"
            onClose={() => !cleanupBusy && setBulkCleanupOpen(false)}
          >
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cleanupOpts.closedNotWon}
                  onChange={(e) => {
                    const next = { ...cleanupOpts, closedNotWon: e.target.checked };
                    setCleanupOpts(next);
                    void refreshCleanupPreview(next);
                  }}
                />
                לידים בסטטוס «לא נסגר»
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cleanupOpts.newUnconverted}
                  onChange={(e) => {
                    const next = { ...cleanupOpts, newUnconverted: e.target.checked };
                    setCleanupOpts(next);
                    void refreshCleanupPreview(next);
                  }}
                />
                לידים חדשים שלא הומרו לעבודה
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cleanupOpts.staleInactive}
                  onChange={(e) => {
                    const next = { ...cleanupOpts, staleInactive: e.target.checked };
                    setCleanupOpts(next);
                    void refreshCleanupPreview(next);
                  }}
                />
                לידים ללא עדכון מעל 90 יום (שאינם מקושרים לעבודה)
              </label>
              <p className="text-forte-text-secondary">
                {cleanupPreview.count === 0
                  ? "בחרו לפחות קטגוריה אחת כדי לראות כמה לידים יימחקו."
                  : `יימחקו ${cleanupPreview.count} לידים.`}
              </p>
              {cleanupPreview.sampleNames.length > 0 ? (
                <ul className="list-disc pr-5 text-forte-text-secondary max-h-32 overflow-auto">
                  {cleanupPreview.sampleNames.map((name, index) => (
                    <li key={`${name}-${index}`}>{name}</li>
                  ))}
                  {cleanupPreview.count > cleanupPreview.sampleNames.length ? (
                    <li>…</li>
                  ) : null}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ForteV2DangerButton
                  disabled={cleanupBusy || cleanupPreview.count === 0}
                  onClick={() => void handleBulkCleanupConfirm()}
                >
                  {cleanupBusy ? "מנקה..." : "נקה"}
                </ForteV2DangerButton>
                <ForteV2SecondaryButton
                  disabled={cleanupBusy}
                  onClick={() => setBulkCleanupOpen(false)}
                >
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {winMissing ? (
        <ForteV2DialogOverlay onClose={() => setWinMissing(null)}>
          <ForteV2Dialog
            title="השלמת פרטים לפרויקט"
            onClose={() => setWinMissing(null)}
            size="md"
          >
            <form className="space-y-4" onSubmit={(event) => void handleWinCompletion(event)}>
              <p className="text-sm text-forte-text-secondary">
                חסר מידע לפתיחת כרטיס הפרויקט. מלאו את השדות הבאים ושמרו.
              </p>
              {formError ? (
                <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>
              ) : null}
              {winMissing.includes("buildingName") ? (
                <label className="block space-y-1">
                  <ForteV2FormLabel>שם בניין *</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={draft.buildingName}
                    onChange={(e) => patchDraft("buildingName", e.target.value)}
                    required
                    autoFocus
                  />
                </label>
              ) : null}
              <p className="text-xs text-forte-text-secondary">
                נדרש: {winMissing.map(salesWinMissingFieldLabel).join(", ")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <ForteV2SecondaryButton
                  onClick={() => setWinMissing(null)}
                  disabled={saving}
                >
                  ביטול
                </ForteV2SecondaryButton>
                <ForteV2PrimaryButton type="submit" disabled={saving}>
                  {saving ? "שומר..." : "שמירה ופתיחת כרטיס"}
                </ForteV2PrimaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </MasterShellLayout>
  );
}
