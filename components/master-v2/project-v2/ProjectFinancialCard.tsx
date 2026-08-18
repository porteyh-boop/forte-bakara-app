"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppVersion } from "@/components/AppVersionProvider";
import {
  ForteV2DataTable,
  ForteV2Dialog,
  ForteV2DialogOverlay,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2Panel,
  ForteV2SectionHeader,
  ForteV2StatusBadge,
  ForteV2TableCard,
  MasterProjectV2PrimaryButton,
  MasterProjectV2SecondaryButton,
  MasterProjectV2StatusBanner,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import { updateCloudBuilding, type CloudBuildingRow } from "@/lib/buildings-cloud";
import {
  collectionStatusTone,
  computeProjectFinancialSummary,
  formatMoney,
  INCOME_TYPES,
  parseMoneyInput,
  parsePositiveMoneyInput,
  type IncomeType,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/project-financial";
import {
  createProjectPayment,
  deleteProjectPayment,
  listProjectPayments,
  updateProjectPayment,
} from "@/lib/project-payments-cloud";
import type { ProjectPayment } from "@/lib/project-payments";
import { isPilotCloudConfigured } from "@/lib/pilot-cloud";

interface ProjectFinancialCardProps {
  cloudRow: CloudBuildingRow;
  onSaved?: (row: CloudBuildingRow) => void;
}

interface OrderDraft {
  orderAmount: string;
  orderDate: string;
  incomeType: IncomeType | "";
  paymentTerms: string;
  nextPaymentDate: string;
}

interface PaymentDraft {
  amount: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes: string;
}

const emptyPaymentDraft: PaymentDraft = {
  amount: "",
  paymentDate: "",
  paymentMethod: "העברה בנקאית",
  notes: "",
};

function orderDraftFromRow(row: CloudBuildingRow): OrderDraft {
  return {
    orderAmount: row.order_amount != null ? String(row.order_amount) : "",
    orderDate: row.order_date ?? "",
    incomeType: row.income_type ?? "",
    paymentTerms: row.payment_terms ?? "",
    nextPaymentDate: row.next_payment_date ?? "",
  };
}

function paymentDraftFromPayment(payment: ProjectPayment): PaymentDraft {
  return {
    amount: String(payment.amount),
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    notes: payment.notes,
  };
}

function formatDisplayDate(value: string | null): string {
  if (!value?.trim()) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export default function ProjectFinancialCard({
  cloudRow,
  onSaved,
}: ProjectFinancialCardProps) {
  const { guardSensitiveAction } = useAppVersion();
  const cloudReady = isPilotCloudConfigured();

  const [payments, setPayments] = useState<ProjectPayment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(() =>
    orderDraftFromRow(cloudRow)
  );
  const [orderSaving, setOrderSaving] = useState(false);

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"create" | "edit">("create");
  const [editingPayment, setEditingPayment] = useState<ProjectPayment | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(emptyPaymentDraft);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProjectPayment | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const refreshPayments = useCallback(async () => {
    const result = await listProjectPayments(cloudRow.building_id);
    setPayments(result.payments);
    setLoadError(result.error);
    return result;
  }, [cloudRow.building_id]);

  useEffect(() => {
    void refreshPayments();
  }, [refreshPayments]);

  useEffect(() => {
    setOrderDraft(orderDraftFromRow(cloudRow));
  }, [cloudRow]);

  const summary = useMemo(
    () =>
      computeProjectFinancialSummary(
        cloudRow.order_amount,
        payments.map((payment) => payment.amount),
        cloudRow.next_payment_date
      ),
    [cloudRow.order_amount, cloudRow.next_payment_date, payments]
  );

  function openOrderDialog() {
    setOrderDraft(orderDraftFromRow(cloudRow));
    setActionError(null);
    setOrderDialogOpen(true);
  }

  function openCreatePayment() {
    setPaymentMode("create");
    setEditingPayment(null);
    setPaymentDraft(emptyPaymentDraft);
    setActionError(null);
    setPaymentDialogOpen(true);
  }

  function openEditPayment(payment: ProjectPayment) {
    setPaymentMode("edit");
    setEditingPayment(payment);
    setPaymentDraft(paymentDraftFromPayment(payment));
    setActionError(null);
    setPaymentDialogOpen(true);
  }

  async function handleSaveOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudReady || orderSaving) return;
    if (!guardSensitiveAction()) return;

    const orderAmount = orderDraft.orderAmount.trim()
      ? parseMoneyInput(orderDraft.orderAmount)
      : null;
    if (orderDraft.orderAmount.trim() && orderAmount == null) {
      setActionError("סכום ההזמנה אינו תקין.");
      return;
    }

    setOrderSaving(true);
    setActionError(null);

    const updated = await updateCloudBuilding(cloudRow.id, {
      orderAmount,
      orderDate: orderDraft.orderDate || null,
      incomeType: orderDraft.incomeType || null,
      paymentTerms: orderDraft.paymentTerms,
      nextPaymentDate: orderDraft.nextPaymentDate || null,
    });

    setOrderSaving(false);

    if (!updated) {
      setActionError("שמירת נתוני ההזמנה נכשלה.");
      return;
    }

    setOrderDialogOpen(false);
    onSaved?.(updated);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudReady || paymentSaving) return;
    if (!guardSensitiveAction()) return;

    const amount = parsePositiveMoneyInput(paymentDraft.amount);
    if (amount == null) {
      setActionError("יש להזין סכום תשלום חיובי.");
      return;
    }
    if (!paymentDraft.paymentDate.trim()) {
      setActionError("יש לבחור תאריך תשלום.");
      return;
    }

    setPaymentSaving(true);
    setActionError(null);

    const input = {
      amount,
      paymentDate: paymentDraft.paymentDate,
      paymentMethod: paymentDraft.paymentMethod,
      notes: paymentDraft.notes,
    };

    const result =
      paymentMode === "create"
        ? await createProjectPayment(cloudRow.building_id, input)
        : editingPayment
          ? await updateProjectPayment(
              editingPayment.id,
              cloudRow.building_id,
              input
            )
          : { payment: null, error: "תשלום לא נמצא." };

    setPaymentSaving(false);

    if (!result.payment) {
      setActionError(result.error ?? "שמירת התשלום נכשלה.");
      return;
    }

    setPaymentDialogOpen(false);
    setEditingPayment(null);
    setPaymentDraft(emptyPaymentDraft);
    await refreshPayments();
  }

  async function handleConfirmDeletePayment() {
    if (!deleteTarget || deleteSaving) return;
    if (!guardSensitiveAction()) return;

    setDeleteSaving(true);
    setActionError(null);

    const result = await deleteProjectPayment(
      deleteTarget.id,
      cloudRow.building_id
    );

    setDeleteSaving(false);

    if (!result.ok) {
      setActionError(result.error ?? "מחיקת התשלום נכשלה.");
      return;
    }

    setDeleteTarget(null);
    await refreshPayments();
  }

  return (
    <ForteV2Panel>
      <ForteV2SectionHeader title="כספי" />

      {!cloudReady && (
        <MasterProjectV2StatusBanner tone="warning">
          Supabase לא מוגדר — נתונים כספיים לקריאה בלבד.
        </MasterProjectV2StatusBanner>
      )}

      {loadError && (
        <MasterProjectV2StatusBanner tone="error">{loadError}</MasterProjectV2StatusBanner>
      )}

      {actionError && !orderDialogOpen && !paymentDialogOpen && !deleteTarget && (
        <MasterProjectV2StatusBanner tone="error">{actionError}</MasterProjectV2StatusBanner>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
        <FinancialMetric label="סכום הזמנה" value={formatMoney(cloudRow.order_amount)} />
        <FinancialMetric label="שולם" value={formatMoney(summary.paidTotal)} />
        <FinancialMetric
          label="יתרה"
          value={summary.balance == null ? "—" : formatMoney(summary.balance)}
        />
        <div className="space-y-1">
          <p className="text-[11px] text-forte-text-secondary">סטטוס גבייה</p>
          <ForteV2StatusBadge tone={collectionStatusTone(summary.collectionStatus)}>
            {summary.collectionStatus}
          </ForteV2StatusBadge>
        </div>
      </div>

      {summary.creditBalance > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
          <span className="text-forte-text-secondary">יתרת זכות: </span>
          <span className="font-semibold text-emerald-800">
            {formatMoney(summary.creditBalance)}
          </span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <DetailLine label="תאריך הזמנה" value={formatDisplayDate(cloudRow.order_date)} />
        <DetailLine label="סוג הכנסה" value={cloudRow.income_type ?? "—"} />
        <DetailLine label="תנאי תשלום" value={cloudRow.payment_terms?.trim() || "—"} wide />
        <DetailLine
          label="מועד תשלום צפוי"
          value={formatDisplayDate(cloudRow.next_payment_date)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MasterProjectV2SecondaryButton
          onClick={openOrderDialog}
          disabled={!cloudReady}
          size="sm"
        >
          ערוך נתוני הזמנה
        </MasterProjectV2SecondaryButton>
        <MasterProjectV2PrimaryButton
          onClick={openCreatePayment}
          disabled={!cloudReady}
          size="sm"
        >
          + הוסף תשלום
        </MasterProjectV2PrimaryButton>
        <MasterProjectV2SecondaryButton
          onClick={() => setHistoryOpen((current) => !current)}
          size="sm"
        >
          {historyOpen ? "הסתר היסטוריית תשלומים" : "היסטוריית תשלומים"}
        </MasterProjectV2SecondaryButton>
      </div>

      {historyOpen && (
        <div className="mt-4">
          {payments.length === 0 ? (
            <p className="text-sm text-forte-text-secondary py-4 text-center">
              טרם נרשמו תשלומים לפרויקט זה.
            </p>
          ) : (
            <ForteV2TableCard title="היסטוריית תשלומים" count={payments.length}>
              <ForteV2DataTable>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th className="text-left" dir="ltr">
                      סכום
                    </th>
                    <th>אמצעי תשלום</th>
                    <th>הערה</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDisplayDate(payment.paymentDate)}</td>
                      <td className="text-left font-mono text-sm" dir="ltr">
                        {formatMoney(payment.amount)}
                      </td>
                      <td>{payment.paymentMethod}</td>
                      <td className="max-w-[200px] truncate">
                        {payment.notes.trim() || "—"}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          <MasterProjectV2SecondaryButton
                            onClick={() => openEditPayment(payment)}
                            disabled={!cloudReady}
                            size="sm"
                          >
                            עריכה
                          </MasterProjectV2SecondaryButton>
                          <MasterProjectV2SecondaryButton
                            onClick={() => {
                              setActionError(null);
                              setDeleteTarget(payment);
                            }}
                            disabled={!cloudReady}
                            size="sm"
                          >
                            מחיקה
                          </MasterProjectV2SecondaryButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ForteV2DataTable>
            </ForteV2TableCard>
          )}
        </div>
      )}

      {orderDialogOpen && (
        <ForteV2DialogOverlay onClose={() => setOrderDialogOpen(false)}>
          <ForteV2Dialog
            title="עריכת נתוני הזמנה"
            onClose={() => setOrderDialogOpen(false)}
            size="lg"
          >
            <form onSubmit={(e) => void handleSaveOrder(e)} className="space-y-4 p-4 pt-0">
              {actionError && (
                <MasterProjectV2StatusBanner tone="error">{actionError}</MasterProjectV2StatusBanner>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <ForteV2FormLabel>סכום ההזמנה (₪)</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={orderDraft.orderAmount}
                    onChange={(e) =>
                      setOrderDraft((current) => ({
                        ...current,
                        orderAmount: e.target.value,
                      }))
                    }
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="10000"
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>תאריך ההזמנה</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="date"
                    value={orderDraft.orderDate}
                    onChange={(e) =>
                      setOrderDraft((current) => ({
                        ...current,
                        orderDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>סוג הכנסה</ForteV2FormLabel>
                  <select
                    value={orderDraft.incomeType}
                    onChange={(e) =>
                      setOrderDraft((current) => ({
                        ...current,
                        incomeType: e.target.value as IncomeType | "",
                      }))
                    }
                    className="fv2-input w-full"
                  >
                    <option value="">—</option>
                    {INCOME_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>מועד תשלום צפוי</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="date"
                    value={orderDraft.nextPaymentDate}
                    onChange={(e) =>
                      setOrderDraft((current) => ({
                        ...current,
                        nextPaymentDate: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>תנאי תשלום</ForteV2FormLabel>
                  <textarea
                    value={orderDraft.paymentTerms}
                    onChange={(e) =>
                      setOrderDraft((current) => ({
                        ...current,
                        paymentTerms: e.target.value,
                      }))
                    }
                    rows={3}
                    className="fv2-input w-full min-h-[72px]"
                    placeholder="50% בהזמנה, 50% בסיום"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <MasterProjectV2PrimaryButton type="submit" disabled={orderSaving} size="sm">
                  {orderSaving ? "שומר..." : "שמור"}
                </MasterProjectV2PrimaryButton>
                <MasterProjectV2SecondaryButton
                  onClick={() => setOrderDialogOpen(false)}
                  size="sm"
                >
                  ביטול
                </MasterProjectV2SecondaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}

      {paymentDialogOpen && (
        <ForteV2DialogOverlay onClose={() => setPaymentDialogOpen(false)}>
          <ForteV2Dialog
            title={paymentMode === "create" ? "הוספת תשלום" : "עריכת תשלום"}
            onClose={() => setPaymentDialogOpen(false)}
          >
            <form onSubmit={(e) => void handleSavePayment(e)} className="space-y-4 p-4 pt-0">
              {actionError && (
                <MasterProjectV2StatusBanner tone="error">{actionError}</MasterProjectV2StatusBanner>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <ForteV2FormLabel>סכום (₪)</ForteV2FormLabel>
                  <ForteV2FormInput
                    value={paymentDraft.amount}
                    onChange={(e) =>
                      setPaymentDraft((current) => ({
                        ...current,
                        amount: e.target.value,
                      }))
                    }
                    dir="ltr"
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <ForteV2FormLabel>תאריך תשלום</ForteV2FormLabel>
                  <ForteV2FormInput
                    type="date"
                    value={paymentDraft.paymentDate}
                    onChange={(e) =>
                      setPaymentDraft((current) => ({
                        ...current,
                        paymentDate: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>אמצעי תשלום</ForteV2FormLabel>
                  <select
                    value={paymentDraft.paymentMethod}
                    onChange={(e) =>
                      setPaymentDraft((current) => ({
                        ...current,
                        paymentMethod: e.target.value as PaymentMethod,
                      }))
                    }
                    className="fv2-input w-full"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <ForteV2FormLabel>הערה</ForteV2FormLabel>
                  <textarea
                    value={paymentDraft.notes}
                    onChange={(e) =>
                      setPaymentDraft((current) => ({
                        ...current,
                        notes: e.target.value,
                      }))
                    }
                    rows={2}
                    className="fv2-input w-full min-h-[56px]"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <MasterProjectV2PrimaryButton type="submit" disabled={paymentSaving} size="sm">
                  {paymentSaving ? "שומר..." : "שמור"}
                </MasterProjectV2PrimaryButton>
                <MasterProjectV2SecondaryButton
                  onClick={() => setPaymentDialogOpen(false)}
                  size="sm"
                >
                  ביטול
                </MasterProjectV2SecondaryButton>
              </div>
            </form>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}

      {deleteTarget && (
        <ForteV2DialogOverlay onClose={() => setDeleteTarget(null)}>
          <ForteV2Dialog title="מחיקת תשלום" onClose={() => setDeleteTarget(null)}>
            <div className="space-y-4 p-4 pt-0">
              <p className="text-sm text-forte-text-secondary">
                האם למחוק את התשלום מ-
                {formatDisplayDate(deleteTarget.paymentDate)} בסך{" "}
                {formatMoney(deleteTarget.amount)}?
                <br />
                פעולה זו בלתי הפיכה.
              </p>
              {actionError && (
                <MasterProjectV2StatusBanner tone="error">{actionError}</MasterProjectV2StatusBanner>
              )}
              <div className="flex flex-wrap gap-2">
                <MasterProjectV2SecondaryButton
                  onClick={() => void handleConfirmDeletePayment()}
                  disabled={deleteSaving}
                  size="sm"
                >
                  {deleteSaving ? "מוחק..." : "מחק תשלום"}
                </MasterProjectV2SecondaryButton>
                <MasterProjectV2PrimaryButton onClick={() => setDeleteTarget(null)} size="sm">
                  ביטול
                </MasterProjectV2PrimaryButton>
              </div>
            </div>
          </ForteV2Dialog>
        </ForteV2DialogOverlay>
      )}
    </ForteV2Panel>
  );
}

function FinancialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-forte-text-secondary">{label}</p>
      <p className="text-sm font-semibold text-forte-text">{value}</p>
    </div>
  );
}

function DetailLine({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <span className="text-forte-text-secondary">{label}: </span>
      <span className="text-forte-text">{value}</span>
    </div>
  );
}
