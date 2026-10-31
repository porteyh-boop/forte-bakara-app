"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
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
  ForteV2SecondaryButton,
  ForteV2StatusBadge,
  ForteV2StatusBanner,
  ForteV2TableCard,
  MasterProjectV2Workspace,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { CollectionForecastScreenData } from "@/lib/collection-forecasts-cloud";
import {
  createCollectionForecast,
  deleteCollectionForecast,
  fetchCollectionForecastMonth,
  linkCollectionForecastPayment,
  moveCollectionForecastToNextMonth,
  unlinkCollectionForecastPayment,
  updateCollectionForecast,
} from "@/lib/collection-forecasts-cloud";
import {
  COLLECTION_FORECAST_STATUSES,
  buildForecastScreenRows,
  canDeleteCollectionForecast,
  canMoveCollectionForecast,
  collectionForecastStatusLabel,
  collectionForecastStatusTone,
  computeMonthlyForecastSummary,
  currentForecastMonth,
  defaultExpectedCollectionDate,
  describePlannedBalanceExcess,
  forecastClientLabel,
  forecastMonthInputValue,
  forecastProjectNumberLabel,
  formatForecastDisplayDate,
  formatForecastMonthLabel,
  paymentsAvailableToLink,
  plannedExceedsBalanceMessage,
  shiftForecastMonth,
  suggestedPlannedAmount,
  type CollectionForecastStatus,
  type ForecastScreenRow,
} from "@/lib/collection-forecasts";
import { formatMoney, parsePositiveMoneyInput } from "@/lib/project-financial";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";

type EditorDialog = {
  kind: "editor";
  mode: "create" | "edit";
  buildingId: string;
  forecastId: string | null;
  projectName: string;
  openBalance: number;
  plannedAmount: string;
  expectedCollectionDate: string;
  status: CollectionForecastStatus;
  notes: string;
  acknowledgeExcess: boolean;
};

type ActiveDialog =
  | EditorDialog
  | { kind: "actions"; rowKey: string }
  | { kind: "remove"; forecastId: string; projectName: string }
  | { kind: "move"; forecastId: string; projectName: string }
  | { kind: "link"; forecastId: string; buildingId: string; paymentId: string };

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-forte-border bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] text-forte-text-secondary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-forte-text">{value}</p>
      {hint ? (
        <p className="mt-2 text-[11px] leading-relaxed text-forte-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}

function emptySummary() {
  return {
    plannedTotal: 0,
    collectedTotal: 0,
    remainingTotal: 0,
    overdueTotal: 0,
    clientCount: 0,
  };
}

function subscribeMasterAuth() {
  return () => {};
}

function getServerMasterAuth() {
  return false;
}

export default function MasterCollectionForecastView() {
  const storedAuthed = useSyncExternalStore(
    subscribeMasterAuth,
    isMasterAuthenticated,
    getServerMasterAuth
  );
  const [authedOverride, setAuthedOverride] = useState<boolean | null>(null);
  const authed = authedOverride ?? storedAuthed;

  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => currentForecastMonth());
  const [screen, setScreen] = useState<CollectionForecastScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!cancelled && !ok) setAuthedOverride(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    void (async () => {
      const result = await fetchCollectionForecastMonth(month);
      if (cancelled) return;
      setLoading(false);
      if (result.error || !result.screen) {
        setError(result.error ?? "לא ניתן לטעון את תחזית הגבייה.");
        return;
      }
      setError(null);
      setScreen(result.screen);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, month]);

  const rows = useMemo(() => {
    if (!screen) return [];
    return buildForecastScreenRows({
      projects: screen.projects,
      forecasts: screen.forecasts,
      payments: screen.payments,
    });
  }, [screen]);

  const summary = useMemo(() => {
    if (!screen) return emptySummary();
    return computeMonthlyForecastSummary({
      forecasts: screen.forecasts,
      payments: screen.payments,
      today,
    });
  }, [screen, today]);

  function selectMonth(next: string) {
    setLoading(true);
    setNotice(null);
    setScreen(null);
    setMonth(next);
  }

  async function reloadMonth() {
    setLoading(true);
    const result = await fetchCollectionForecastMonth(month);
    setLoading(false);
    if (result.error || !result.screen) {
      setError(result.error ?? "לא ניתן לטעון את תחזית הגבייה.");
      return;
    }
    setError(null);
    setScreen(result.screen);
  }

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthedOverride(false);
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setDialogError(null);
  }

  function rowByKey(rowKey: string): ForecastScreenRow | null {
    return rows.find((row) => row.key === rowKey) ?? null;
  }

  function openCreate(row: ForecastScreenRow) {
    const existingPlanned = (screen?.forecasts ?? [])
      .filter((forecast) => forecast.buildingId === row.project.buildingId)
      .reduce((sum, forecast) => sum + forecast.plannedAmount, 0);
    const suggested = suggestedPlannedAmount(row.project.balance, existingPlanned);
    setDialogError(null);
    setDialog({
      kind: "editor",
      mode: "create",
      buildingId: row.project.buildingId,
      forecastId: null,
      projectName: row.project.projectName,
      openBalance: row.project.balance,
      plannedAmount: suggested == null ? "" : String(suggested),
      expectedCollectionDate: defaultExpectedCollectionDate(
        month,
        row.project.nextPaymentDate,
        today
      ),
      status: "planned",
      notes: "",
      acknowledgeExcess: false,
    });
  }

  function openEdit(row: ForecastScreenRow) {
    if (!row.forecast) return;
    setDialogError(null);
    setDialog({
      kind: "editor",
      mode: "edit",
      buildingId: row.project.buildingId,
      forecastId: row.forecast.id,
      projectName: row.project.projectName,
      openBalance: row.project.balance,
      plannedAmount: String(row.forecast.plannedAmount),
      expectedCollectionDate: row.forecast.expectedCollectionDate,
      status: row.forecast.status,
      notes: row.forecast.notes ?? "",
      acknowledgeExcess: false,
    });
  }

  async function refreshAfter(message: string) {
    setNotice(message);
    setDialog(null);
    setDialogError(null);
    await reloadMonth();
  }

  async function handleSaveEditor() {
    if (!dialog || dialog.kind !== "editor") return;
    const plannedAmount = parsePositiveMoneyInput(dialog.plannedAmount);
    if (plannedAmount == null) {
      setDialogError("הזינו סכום מתוכנן גדול מאפס.");
      return;
    }
    if (!dialog.expectedCollectionDate) {
      setDialogError("בחרו תאריך גבייה משוער.");
      return;
    }
    const excess = describePlannedBalanceExcess(plannedAmount, dialog.openBalance);
    if (excess.exceeds && !dialog.acknowledgeExcess) {
      setDialogError(plannedExceedsBalanceMessage(excess.openBalance, excess.excess));
      return;
    }

    setBusy(true);
    setDialogError(null);
    const result =
      dialog.mode === "create"
        ? await createCollectionForecast({
            buildingId: dialog.buildingId,
            forecastMonth: month,
            plannedAmount,
            expectedCollectionDate: dialog.expectedCollectionDate,
            status: dialog.status,
            notes: dialog.notes,
            confirmExceedsBalance: dialog.acknowledgeExcess,
          })
        : await updateCollectionForecast(dialog.forecastId ?? "", {
            plannedAmount,
            expectedCollectionDate: dialog.expectedCollectionDate,
            status: dialog.status,
            notes: dialog.notes,
            confirmExceedsBalance: dialog.acknowledgeExcess,
          });
    setBusy(false);

    if (result.error || !result.forecast) {
      setDialogError(result.error ?? "שמירת התחזית נכשלה.");
      return;
    }
    await refreshAfter(dialog.mode === "create" ? "התחזית נוספה." : "התחזית עודכנה.");
  }

  async function handleRemove(forecastId: string) {
    setBusy(true);
    setDialogError(null);
    const result = await deleteCollectionForecast(forecastId);
    setBusy(false);
    if (result.error) {
      setDialogError(result.error);
      return;
    }
    await refreshAfter("התחזית הוסרה. תשלומים בפועל לא שונו.");
  }

  async function handleMove(forecastId: string) {
    setBusy(true);
    setDialogError(null);
    const result = await moveCollectionForecastToNextMonth(forecastId);
    setBusy(false);
    if (result.error) {
      setDialogError(result.error);
      return;
    }
    await refreshAfter("התחזית הועברה לחודש הבא, יחד עם תאריך הגבייה המשוער.");
  }

  async function handleLink(forecastId: string, paymentId: string) {
    setBusy(true);
    setDialogError(null);
    const result = await linkCollectionForecastPayment(forecastId, paymentId);
    setBusy(false);
    if (result.error || !result.forecast) {
      setDialogError(result.error ?? "קישור התשלום נכשל.");
      return;
    }
    await refreshAfter("התחזית קושרה לתשלום קיים. התשלום עצמו לא שונה.");
  }

  async function handleUnlink(forecastId: string) {
    setBusy(true);
    setDialogError(null);
    const result = await unlinkCollectionForecastPayment(forecastId);
    setBusy(false);
    if (result.error || !result.forecast) {
      setDialogError(result.error ?? "ביטול הקישור נכשל.");
      return;
    }
    await refreshAfter("הקישור בוטל. התשלום בפועל נשאר במערכת.");
  }

  function handleIncludeChange(row: ForecastScreenRow, checked: boolean) {
    if (!row.forecast) {
      if (checked) openCreate(row);
      return;
    }
    if (checked) return;
    if (!canDeleteCollectionForecast(row.forecast)) {
      setError("אי אפשר להסיר תחזית שמקושרת לתשלום בפועל. בטלו קודם את הקישור.");
      return;
    }
    setError(null);
    setDialogError(null);
    setDialog({
      kind: "remove",
      forecastId: row.forecast.id,
      projectName: row.project.projectName,
    });
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthedOverride(true)} />;
  }

  const monthLabel = formatForecastMonthLabel(month);
  const editor = dialog?.kind === "editor" ? dialog : null;
  const editorExcess =
    editor && parsePositiveMoneyInput(editor.plannedAmount)
      ? describePlannedBalanceExcess(
          parsePositiveMoneyInput(editor.plannedAmount) ?? 0,
          editor.openBalance
        )
      : null;
  const actionRow = dialog?.kind === "actions" ? rowByKey(dialog.rowKey) : null;
  const linkDialog = dialog?.kind === "link" ? dialog : null;
  const linkChoices = linkDialog
    ? paymentsAvailableToLink(
        screen?.payments ?? [],
        screen?.forecasts ?? [],
        linkDialog.buildingId,
        linkDialog.forecastId
      )
    : [];

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="collection-forecast">
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="תחזית גבייה"
          subtitle="תכנון גבייה חודשי. התחזית אינה תשלום בפועל ואינה משנה את יתרת הפרויקט."
        />

        <div className="fv2-workspace-content">
          <MasterProjectV2Workspace data-workspace="collection-forecast">
            <div className="space-y-4">
              <div className="fv2-toolbar-card">
                <div className="flex flex-wrap items-center gap-2">
                  <ForteV2SecondaryButton
                    size="sm"
                    onClick={() => {
                      const previous = shiftForecastMonth(month, -1);
                      if (previous) selectMonth(previous);
                    }}
                  >
                    חודש קודם
                  </ForteV2SecondaryButton>
                  <p className="min-w-28 text-center text-sm font-semibold text-forte-text">
                    {monthLabel}
                  </p>
                  <label className="block space-y-1">
                    <ForteV2FormLabel>חודש</ForteV2FormLabel>
                    <ForteV2FormInput
                      type="month"
                      value={forecastMonthInputValue(month)}
                      onChange={(event) => {
                        const next = event.target.value
                          ? `${event.target.value}-01`
                          : "";
                        if (/^\d{4}-\d{2}-01$/.test(next)) selectMonth(next);
                      }}
                    />
                  </label>
                  <ForteV2SecondaryButton
                    size="sm"
                    onClick={() => {
                      const next = shiftForecastMonth(month, 1);
                      if (next) selectMonth(next);
                    }}
                  >
                    חודש הבא
                  </ForteV2SecondaryButton>
                </div>
              </div>

              {error ? <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner> : null}
              {notice ? <ForteV2StatusBanner tone="success">{notice}</ForteV2StatusBanner> : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiCard label="סך הגבייה המתוכננת" value={formatMoney(summary.plannedTotal)} />
                <KpiCard
                  label="שנגבה בפועל"
                  value={formatMoney(summary.collectedTotal)}
                  hint="סכום התשלומים הקיימים שמקושרים לתחזיות החודש."
                />
                <KpiCard label="יתרה צפויה לגבייה" value={formatMoney(summary.remainingTotal)} />
                <KpiCard
                  label="מועד גבייה שחלף"
                  value={formatMoney(summary.overdueTotal)}
                  hint="תחזיות שמועדן עבר, לא שולמו במלואן ולא סומנו כנדחות."
                />
                <KpiCard
                  label="לקוחות לגבייה"
                  value={String(summary.clientCount)}
                  hint="פרויקטים ייחודיים שיש להם תחזית בחודש."
                />
              </div>

              <ForteV2TableCard title={`תחזית ${monthLabel}`} count={rows.length}>
                {loading && rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-forte-text-secondary">
                    טוען נתונים...
                  </div>
                ) : rows.length === 0 ? (
                  <ForteV2EmptyState
                    icon="📅"
                    title="אין תחזית לחודש זה"
                    description="אין פרויקטים פעילים עם יתרה פתוחה או תחזית שמורה לחודש שנבחר."
                  />
                ) : (
                  <ForteV2DataTable className="fv2-forecast-table">
                    <thead>
                      <tr>
                        <th>בתחזית</th>
                        <th>פרויקט</th>
                        <th>מספר פרויקט</th>
                        <th>לקוח</th>
                        <th className="text-left" dir="ltr">סכום הזמנה</th>
                        <th className="text-left" dir="ltr">שולם בפועל</th>
                        <th className="text-left" dir="ltr">יתרה פתוחה</th>
                        <th className="text-left" dir="ltr">סכום מתוכנן</th>
                        <th>תאריך גבייה</th>
                        <th>סטטוס תחזית</th>
                        <th>הערה</th>
                        <th>תשלום מקושר</th>
                        <th>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const included = Boolean(row.forecast);
                        return (
                          <tr key={row.key}>
                            <td data-label="בתחזית">
                              <input
                                type="checkbox"
                                checked={included}
                                aria-label={`כלול את ${row.project.projectName} בתחזית`}
                                onChange={(event) =>
                                  handleIncludeChange(row, event.target.checked)
                                }
                              />
                            </td>
                            <td className="fv2-card-primary" data-label="פרויקט">
                              <div className="font-medium text-forte-text">
                                {row.project.projectName}
                              </div>
                            </td>
                            <td data-label="מספר פרויקט">
                              {forecastProjectNumberLabel(row.project.projectNumber)}
                            </td>
                            <td data-label="לקוח">
                              {forecastClientLabel(
                                row.project.contactName,
                                row.project.managementCompany
                              )}
                            </td>
                            <td className="text-left font-mono text-sm" dir="ltr" data-label="סכום הזמנה">
                              {formatMoney(row.project.orderAmount)}
                            </td>
                            <td className="text-left font-mono text-sm" dir="ltr" data-label="שולם בפועל">
                              {formatMoney(row.project.paidTotal)}
                            </td>
                            <td className="text-left font-mono text-sm" dir="ltr" data-label="יתרה פתוחה">
                              <div>{formatMoney(row.project.balance)}</div>
                              {row.project.creditBalance > 0 ? (
                                <div className="text-xs text-forte-text-secondary">
                                  יתרת זכות {formatMoney(row.project.creditBalance)}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-left font-mono text-sm" dir="ltr" data-label="סכום מתוכנן">
                              {row.forecast ? formatMoney(row.forecast.plannedAmount) : "—"}
                            </td>
                            <td data-label="תאריך גבייה">
                              {formatForecastDisplayDate(row.forecast?.expectedCollectionDate)}
                            </td>
                            <td data-label="סטטוס תחזית">
                              {row.forecast ? (
                                <ForteV2StatusBadge
                                  tone={collectionForecastStatusTone(row.forecast.status)}
                                >
                                  {collectionForecastStatusLabel(row.forecast.status)}
                                </ForteV2StatusBadge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td data-label="הערה">
                              <span className="block max-w-[16rem] whitespace-normal break-words">
                                {row.forecast?.notes?.trim() || "—"}
                              </span>
                            </td>
                            <td data-label="תשלום מקושר">
                              {row.linkedPayment
                                ? `${formatMoney(row.linkedPayment.amount)} · ${formatForecastDisplayDate(row.linkedPayment.paymentDate)}`
                                : "—"}
                            </td>
                            <td data-label="פעולות">
                              {row.forecast ? (
                                <ForteV2SecondaryButton
                                  size="sm"
                                  onClick={() => {
                                    setDialogError(null);
                                    setDialog({ kind: "actions", rowKey: row.key });
                                  }}
                                >
                                  פעולות
                                </ForteV2SecondaryButton>
                              ) : (
                                <ForteV2PrimaryButton size="sm" onClick={() => openCreate(row)}>
                                  כלול בתחזית
                                </ForteV2PrimaryButton>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </ForteV2DataTable>
                )}
              </ForteV2TableCard>
            </div>
          </MasterProjectV2Workspace>
        </div>
      </div>

      {editor ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog
            title={editor.mode === "create" ? "הוספה לתחזית" : "עריכת תחזית"}
            onClose={closeDialog}
            size="lg"
          >
            <div className="space-y-3 text-sm">
              <p className="font-medium text-forte-text">{editor.projectName}</p>
              <p className="text-forte-text-secondary">
                יתרה פתוחה: {formatMoney(editor.openBalance)}. שמירה אינה רושמת תשלום.
              </p>
              <label className="block space-y-1">
                <ForteV2FormLabel>סכום מתוכנן לגבייה</ForteV2FormLabel>
                <ForteV2FormInput
                  inputMode="decimal"
                  value={editor.plannedAmount}
                  onChange={(event) =>
                    setDialog({
                      ...editor,
                      plannedAmount: event.target.value,
                      acknowledgeExcess: false,
                    })
                  }
                />
              </label>
              <label className="block space-y-1">
                <ForteV2FormLabel>תאריך גבייה משוער</ForteV2FormLabel>
                <ForteV2FormInput
                  type="date"
                  value={editor.expectedCollectionDate}
                  onChange={(event) =>
                    setDialog({ ...editor, expectedCollectionDate: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <ForteV2FormLabel>סטטוס תחזית</ForteV2FormLabel>
                <select
                  className="fv2-input w-full"
                  value={editor.status}
                  onChange={(event) =>
                    setDialog({
                      ...editor,
                      status: event.target.value as CollectionForecastStatus,
                    })
                  }
                >
                  {COLLECTION_FORECAST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {collectionForecastStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <ForteV2FormLabel>הערה</ForteV2FormLabel>
                <textarea
                  className="fv2-input w-full"
                  rows={3}
                  value={editor.notes}
                  onChange={(event) => setDialog({ ...editor, notes: event.target.value })}
                />
              </label>
              {editorExcess?.exceeds ? (
                <ForteV2StatusBanner tone="warning">
                  <span>
                    {plannedExceedsBalanceMessage(editorExcess.openBalance, editorExcess.excess)}
                  </span>
                  <label className="mt-2 flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={editor.acknowledgeExcess}
                      onChange={(event) =>
                        setDialog({ ...editor, acknowledgeExcess: event.target.checked })
                      }
                    />
                    <span>אני מאשר לשמור סכום גבוה מהיתרה הפתוחה.</span>
                  </label>
                </ForteV2StatusBanner>
              ) : null}
              {dialogError ? (
                <ForteV2StatusBanner tone="error">{dialogError}</ForteV2StatusBanner>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <ForteV2PrimaryButton
                  disabled={busy || Boolean(editorExcess?.exceeds && !editor.acknowledgeExcess)}
                  onClick={() => void handleSaveEditor()}
                >
                  שמירה
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton disabled={busy} onClick={closeDialog}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {actionRow?.forecast ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog title="פעולות תחזית" onClose={closeDialog}>
            <div className="space-y-3 text-sm">
              <p className="font-medium text-forte-text">{actionRow.project.projectName}</p>
              <div className="flex flex-wrap gap-2">
                <ForteV2SecondaryButton size="sm" onClick={() => openEdit(actionRow)}>
                  עריכה
                </ForteV2SecondaryButton>
                <ForteV2SecondaryButton size="sm" onClick={() => openCreate(actionRow)}>
                  פיצול למועד נוסף
                </ForteV2SecondaryButton>
                <ForteV2SecondaryButton
                  size="sm"
                  disabled={!canMoveCollectionForecast(actionRow.forecast)}
                  onClick={() => {
                    if (!actionRow.forecast) return;
                    setDialogError(null);
                    setDialog({
                      kind: "move",
                      forecastId: actionRow.forecast.id,
                      projectName: actionRow.project.projectName,
                    });
                  }}
                >
                  העברה לחודש הבא
                </ForteV2SecondaryButton>
                <ForteV2SecondaryButton
                  size="sm"
                  onClick={() => {
                    if (!actionRow.forecast) return;
                    setDialogError(null);
                    setDialog({
                      kind: "link",
                      forecastId: actionRow.forecast.id,
                      buildingId: actionRow.project.buildingId,
                      paymentId: actionRow.forecast.linkedPaymentId ?? "",
                    });
                  }}
                >
                  קישור לתשלום
                </ForteV2SecondaryButton>
                <ForteV2DangerButton
                  outline
                  disabled={!canDeleteCollectionForecast(actionRow.forecast)}
                  onClick={() => {
                    if (!actionRow.forecast) return;
                    setDialogError(null);
                    setDialog({
                      kind: "remove",
                      forecastId: actionRow.forecast.id,
                      projectName: actionRow.project.projectName,
                    });
                  }}
                >
                  הסרה מהתחזית
                </ForteV2DangerButton>
              </div>
              {!canDeleteCollectionForecast(actionRow.forecast) ? (
                <p className="text-forte-text-secondary">
                  תחזית שמקושרת לתשלום אי אפשר למחוק או להעביר. אפשר לבטל את הקישור בלי למחוק את
                  התשלום.
                </p>
              ) : null}
              {dialogError ? (
                <ForteV2StatusBanner tone="error">{dialogError}</ForteV2StatusBanner>
              ) : null}
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {dialog?.kind === "remove" ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog title="הסרה מהתחזית" onClose={closeDialog}>
            <div className="space-y-3 text-sm">
              <p>
                להסיר את תחזית הגבייה של {dialog.projectName}? תשלום שהתקבל לא יימחק ולא ישתנה.
              </p>
              {dialogError ? (
                <ForteV2StatusBanner tone="error">{dialogError}</ForteV2StatusBanner>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ForteV2DangerButton
                  disabled={busy}
                  onClick={() => void handleRemove(dialog.forecastId)}
                >
                  הסרה
                </ForteV2DangerButton>
                <ForteV2SecondaryButton disabled={busy} onClick={closeDialog}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {dialog?.kind === "move" ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog title="העברה לחודש הבא" onClose={closeDialog}>
            <div className="space-y-3 text-sm">
              <p>
                תחזית {dialog.projectName} תועבר לחודש הבא, ותאריך הגבייה המשוער יוזז בחודש.
                התשלומים בפועל לא ישתנו.
              </p>
              {dialogError ? (
                <ForteV2StatusBanner tone="error">{dialogError}</ForteV2StatusBanner>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ForteV2PrimaryButton
                  disabled={busy}
                  onClick={() => void handleMove(dialog.forecastId)}
                >
                  העברה
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton disabled={busy} onClick={closeDialog}>
                  ביטול
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}

      {linkDialog ? (
        <ForteV2DialogOverlay onClose={closeDialog}>
          <ForteV2Dialog title="קישור לתשלום קיים" onClose={closeDialog} size="lg">
            <div className="space-y-3 text-sm">
              <p className="text-forte-text-secondary">
                בוחרים תשלום שכבר נרשם בפרויקט. הקישור לא יוצר, לא עורך ולא מוחק תשלום.
              </p>
              {linkChoices.length === 0 ? (
                <p>אין תשלומים פנויים לקישור בפרויקט הזה.</p>
              ) : (
                <label className="block space-y-1">
                  <ForteV2FormLabel>תשלום</ForteV2FormLabel>
                  <select
                    className="fv2-input w-full"
                    value={linkDialog.paymentId}
                    onChange={(event) =>
                      setDialog({ ...linkDialog, paymentId: event.target.value })
                    }
                  >
                    <option value="">בחרו תשלום</option>
                    {linkChoices.map((payment) => (
                      <option key={payment.id} value={payment.id}>
                        {formatMoney(payment.amount)} · {formatForecastDisplayDate(payment.paymentDate)} ·{" "}
                        {payment.paymentMethod}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {dialogError ? (
                <ForteV2StatusBanner tone="error">{dialogError}</ForteV2StatusBanner>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <ForteV2PrimaryButton
                  disabled={busy || !linkDialog.paymentId}
                  onClick={() => void handleLink(linkDialog.forecastId, linkDialog.paymentId)}
                >
                  קישור
                </ForteV2PrimaryButton>
                <ForteV2SecondaryButton
                  disabled={busy}
                  onClick={() => void handleUnlink(linkDialog.forecastId)}
                >
                  ביטול קישור
                </ForteV2SecondaryButton>
                <ForteV2SecondaryButton disabled={busy} onClick={closeDialog}>
                  סגירה
                </ForteV2SecondaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      ) : null}
    </MasterShellLayout>
  );
}
