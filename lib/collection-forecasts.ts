import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  computeProjectFinancialSummary,
  formatMoney,
  parsePositiveMoneyInput,
  roundMoney,
  type CollectionStatus,
} from "@/lib/project-financial";

export const COLLECTION_FORECAST_STATUSES = [
  "planned",
  "partially_collected",
  "fully_collected",
  "deferred",
] as const;

export type CollectionForecastStatus = (typeof COLLECTION_FORECAST_STATUSES)[number];

export const COLLECTION_FORECAST_STATUS_LABELS: Record<
  CollectionForecastStatus,
  string
> = {
  planned: "מתוכנן",
  partially_collected: "נגבה חלקית",
  fully_collected: "נגבה במלואו",
  deferred: "נדחה",
};

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

export interface CollectionForecast {
  id: string;
  buildingId: string;
  forecastMonth: string;
  plannedAmount: number;
  expectedCollectionDate: string;
  status: CollectionForecastStatus;
  notes: string | null;
  linkedPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionForecastPaymentRef {
  id: string;
  buildingId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
}

export interface CollectionForecastProject {
  buildingId: string;
  projectName: string;
  projectNumber: string | null;
  contactName: string | null;
  managementCompany: string | null;
  orderAmount: number;
  nextPaymentDate: string | null;
  paidTotal: number;
  balance: number;
  creditBalance: number;
  collectionStatus: CollectionStatus;
}

export interface ForecastBuildingInput {
  buildingId: string;
  name: string;
  projectNumber: string | null;
  contactName: string | null;
  managementCompany: string | null;
  orderAmount: number | null;
  nextPaymentDate: string | null;
  isActive: boolean;
  isTrial: boolean;
}

export interface ForecastScreenRow {
  key: string;
  project: CollectionForecastProject;
  forecast: CollectionForecast | null;
  linkedPayment: CollectionForecastPaymentRef | null;
}

export interface MonthlyForecastSummary {
  plannedTotal: number;
  collectedTotal: number;
  remainingTotal: number;
  overdueTotal: number;
  clientCount: number;
}

export interface CollectionForecastCreateInput {
  buildingId: string;
  forecastMonth: string;
  plannedAmount: number;
  expectedCollectionDate: string;
  status: CollectionForecastStatus;
  notes: string | null;
  confirmExceedsBalance: boolean;
}

export interface CollectionForecastPatchInput {
  plannedAmount?: number;
  expectedCollectionDate?: string;
  status?: CollectionForecastStatus;
  notes?: string | null;
  confirmExceedsBalance: boolean;
}

export interface PlannedBalanceExcess {
  exceeds: boolean;
  openBalance: number;
  excess: number;
}

export function isCollectionForecastStatus(
  value: string
): value is CollectionForecastStatus {
  return COLLECTION_FORECAST_STATUSES.includes(value as CollectionForecastStatus);
}

export function collectionForecastStatusLabel(status: CollectionForecastStatus): string {
  return COLLECTION_FORECAST_STATUS_LABELS[status];
}

export function collectionForecastStatusTone(
  status: CollectionForecastStatus
): "neutral" | "blue" | "success" | "warning" {
  switch (status) {
    case "fully_collected":
      return "success";
    case "partially_collected":
      return "warning";
    case "deferred":
      return "neutral";
    default:
      return "blue";
  }
}

export function forecastClientLabel(
  contactName: string | null | undefined,
  managementCompany: string | null | undefined
): string {
  const contact = contactName?.trim() ?? "";
  if (contact) return contact;
  const company = managementCompany?.trim() ?? "";
  if (company) return company;
  return "—";
}

export function forecastProjectNumberLabel(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

export function parseDateOnlyParts(
  value: string
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
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
  return { year, month, day };
}

export function normalizeForecastMonth(value: string): string | null {
  const trimmed = value.trim();
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthOnly) {
    const year = Number(monthOnly[1]);
    const month = Number(monthOnly[2]);
    if (month < 1 || month > 12) return null;
    return formatDateOnly(year, month, 1);
  }
  const date = parseDateOnlyParts(trimmed.slice(0, 10));
  if (!date) return null;
  return formatDateOnly(date.year, date.month, 1);
}

export function currentForecastMonth(today: Date = new Date()): string {
  return formatDateOnly(today.getFullYear(), today.getMonth() + 1, 1);
}

export function shiftForecastMonth(month: string, deltaMonths: number): string | null {
  const normalized = normalizeForecastMonth(month);
  if (!normalized) return null;
  const date = parseDateOnlyParts(normalized);
  if (!date) return null;
  const shifted = new Date(date.year, date.month - 1 + deltaMonths, 1);
  return formatDateOnly(shifted.getFullYear(), shifted.getMonth() + 1, 1);
}

export function shiftDateOnlyByMonths(value: string, deltaMonths: number): string | null {
  const date = parseDateOnlyParts(value.trim().slice(0, 10));
  if (!date) return null;
  const shifted = new Date(date.year, date.month - 1 + deltaMonths, 1);
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  const day = Math.min(date.day, lastDay);
  return formatDateOnly(shifted.getFullYear(), shifted.getMonth() + 1, day);
}

export function formatForecastMonthLabel(month: string): string {
  const normalized = normalizeForecastMonth(month);
  if (!normalized) return month;
  const date = parseDateOnlyParts(normalized);
  if (!date) return month;
  return `${HEBREW_MONTHS[date.month - 1]} ${date.year}`;
}

export function formatForecastDisplayDate(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  const date = parseDateOnlyParts(value.trim().slice(0, 10));
  if (!date) return value;
  return `${pad(date.day)}/${pad(date.month)}/${date.year}`;
}

export function forecastMonthInputValue(month: string): string {
  const normalized = normalizeForecastMonth(month);
  return normalized ? normalized.slice(0, 7) : "";
}

export function defaultExpectedCollectionDate(
  forecastMonth: string,
  nextPaymentDate: string | null | undefined,
  today: Date = new Date()
): string {
  const month = normalizeForecastMonth(forecastMonth) ?? currentForecastMonth(today);
  const next = nextPaymentDate?.trim().slice(0, 10) ?? "";
  if (next && normalizeForecastMonth(next) === month && parseDateOnlyParts(next)) {
    return next;
  }
  if (currentForecastMonth(today) === month) {
    return formatDateOnly(today.getFullYear(), today.getMonth() + 1, today.getDate());
  }
  return month;
}

export function suggestedPlannedAmount(
  openBalance: number,
  existingPlannedTotal: number
): number | null {
  const remaining = roundMoney(openBalance - existingPlannedTotal);
  return remaining > 0 ? remaining : null;
}

function parsePlannedAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = roundMoney(value);
    return rounded > 0 ? rounded : null;
  }
  if (typeof value === "string") return parsePositiveMoneyInput(value);
  return null;
}

function parseNotes(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

export function parseCollectionForecastCreateBody(
  value: unknown
): CollectionForecastCreateInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const buildingId =
    typeof raw.buildingId === "string" ? normalizeBuildingId(raw.buildingId) : "";
  if (!buildingId) return null;

  const forecastMonth =
    typeof raw.forecastMonth === "string"
      ? normalizeForecastMonth(raw.forecastMonth)
      : null;
  if (!forecastMonth) return null;

  const plannedAmount = parsePlannedAmount(raw.plannedAmount);
  if (plannedAmount == null) return null;

  const expectedRaw =
    typeof raw.expectedCollectionDate === "string"
      ? raw.expectedCollectionDate.trim().slice(0, 10)
      : "";
  if (!parseDateOnlyParts(expectedRaw)) return null;

  let status: CollectionForecastStatus = "planned";
  if (raw.status !== undefined) {
    if (typeof raw.status !== "string" || !isCollectionForecastStatus(raw.status)) {
      return null;
    }
    status = raw.status;
  }

  if (raw.notes !== undefined && raw.notes !== null && typeof raw.notes !== "string") {
    return null;
  }

  return {
    buildingId,
    forecastMonth,
    plannedAmount,
    expectedCollectionDate: expectedRaw,
    status,
    notes: typeof raw.notes === "string" ? raw.notes.trim() || null : null,
    confirmExceedsBalance: raw.confirmExceedsBalance === true,
  };
}

export function parseCollectionForecastPatchBody(
  value: unknown
): CollectionForecastPatchInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: CollectionForecastPatchInput = {
    confirmExceedsBalance: raw.confirmExceedsBalance === true,
  };
  let hasField = false;

  if (raw.plannedAmount !== undefined) {
    const plannedAmount = parsePlannedAmount(raw.plannedAmount);
    if (plannedAmount == null) return null;
    patch.plannedAmount = plannedAmount;
    hasField = true;
  }

  if (raw.expectedCollectionDate !== undefined) {
    if (typeof raw.expectedCollectionDate !== "string") return null;
    const date = raw.expectedCollectionDate.trim().slice(0, 10);
    if (!parseDateOnlyParts(date)) return null;
    patch.expectedCollectionDate = date;
    hasField = true;
  }

  if (raw.status !== undefined) {
    if (typeof raw.status !== "string" || !isCollectionForecastStatus(raw.status)) {
      return null;
    }
    patch.status = raw.status;
    hasField = true;
  }

  if (raw.notes !== undefined) {
    if (raw.notes !== null && typeof raw.notes !== "string") return null;
    const notes = parseNotes(raw.notes);
    if (notes === undefined && raw.notes !== null) return null;
    patch.notes = notes ?? null;
    hasField = true;
  }

  return hasField ? patch : null;
}

export function parseForecastRecordId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmed
    )
  ) {
    return null;
  }
  return trimmed;
}

export function describePlannedBalanceExcess(
  plannedAmount: number,
  openBalance: number
): PlannedBalanceExcess {
  const balance = roundMoney(openBalance);
  const planned = roundMoney(plannedAmount);
  const excess = roundMoney(planned - balance);
  return {
    exceeds: planned > balance,
    openBalance: balance,
    excess: excess > 0 ? excess : 0,
  };
}

export function plannedExceedsBalanceMessage(
  openBalance: number,
  excess: number
): string {
  return `הסכום המתוכנן גבוה מהיתרה הפתוחה. יתרה פתוחה: ${formatMoney(openBalance)}. חריגה: ${formatMoney(excess)}. נדרש אישור מפורש לפני שמירה.`;
}

export function evaluatePlannedAmountSave(
  plannedAmount: number,
  openBalance: number,
  confirmExceedsBalance: boolean
): { ok: true } | { ok: false; openBalance: number; excess: number; message: string } {
  const excess = describePlannedBalanceExcess(plannedAmount, openBalance);
  if (!excess.exceeds || confirmExceedsBalance) return { ok: true };
  return {
    ok: false,
    openBalance: excess.openBalance,
    excess: excess.excess,
    message: plannedExceedsBalanceMessage(excess.openBalance, excess.excess),
  };
}

export function canDeleteCollectionForecast(forecast: {
  linkedPaymentId: string | null;
}): boolean {
  return forecast.linkedPaymentId == null;
}

export function canMoveCollectionForecast(forecast: {
  linkedPaymentId: string | null;
}): boolean {
  return forecast.linkedPaymentId == null;
}

export function buildMovedForecastFields(forecast: {
  forecastMonth: string;
  expectedCollectionDate: string;
  linkedPaymentId: string | null;
}):
  | { ok: true; forecastMonth: string; expectedCollectionDate: string }
  | { ok: false; reason: "linked" | "invalid" } {
  if (!canMoveCollectionForecast(forecast)) return { ok: false, reason: "linked" };
  const forecastMonth = shiftForecastMonth(forecast.forecastMonth, 1);
  const expectedCollectionDate = shiftDateOnlyByMonths(
    forecast.expectedCollectionDate,
    1
  );
  if (!forecastMonth || !expectedCollectionDate) return { ok: false, reason: "invalid" };
  return { ok: true, forecastMonth, expectedCollectionDate };
}

export function linkedPaymentAmount(
  forecast: Pick<CollectionForecast, "linkedPaymentId">,
  paymentsById: ReadonlyMap<string, { amount: number }>
): number {
  if (!forecast.linkedPaymentId) return 0;
  const payment = paymentsById.get(forecast.linkedPaymentId);
  return payment ? roundMoney(payment.amount) : 0;
}

export function isForecastFullyCollected(
  forecast: Pick<CollectionForecast, "linkedPaymentId" | "plannedAmount">,
  paymentsById: ReadonlyMap<string, { amount: number }>
): boolean {
  return linkedPaymentAmount(forecast, paymentsById) >= roundMoney(forecast.plannedAmount);
}

export function isForecastOverdue(
  forecast: Pick<
    CollectionForecast,
    "linkedPaymentId" | "plannedAmount" | "expectedCollectionDate" | "status"
  >,
  paymentsById: ReadonlyMap<string, { amount: number }>,
  today: Date = new Date()
): boolean {
  if (forecast.status === "deferred") return false;
  if (isForecastFullyCollected(forecast, paymentsById)) return false;
  const due = parseDateOnlyParts(forecast.expectedCollectionDate);
  if (!due) return false;
  const dueDate = new Date(due.year, due.month - 1, due.day);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return todayStart > dueDate;
}

export function forecastUnpaidRemainder(
  forecast: Pick<CollectionForecast, "linkedPaymentId" | "plannedAmount">,
  paymentsById: ReadonlyMap<string, { amount: number }>
): number {
  return roundMoney(
    Math.max(
      roundMoney(forecast.plannedAmount) - linkedPaymentAmount(forecast, paymentsById),
      0
    )
  );
}

export function computeMonthlyForecastSummary(input: {
  forecasts: CollectionForecast[];
  payments: Array<Pick<CollectionForecastPaymentRef, "id" | "amount">>;
  today?: Date;
}): MonthlyForecastSummary {
  const today = input.today ?? new Date();
  const paymentsById = new Map(input.payments.map((payment) => [payment.id, payment]));
  const plannedTotal = roundMoney(
    input.forecasts.reduce((sum, forecast) => sum + forecast.plannedAmount, 0)
  );
  const collectedTotal = roundMoney(
    input.forecasts.reduce(
      (sum, forecast) => sum + linkedPaymentAmount(forecast, paymentsById),
      0
    )
  );
  const overdueTotal = roundMoney(
    input.forecasts.reduce((sum, forecast) => {
      if (!isForecastOverdue(forecast, paymentsById, today)) return sum;
      return sum + forecastUnpaidRemainder(forecast, paymentsById);
    }, 0)
  );

  return {
    plannedTotal,
    collectedTotal,
    remainingTotal: roundMoney(Math.max(plannedTotal - collectedTotal, 0)),
    overdueTotal,
    clientCount: new Set(input.forecasts.map((forecast) => forecast.buildingId)).size,
  };
}

export function buildForecastProjects(
  buildings: ForecastBuildingInput[],
  payments: Array<{ buildingId: string; amount: number }>,
  today: Date = new Date()
): CollectionForecastProject[] {
  const amountsByBuilding = new Map<string, number[]>();
  for (const payment of payments) {
    const list = amountsByBuilding.get(payment.buildingId) ?? [];
    list.push(payment.amount);
    amountsByBuilding.set(payment.buildingId, list);
  }

  const projects: CollectionForecastProject[] = [];
  for (const building of buildings) {
    if (!building.isActive || building.isTrial) continue;
    if (building.orderAmount == null || !Number.isFinite(building.orderAmount)) continue;

    const summary = computeProjectFinancialSummary(
      building.orderAmount,
      amountsByBuilding.get(building.buildingId) ?? [],
      building.nextPaymentDate,
      today
    );
    if (summary.balance == null) continue;

    projects.push({
      buildingId: building.buildingId,
      projectName: building.name.trim() || building.buildingId,
      projectNumber: building.projectNumber,
      contactName: building.contactName,
      managementCompany: building.managementCompany,
      orderAmount: roundMoney(building.orderAmount),
      nextPaymentDate: building.nextPaymentDate,
      paidTotal: summary.paidTotal,
      balance: summary.balance,
      creditBalance: summary.creditBalance,
      collectionStatus: summary.collectionStatus,
    });
  }

  return projects;
}

export function isProjectVisibleInForecastMonth(
  project: Pick<CollectionForecastProject, "balance">,
  forecastsForBuilding: CollectionForecast[]
): boolean {
  return project.balance > 0 || forecastsForBuilding.length > 0;
}

export function buildForecastScreenRows(input: {
  projects: CollectionForecastProject[];
  forecasts: CollectionForecast[];
  payments: CollectionForecastPaymentRef[];
}): ForecastScreenRow[] {
  const forecastsByBuilding = new Map<string, CollectionForecast[]>();
  for (const forecast of input.forecasts) {
    const list = forecastsByBuilding.get(forecast.buildingId) ?? [];
    list.push(forecast);
    forecastsByBuilding.set(forecast.buildingId, list);
  }
  const paymentsById = new Map(input.payments.map((payment) => [payment.id, payment]));
  const rows: ForecastScreenRow[] = [];

  for (const project of input.projects) {
    const own = forecastsByBuilding.get(project.buildingId) ?? [];
    if (!isProjectVisibleInForecastMonth(project, own)) continue;
    if (own.length === 0) {
      rows.push({
        key: `open:${project.buildingId}`,
        project,
        forecast: null,
        linkedPayment: null,
      });
      continue;
    }
    for (const forecast of own) {
      rows.push({
        key: forecast.id,
        project,
        forecast,
        linkedPayment: forecast.linkedPaymentId
          ? paymentsById.get(forecast.linkedPaymentId) ?? null
          : null,
      });
    }
  }

  rows.sort((a, b) => {
    const byName = a.project.projectName.localeCompare(b.project.projectName, "he");
    if (byName !== 0) return byName;
    const aDate = a.forecast?.expectedCollectionDate ?? "9999-99-99";
    const bDate = b.forecast?.expectedCollectionDate ?? "9999-99-99";
    return aDate.localeCompare(bDate);
  });

  return rows;
}

export function paymentsAvailableToLink(
  payments: CollectionForecastPaymentRef[],
  forecasts: Array<Pick<CollectionForecast, "id" | "linkedPaymentId">>,
  buildingId: string,
  forecastId: string
): CollectionForecastPaymentRef[] {
  const taken = new Set(
    forecasts
      .filter((forecast) => forecast.id !== forecastId && forecast.linkedPaymentId)
      .map((forecast) => forecast.linkedPaymentId as string)
  );
  return payments.filter(
    (payment) => payment.buildingId === buildingId && !taken.has(payment.id)
  );
}

export function buildCollectionForecastScreenModel(input: {
  buildings: ForecastBuildingInput[];
  payments: CollectionForecastPaymentRef[];
  forecasts: CollectionForecast[];
  today?: Date;
}): {
  projects: CollectionForecastProject[];
  forecasts: CollectionForecast[];
  payments: CollectionForecastPaymentRef[];
  rows: ForecastScreenRow[];
  summary: MonthlyForecastSummary;
} {
  const today = input.today ?? new Date();
  const projects = buildForecastProjects(input.buildings, input.payments, today);
  const visibleIds = new Set<string>();
  const forecastsByBuilding = new Map<string, CollectionForecast[]>();
  for (const forecast of input.forecasts) {
    const list = forecastsByBuilding.get(forecast.buildingId) ?? [];
    list.push(forecast);
    forecastsByBuilding.set(forecast.buildingId, list);
  }
  for (const project of projects) {
    if (isProjectVisibleInForecastMonth(project, forecastsByBuilding.get(project.buildingId) ?? [])) {
      visibleIds.add(project.buildingId);
    }
  }
  const visibleProjects = projects.filter((project) => visibleIds.has(project.buildingId));
  const visibleForecasts = input.forecasts.filter((forecast) =>
    visibleIds.has(forecast.buildingId)
  );
  const visiblePayments = input.payments.filter((payment) =>
    visibleIds.has(payment.buildingId)
  );

  return {
    projects: visibleProjects,
    forecasts: visibleForecasts,
    payments: visiblePayments,
    rows: buildForecastScreenRows({
      projects: visibleProjects,
      forecasts: visibleForecasts,
      payments: visiblePayments,
    }),
    summary: computeMonthlyForecastSummary({
      forecasts: visibleForecasts,
      payments: visiblePayments,
      today,
    }),
  };
}
