import {
  computeProjectFinancialSummary,
  INCOME_TYPES,
  isIncomeType,
  roundMoney,
  type CollectionStatus,
  type IncomeType,
} from "@/lib/project-financial";

export const BUSINESS_PERIOD_PRESETS = [
  "month",
  "prev_month",
  "quarter",
  "year",
  "all",
  "custom",
] as const;

export type BusinessPeriodPreset = (typeof BUSINESS_PERIOD_PRESETS)[number];

export interface BusinessDateRange {
  preset: BusinessPeriodPreset;
  from: string | null;
  to: string | null;
}

export interface BusinessBuildingRecord {
  buildingId: string;
  name: string;
  projectNumber: string | null;
  contactName: string | null;
  managementCompany: string | null;
  orderAmount: number | null;
  orderDate: string | null;
  incomeType: IncomeType | null;
  nextPaymentDate: string | null;
}

export interface BusinessPaymentRecord {
  buildingId: string;
  amount: number;
  paymentDate: string;
}

export interface BusinessDashboardMetrics {
  totalOrdersInPeriod: number;
  totalReceivedInPeriod: number;
  balanceDueToday: number;
  overdueToday: number;
  expectedIncomingInPeriod: number;
}

export interface BusinessProjectRow {
  buildingId: string;
  projectName: string;
  projectNumber: string;
  client: string;
  orderAmount: number | null;
  paidTotal: number;
  balance: number | null;
  creditBalance: number;
  nextPaymentDate: string | null;
  collectionStatus: CollectionStatus;
  hasFinancialData: boolean;
}

export interface BusinessIncomeTypeSummaryRow {
  incomeTypeLabel: string;
  ordersInPeriod: number;
  receivedInPeriod: number;
  currentBalance: number;
}

export interface BusinessDashboardResult {
  metrics: BusinessDashboardMetrics;
  rows: BusinessProjectRow[];
  incomeTypeSummary: BusinessIncomeTypeSummaryRow[];
  projectsWithoutFinancialDataCount: number;
  period: BusinessDateRange;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateOnly(value: string): Date | null {
  if (!DATE_ONLY_RE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function quarterBounds(date: Date): { from: Date; to: Date } {
  const quarter = Math.floor(date.getMonth() / 3);
  const from = new Date(date.getFullYear(), quarter * 3, 1);
  const to = new Date(date.getFullYear(), quarter * 3 + 3, 0);
  return { from, to };
}

export function resolveBusinessPeriodRange(
  preset: BusinessPeriodPreset,
  today: Date = new Date(),
  customFrom?: string | null,
  customTo?: string | null
): BusinessDateRange {
  if (preset === "all") {
    return { preset, from: null, to: null };
  }

  if (preset === "custom") {
    return {
      preset,
      from: customFrom?.trim() || null,
      to: customTo?.trim() || null,
    };
  }

  const anchor = startOfMonth(today);

  if (preset === "month") {
    return {
      preset,
      from: formatDateOnly(startOfMonth(anchor)),
      to: formatDateOnly(endOfMonth(anchor)),
    };
  }

  if (preset === "prev_month") {
    const prev = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    return {
      preset,
      from: formatDateOnly(startOfMonth(prev)),
      to: formatDateOnly(endOfMonth(prev)),
    };
  }

  if (preset === "quarter") {
    const { from, to } = quarterBounds(today);
    return { preset, from: formatDateOnly(from), to: formatDateOnly(to) };
  }

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  return {
    preset: "year",
    from: formatDateOnly(yearStart),
    to: formatDateOnly(yearEnd),
  };
}

export function parseBusinessPeriodPreset(value: string | null): BusinessPeriodPreset | null {
  if (!value) return null;
  return BUSINESS_PERIOD_PRESETS.includes(value as BusinessPeriodPreset)
    ? (value as BusinessPeriodPreset)
    : null;
}

export function validateCustomBusinessPeriod(
  from: string | null | undefined,
  to: string | null | undefined
): string | null {
  const fromValue = from?.trim() ?? "";
  const toValue = to?.trim() ?? "";
  if (!fromValue || !toValue) {
    return "יש לבחור תאריך התחלה ותאריך סיום.";
  }
  if (!parseDateOnly(fromValue) || !parseDateOnly(toValue)) {
    return "תאריך לא תקין.";
  }
  if (fromValue > toValue) {
    return "תאריך ההתחלה חייב להיות לפני תאריך הסיום.";
  }
  return null;
}

export function isDateWithinPeriod(
  date: string | null | undefined,
  range: BusinessDateRange
): boolean {
  if (!date?.trim()) return false;
  if (range.preset === "all" || (!range.from && !range.to)) return true;
  if (!range.from || !range.to) return false;
  return date >= range.from && date <= range.to;
}

export function isDateBeforeToday(
  date: string | null | undefined,
  today: Date = new Date()
): boolean {
  if (!date?.trim()) return false;
  const parsed = parseDateOnly(date);
  if (!parsed) return false;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return parsed < todayStart;
}

export function resolveBusinessProjectClient(
  contactName: string | null | undefined,
  managementCompany: string | null | undefined
): string {
  return contactName?.trim() || managementCompany?.trim() || "—";
}

export function hasBusinessFinancialData(orderAmount: number | null | undefined): boolean {
  return orderAmount != null && Number.isFinite(orderAmount);
}

export function incomeTypeLabel(incomeType: IncomeType | null): string {
  return incomeType ?? "לא מוגדר";
}

function paymentsByBuilding(
  payments: BusinessPaymentRecord[]
): Map<string, BusinessPaymentRecord[]> {
  const map = new Map<string, BusinessPaymentRecord[]>();
  for (const payment of payments) {
    const list = map.get(payment.buildingId) ?? [];
    list.push(payment);
    map.set(payment.buildingId, list);
  }
  return map;
}

function sumPayments(records: BusinessPaymentRecord[]): number {
  return roundMoney(records.reduce((sum, payment) => sum + payment.amount, 0));
}

function projectBalance(orderAmount: number | null, paidTotal: number): number | null {
  if (orderAmount == null || !Number.isFinite(orderAmount)) return null;
  return roundMoney(Math.max(orderAmount - paidTotal, 0));
}

export function buildBusinessDashboard(input: {
  buildings: BusinessBuildingRecord[];
  payments: BusinessPaymentRecord[];
  period: BusinessDateRange;
  today?: Date;
}): BusinessDashboardResult {
  const today = input.today ?? new Date();
  const paymentMap = paymentsByBuilding(input.payments);

  let totalOrdersInPeriod = 0;
  let totalReceivedInPeriod = 0;
  let balanceDueToday = 0;
  let overdueToday = 0;
  let expectedIncomingInPeriod = 0;
  let projectsWithoutFinancialDataCount = 0;

  const rows: BusinessProjectRow[] = [];
  const incomeTotals = new Map<string, BusinessIncomeTypeSummaryRow>();

  for (const type of INCOME_TYPES) {
    incomeTotals.set(type, {
      incomeTypeLabel: type,
      ordersInPeriod: 0,
      receivedInPeriod: 0,
      currentBalance: 0,
    });
  }
  incomeTotals.set("לא מוגדר", {
    incomeTypeLabel: "לא מוגדר",
    ordersInPeriod: 0,
    receivedInPeriod: 0,
    currentBalance: 0,
  });

  for (const building of input.buildings) {
    const buildingPayments = paymentMap.get(building.buildingId) ?? [];
    const paidTotal = sumPayments(buildingPayments);
    const summary = computeProjectFinancialSummary(
      building.orderAmount,
      buildingPayments.map((payment) => payment.amount),
      building.nextPaymentDate,
      today
    );
    const balance = summary.balance;
    const hasFinancialData = hasBusinessFinancialData(building.orderAmount);

    if (!hasFinancialData) {
      projectsWithoutFinancialDataCount += 1;
    }

    if (hasFinancialData && building.orderAmount != null) {
      balanceDueToday = roundMoney(balanceDueToday + (balance ?? 0));

      if ((balance ?? 0) > 0 && isDateBeforeToday(building.nextPaymentDate, today)) {
        overdueToday = roundMoney(overdueToday + (balance ?? 0));
      }

      if (
        (balance ?? 0) > 0 &&
        isDateWithinPeriod(building.nextPaymentDate, input.period)
      ) {
        expectedIncomingInPeriod = roundMoney(expectedIncomingInPeriod + (balance ?? 0));
      }
    }

    if (
      hasFinancialData &&
      building.orderAmount != null &&
      isDateWithinPeriod(building.orderDate, input.period)
    ) {
      totalOrdersInPeriod = roundMoney(totalOrdersInPeriod + building.orderAmount);
    }

    for (const payment of buildingPayments) {
      if (isDateWithinPeriod(payment.paymentDate, input.period)) {
        totalReceivedInPeriod = roundMoney(totalReceivedInPeriod + payment.amount);
      }
    }

    const typeKey = incomeTypeLabel(building.incomeType);
    if (!incomeTotals.has(typeKey)) {
      incomeTotals.set(typeKey, {
        incomeTypeLabel: typeKey,
        ordersInPeriod: 0,
        receivedInPeriod: 0,
        currentBalance: 0,
      });
    }
    const incomeRow = incomeTotals.get(typeKey)!;

    if (
      hasFinancialData &&
      building.orderAmount != null &&
      isDateWithinPeriod(building.orderDate, input.period)
    ) {
      incomeRow.ordersInPeriod = roundMoney(
        incomeRow.ordersInPeriod + building.orderAmount
      );
    }

    for (const payment of buildingPayments) {
      if (isDateWithinPeriod(payment.paymentDate, input.period)) {
        incomeRow.receivedInPeriod = roundMoney(
          incomeRow.receivedInPeriod + payment.amount
        );
      }
    }

    if (hasFinancialData && balance != null) {
      incomeRow.currentBalance = roundMoney(incomeRow.currentBalance + balance);
    }

    rows.push({
      buildingId: building.buildingId,
      projectName: building.name,
      projectNumber: building.projectNumber?.trim() || "—",
      client: resolveBusinessProjectClient(
        building.contactName,
        building.managementCompany
      ),
      orderAmount: building.orderAmount,
      paidTotal: summary.paidTotal,
      balance: summary.balance,
      creditBalance: summary.creditBalance,
      nextPaymentDate: building.nextPaymentDate,
      collectionStatus: summary.collectionStatus,
      hasFinancialData,
    });
  }

  rows.sort((a, b) => a.projectName.localeCompare(b.projectName, "he"));

  const incomeTypeSummary = [
    ...INCOME_TYPES.map((type) => incomeTotals.get(type)!),
    incomeTotals.get("לא מוגדר")!,
  ].filter(
    (row) =>
      row.ordersInPeriod > 0 ||
      row.receivedInPeriod > 0 ||
      row.currentBalance > 0
  );

  return {
    metrics: {
      totalOrdersInPeriod,
      totalReceivedInPeriod,
      balanceDueToday,
      overdueToday,
      expectedIncomingInPeriod,
    },
    rows,
    incomeTypeSummary,
    projectsWithoutFinancialDataCount,
    period: input.period,
  };
}

export function mapBuildingIncomeType(value: unknown): IncomeType | null {
  if (value == null) return null;
  const raw = String(value).trim();
  return isIncomeType(raw) ? raw : null;
}
