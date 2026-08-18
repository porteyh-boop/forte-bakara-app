export const INCOME_TYPES = [
  "ייעוץ",
  "בדיקה",
  "בקרת שירות",
  "חוות דעת",
  "מכרז",
  "שדרוג / מודרניזציה",
  "פיקוח / קבלה",
  "אחר",
] as const;

export type IncomeType = (typeof INCOME_TYPES)[number];

export const PAYMENT_METHODS = [
  "העברה בנקאית",
  "אשראי",
  "צ'ק",
  "מזומן",
  "אחר",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const COLLECTION_STATUSES = [
  "לא הוגדר",
  "טרם שולם",
  "שולם חלקית",
  "שולם במלואו",
  "באיחור",
] as const;

export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export interface ProjectFinancialSummary {
  paidTotal: number;
  balance: number | null;
  creditBalance: number;
  collectionStatus: CollectionStatus;
}

export interface ProjectOrderFields {
  orderAmount: number | null;
  orderDate: string | null;
  incomeType: IncomeType | null;
  paymentTerms: string | null;
  nextPaymentDate: string | null;
}

export function isIncomeType(value: string): value is IncomeType {
  return INCOME_TYPES.includes(value as IncomeType);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundMoney(parsed);
}

export function parsePositiveMoneyInput(value: string): number | null {
  const parsed = parseMoneyInput(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return (
    new Intl.NumberFormat("he-IL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount) + " ₪"
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

export function isPaymentOverdue(
  nextPaymentDate: string | null | undefined,
  today: Date = new Date()
): boolean {
  if (!nextPaymentDate?.trim()) return false;
  const due = parseDateOnly(nextPaymentDate);
  if (!due) return false;
  return startOfDay(today) > due;
}

export function computeProjectFinancialSummary(
  orderAmount: number | null | undefined,
  paymentAmounts: number[],
  nextPaymentDate: string | null | undefined,
  today: Date = new Date()
): ProjectFinancialSummary {
  const paidTotal = roundMoney(
    paymentAmounts.reduce((sum, amount) => sum + amount, 0)
  );

  if (orderAmount == null || !Number.isFinite(orderAmount)) {
    return {
      paidTotal,
      balance: null,
      creditBalance: 0,
      collectionStatus: "לא הוגדר",
    };
  }

  const order = roundMoney(orderAmount);
  let balance = 0;
  let creditBalance = 0;

  if (paidTotal > order) {
    creditBalance = roundMoney(paidTotal - order);
    balance = 0;
  } else {
    balance = roundMoney(order - paidTotal);
    creditBalance = 0;
  }

  let collectionStatus: CollectionStatus;
  if (balance === 0) {
    collectionStatus = "שולם במלואו";
  } else if (isPaymentOverdue(nextPaymentDate, today)) {
    collectionStatus = "באיחור";
  } else if (paidTotal > 0) {
    collectionStatus = "שולם חלקית";
  } else {
    collectionStatus = "טרם שולם";
  }

  return { paidTotal, balance, creditBalance, collectionStatus };
}

export function collectionStatusTone(
  status: CollectionStatus
): "neutral" | "blue" | "success" | "warning" | "danger" {
  switch (status) {
    case "שולם במלואו":
      return "success";
    case "שולם חלקית":
      return "blue";
    case "באיחור":
      return "danger";
    case "טרם שולם":
      return "warning";
    default:
      return "neutral";
  }
}

export function orderFieldsFromBuildingRow(row: {
  order_amount?: unknown;
  order_date?: unknown;
  income_type?: unknown;
  payment_terms?: unknown;
  next_payment_date?: unknown;
}): ProjectOrderFields {
  const rawAmount = row.order_amount;
  const orderAmount =
    typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? roundMoney(rawAmount)
      : rawAmount != null
        ? parseMoneyInput(String(rawAmount))
        : null;

  const incomeTypeRaw =
    row.income_type != null ? String(row.income_type).trim() : "";
  const incomeType = isIncomeType(incomeTypeRaw) ? incomeTypeRaw : null;

  return {
    orderAmount,
    orderDate: row.order_date != null ? String(row.order_date) : null,
    incomeType,
    paymentTerms:
      row.payment_terms != null ? String(row.payment_terms).trim() || null : null,
    nextPaymentDate:
      row.next_payment_date != null ? String(row.next_payment_date) : null,
  };
}
