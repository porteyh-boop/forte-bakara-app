"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import MasterCodeGate from "@/components/master-v2/MasterCodeGate";
import MasterShellLayout from "@/components/master-v2/MasterShellLayout";
import {
  ForteV2DataTable,
  ForteV2EmptyState,
  ForteV2FormInput,
  ForteV2FormLabel,
  ForteV2PageHeader,
  ForteV2SecondaryButton,
  ForteV2StatusBanner,
  ForteV2StatusBadge,
  ForteV2TableCard,
  MasterProjectV2StatusBanner,
  MasterProjectV2Workspace,
  fv2,
} from "@/components/master-v2/project-v2/MasterProjectV2Workspace";
import type { BusinessPeriodPreset } from "@/lib/business-dashboard";
import { validateCustomBusinessPeriod } from "@/lib/business-dashboard";
import { fetchBusinessDashboard } from "@/lib/business-dashboard-cloud";
import { buildMasterProjectV2Path } from "@/lib/master-project-v2-routes";
import { ensureMasterV2SessionsValid } from "@/lib/master-v2-auth";
import {
  collectionStatusTone,
  formatMoney,
} from "@/lib/project-financial";
import { isMasterAuthenticated, setMasterAuthenticated } from "@/lib/pilot-cloud";

type AppliedBusinessPeriodRequest = {
  period: BusinessPeriodPreset;
  from?: string;
  to?: string;
};

const PERIOD_OPTIONS: Array<{ id: BusinessPeriodPreset; label: string }> = [
  { id: "month", label: "החודש" },
  { id: "prev_month", label: "חודש קודם" },
  { id: "quarter", label: "רבעון" },
  { id: "year", label: "השנה" },
  { id: "all", label: "הכל" },
  { id: "custom", label: "תקופה לבחירה" },
];

function formatDisplayDate(value: string | null): string {
  if (!value?.trim()) return "—";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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

export default function MasterBusinessView() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BusinessPeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedRequest, setAppliedRequest] = useState<AppliedBusinessPeriodRequest>({
    period: "month",
  });
  const [showMissingFinancialOnly, setShowMissingFinancialOnly] = useState(false);
  const [dashboard, setDashboard] = useState<
    Awaited<ReturnType<typeof fetchBusinessDashboard>>["dashboard"]
  >(null);

  useEffect(() => {
    setAuthed(isMasterAuthenticated());
  }, []);

  useEffect(() => {
    if (!authed) return;
    void ensureMasterV2SessionsValid().then((ok) => {
      if (!ok) setAuthed(false);
    });
  }, [authed]);

  const loadDashboard = useCallback(async (request: AppliedBusinessPeriodRequest) => {
    setLoading(true);

    const result = await fetchBusinessDashboard({
      period: request.period,
      from: request.period === "custom" ? request.from : undefined,
      to: request.period === "custom" ? request.to : undefined,
    });

    setLoading(false);

    if (result.error || !result.dashboard) {
      setError(result.error ?? "לא ניתן לטעון את נתוני העסקי.");
      return;
    }

    setError(null);
    setDashboard(result.dashboard);
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (
      appliedRequest.period === "custom" &&
      (!appliedRequest.from || !appliedRequest.to)
    ) {
      return;
    }
    void loadDashboard(appliedRequest);
  }, [authed, appliedRequest, loadDashboard]);

  function handlePeriodSelect(nextPeriod: BusinessPeriodPreset) {
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") return;
    setError(null);
    setAppliedRequest({ period: nextPeriod });
  }

  function handleApplyCustomPeriod() {
    const validationError = validateCustomBusinessPeriod(customFrom, customTo);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setAppliedRequest({
      period: "custom",
      from: customFrom.trim(),
      to: customTo.trim(),
    });
  }

  function handleCustomFromChange(value: string) {
    setCustomFrom(value);
    if (error) setError(null);
  }

  function handleCustomToChange(value: string) {
    setCustomTo(value);
    if (error) setError(null);
  }

  const visibleRows = useMemo(() => {
    if (!dashboard) return [];
    if (!showMissingFinancialOnly) return dashboard.rows;
    return dashboard.rows.filter((row) => !row.hasFinancialData);
  }, [dashboard, showMissingFinancialOnly]);

  function handleLogout() {
    setMasterAuthenticated(false);
    setAuthed(false);
  }

  function handleRowClick(buildingId: string) {
    window.location.assign(buildMasterProjectV2Path(buildingId));
  }

  if (!authed) {
    return <MasterCodeGate onSuccess={() => setAuthed(true)} />;
  }

  const metrics = dashboard?.metrics;

  return (
    <MasterShellLayout onLogout={handleLogout} activeItemId="business">
      <div className={fv2.pageBody}>
        <ForteV2PageHeader
          title="עסקי"
          subtitle="תמונת מצב עסקית וכספית מכל הפרויקטים הפעילים"
        />

        <div className="fv2-workspace-content">
          <MasterProjectV2Workspace data-workspace="business-dashboard">
            <div className="space-y-4">
              <div className="fv2-toolbar-card">
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <ForteV2SecondaryButton
                      key={option.id}
                      size="sm"
                      onClick={() => handlePeriodSelect(option.id)}
                    >
                      <span
                        className={
                          period === option.id ? "font-semibold text-forte-primary" : ""
                        }
                      >
                        {option.label}
                      </span>
                    </ForteV2SecondaryButton>
                  ))}
                </div>

                {period === "custom" && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <label className="block space-y-1">
                      <ForteV2FormLabel>מתאריך</ForteV2FormLabel>
                      <ForteV2FormInput
                        type="date"
                        value={customFrom}
                        onChange={(e) => handleCustomFromChange(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-1">
                      <ForteV2FormLabel>עד תאריך</ForteV2FormLabel>
                      <ForteV2FormInput
                        type="date"
                        value={customTo}
                        onChange={(e) => handleCustomToChange(e.target.value)}
                      />
                    </label>
                    <ForteV2SecondaryButton
                      size="sm"
                      onClick={handleApplyCustomPeriod}
                      disabled={!customFrom || !customTo || loading}
                    >
                      החל תקופה
                    </ForteV2SecondaryButton>
                  </div>
                )}
              </div>

              {error && <ForteV2StatusBanner tone="error">{error}</ForteV2StatusBanner>}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiCard
                  label="סה״כ הזמנות"
                  value={formatMoney(metrics?.totalOrdersInPeriod ?? 0)}
                />
                <KpiCard
                  label="התקבל בפועל"
                  value={formatMoney(metrics?.totalReceivedInPeriod ?? 0)}
                />
                <KpiCard
                  label="יתרה לגבייה כיום"
                  value={formatMoney(metrics?.balanceDueToday ?? 0)}
                />
                <KpiCard
                  label="באיחור כיום"
                  value={formatMoney(metrics?.overdueToday ?? 0)}
                />
                <KpiCard
                  label="צפוי להיכנס"
                  value={formatMoney(metrics?.expectedIncomingInPeriod ?? 0)}
                  hint="הסכום מבוסס על יתרת הפרויקט ומועד התשלום הצפוי שהוגדר. אין בשלב זה לוח תשלומים עתידי מפורט."
                />
              </div>

              {dashboard && dashboard.projectsWithoutFinancialDataCount > 0 && (
                <MasterProjectV2StatusBanner tone="warning">
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => setShowMissingFinancialOnly((current) => !current)}
                  >
                    {dashboard.projectsWithoutFinancialDataCount} פרויקטים פעילים ללא
                    נתונים כספיים
                  </button>
                  {showMissingFinancialOnly ? " — מציג רק פרויקטים אלה" : ""}
                </MasterProjectV2StatusBanner>
              )}

              <ForteV2TableCard title="טבלת הגבייה" count={visibleRows.length}>
                {loading && visibleRows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-forte-text-secondary">
                    טוען נתונים...
                  </div>
                ) : visibleRows.length === 0 ? (
                  <ForteV2EmptyState
                    icon="▦"
                    title="אין פרויקטים להצגה"
                    description="לא נמצאו פרויקטים פעילים התואמים את הסינון."
                  />
                ) : (
                  <ForteV2DataTable>
                    <thead>
                      <tr>
                        <th>פרויקט</th>
                        <th>לקוח</th>
                        <th className="text-left" dir="ltr">
                          סכום הזמנה
                        </th>
                        <th className="text-left" dir="ltr">
                          התקבל
                        </th>
                        <th className="text-left" dir="ltr">
                          יתרה
                        </th>
                        <th>מועד תשלום צפוי</th>
                        <th>סטטוס גבייה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr
                          key={row.buildingId}
                          className="cursor-pointer hover:bg-forte-surface/60"
                          onClick={() => handleRowClick(row.buildingId)}
                        >
                          <td className="fv2-card-primary" data-label="פרויקט">
                            <div className="font-medium text-forte-text">{row.projectName}</div>
                            {row.projectNumber !== "—" && (
                              <div className="text-xs text-forte-text-secondary">
                                {row.projectNumber}
                              </div>
                            )}
                          </td>
                          <td data-label="לקוח">{row.client}</td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="סכום הזמנה">
                            {formatMoney(row.orderAmount)}
                          </td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="התקבל">
                            {formatMoney(row.paidTotal)}
                          </td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="יתרה">
                            {row.balance == null ? "—" : formatMoney(row.balance)}
                          </td>
                          <td data-label="מועד תשלום צפוי">{formatDisplayDate(row.nextPaymentDate)}</td>
                          <td data-label="סטטוס גבייה">
                            <ForteV2StatusBadge tone={collectionStatusTone(row.collectionStatus)}>
                              {row.collectionStatus}
                            </ForteV2StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ForteV2DataTable>
                )}
              </ForteV2TableCard>

              <ForteV2TableCard
                title="סיכום לפי סוג עבודה"
                count={dashboard?.incomeTypeSummary.length ?? 0}
              >
                {!dashboard || dashboard.incomeTypeSummary.length === 0 ? (
                  <div className="py-8 text-center text-sm text-forte-text-secondary">
                    אין נתונים לסיכום בתקופה שנבחרה.
                  </div>
                ) : (
                  <ForteV2DataTable>
                    <thead>
                      <tr>
                        <th>סוג עבודה</th>
                        <th className="text-left" dir="ltr">
                          הזמנות בתקופה
                        </th>
                        <th className="text-left" dir="ltr">
                          התקבל בתקופה
                        </th>
                        <th className="text-left" dir="ltr">
                          יתרה נוכחית
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.incomeTypeSummary.map((row) => (
                        <tr key={row.incomeTypeLabel}>
                          <td className="fv2-card-primary" data-label="סוג עבודה">
                            {row.incomeTypeLabel}
                          </td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="הזמנות בתקופה">
                            {formatMoney(row.ordersInPeriod)}
                          </td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="התקבל בתקופה">
                            {formatMoney(row.receivedInPeriod)}
                          </td>
                          <td className="text-left font-mono text-sm" dir="ltr" data-label="יתרה נוכחית">
                            {formatMoney(row.currentBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </ForteV2DataTable>
                )}
              </ForteV2TableCard>
            </div>
          </MasterProjectV2Workspace>
        </div>
      </div>
    </MasterShellLayout>
  );
}
