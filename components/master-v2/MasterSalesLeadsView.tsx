"use client";

import { useEffect, useMemo, useState } from "react";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
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
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";
import {
  applySalesLeadDraft,
  createSyntheticSalesLeads,
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
  summarizeSalesLeads,
  type SalesLead,
  type SalesLeadDraft,
  type SalesLeadFilter,
} from "@/lib/sales-leads";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-forte-border bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-forte-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-forte-text">{value}</p>
    </div>
  );
}

export default function MasterSalesLeadsView() {
  const [authed, setAuthed] = useState(false);
  const [leads, setLeads] = useState<SalesLead[]>(() => createSyntheticSalesLeads());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SalesLeadFilter>("הכול");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SalesLeadDraft>(emptySalesLeadDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

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
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setDraft(emptySalesLeadDraft());
    setFormError(null);
  }

  function patchDraft<K extends keyof SalesLeadDraft>(key: K, value: SalesLeadDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (formError) setFormError(null);
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const result = applySalesLeadDraft(draft, editingLead);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setLeads((current) => {
      const index = current.findIndex((lead) => lead.id === result.lead.id);
      if (index === -1) return [result.lead, ...current];
      const next = [...current];
      next[index] = result.lead;
      return next;
    });
    setMessage(
      editingLead
        ? "הכרטיס עודכן בזיכרון בלבד. הרענון יאפס את ההדגמה."
        : "פנייה נוספה בזיכרון בלבד. הרענון יאפס את ההדגמה."
    );
    closeDialog();
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="sales">
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="מכירות ולידים"
          subtitle="תור פניות ראשוני לבדיקת מסך — ללא שמירה בענן"
          actions={
            <ForteV2PrimaryButton onClick={openCreate}>פנייה חדשה</ForteV2PrimaryButton>
          }
        />

        <div className="fv2-workspace-content space-y-4">
          <ForteV2StatusBanner tone="warning">
            תצוגת הדגמה — הנתונים אינם נשמרים בענן. השינויים מתאפסים ברענון.
          </ForteV2StatusBanner>

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

          <ForteV2TableCard title="רשימת לידים" count={visibleLeads.length}>
            {visibleLeads.length === 0 ? (
              <ForteV2EmptyState
                icon="☎"
                title="אין לידים להצגה"
                description="נסו מסנן אחר או פתחו פנייה חדשה. הנתונים סינתטיים בלבד."
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
            <form className="space-y-4" onSubmit={handleSave}>
              {formError ? (
                <ForteV2StatusBanner tone="error">{formError}</ForteV2StatusBanner>
              ) : (
                <ForteV2StatusBanner tone="warning">
                  שמירה בזיכרון בלבד. הרענון יאפס את השינוי.
                </ForteV2StatusBanner>
              )}

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
                    onChange={(e) => patchDraft("serviceType", e.target.value)}
                  >
                    <option value="">לא נבחר</option>
                    {SALES_LEAD_SERVICE_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
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
                    placeholder="ההערה תישמר בהיסטוריה בזיכרון בלבד"
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

              <div className="flex flex-wrap justify-end gap-2">
                <ForteV2SecondaryButton onClick={closeDialog}>ביטול</ForteV2SecondaryButton>
                <ForteV2PrimaryButton type="submit">שמירה בהדגמה</ForteV2PrimaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </MasterShellLayout>
  );
}
