import { BUILDINGS_TABLE, normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  buildCollectionForecastScreenModel,
  buildForecastProjects,
  buildMovedForecastFields,
  canDeleteCollectionForecast,
  evaluatePlannedAmountSave,
  isCollectionForecastStatus,
  parseDateOnlyParts,
  type CollectionForecast,
  type CollectionForecastCreateInput,
  type CollectionForecastPatchInput,
  type CollectionForecastPaymentRef,
  type ForecastBuildingInput,
} from "@/lib/collection-forecasts";
import {
  parseMoneyInput,
  parsePositiveMoneyInput,
  roundMoney,
} from "@/lib/project-financial";
import { PROJECT_PAYMENTS_TABLE } from "@/lib/project-payments-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const COLLECTION_FORECASTS_TABLE = "collection_forecasts";

export interface CollectionForecastMutationResult {
  forecast: CollectionForecast | null;
  error: string | null;
  code: string | null;
  openBalance: number | null;
  excess: number | null;
}

function failure(
  error: string,
  code: string,
  extra?: { openBalance?: number; excess?: number }
): CollectionForecastMutationResult {
  return {
    forecast: null,
    error,
    code,
    openBalance: extra?.openBalance ?? null,
    excess: extra?.excess ?? null,
  };
}

function success(forecast: CollectionForecast): CollectionForecastMutationResult {
  return {
    forecast,
    error: null,
    code: null,
    openBalance: null,
    excess: null,
  };
}

function tableMissingMessage(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  if (
    errorMessage.includes("collection_forecasts") &&
    (errorMessage.includes("does not exist") || errorMessage.includes("Could not find"))
  ) {
    return "טבלת תחזיות גבייה טרם הוגדרה. הריצו את migration 057_collection_forecasts.sql.";
  }
  return null;
}

function dateOnly(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim().slice(0, 10);
  return parseDateOnlyParts(text) ? text : null;
}

function mapForecastRow(row: Record<string, unknown>): CollectionForecast | null {
  const id = String(row.id ?? "");
  const buildingId = String(row.building_id ?? "").trim();
  const forecastMonth = dateOnly(row.forecast_month);
  const expectedCollectionDate = dateOnly(row.expected_collection_date);
  const status = String(row.status ?? "");
  if (!id || !buildingId || !forecastMonth || !expectedCollectionDate) return null;
  if (!isCollectionForecastStatus(status)) return null;

  const rawAmount = row.planned_amount;
  const plannedAmount =
    typeof rawAmount === "number"
      ? roundMoney(rawAmount)
      : parsePositiveMoneyInput(String(rawAmount ?? ""));
  if (plannedAmount == null || plannedAmount <= 0) return null;

  const notesRaw = row.notes == null ? null : String(row.notes).trim();

  return {
    id,
    buildingId,
    forecastMonth,
    plannedAmount,
    expectedCollectionDate,
    status,
    notes: notesRaw || null,
    linkedPaymentId: row.linked_payment_id ? String(row.linked_payment_id) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapPaymentRow(row: Record<string, unknown>): CollectionForecastPaymentRef | null {
  const id = String(row.id ?? "");
  const buildingId = String(row.building_id ?? "").trim();
  if (!id || !buildingId) return null;
  const rawAmount = row.amount;
  const amount =
    typeof rawAmount === "number"
      ? roundMoney(rawAmount)
      : parsePositiveMoneyInput(String(rawAmount ?? ""));
  if (amount == null || amount <= 0) return null;
  const paymentDate = dateOnly(row.payment_date);
  if (!paymentDate) return null;
  return {
    id,
    buildingId,
    amount,
    paymentDate,
    paymentMethod: String(row.payment_method ?? ""),
    notes: String(row.notes ?? ""),
  };
}

function mapBuildingRow(row: Record<string, unknown>): ForecastBuildingInput | null {
  const buildingId = String(row.building_id ?? "").trim();
  if (!buildingId) return null;
  const rawAmount = row.order_amount;
  const orderAmount =
    typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? roundMoney(rawAmount)
      : rawAmount != null
        ? parseMoneyInput(String(rawAmount))
        : null;

  return {
    buildingId,
    name: String(row.name ?? buildingId),
    projectNumber: row.project_number != null ? String(row.project_number) : null,
    contactName: row.contact_name != null ? String(row.contact_name) : null,
    managementCompany:
      row.management_company != null ? String(row.management_company) : null,
    orderAmount,
    nextPaymentDate: dateOnly(row.next_payment_date),
    isActive: row.is_active !== false,
    isTrial: row.is_trial === true,
  };
}

function serviceClient() {
  if (!isSupabaseServiceConfigured()) return null;
  return getSupabaseServiceClient();
}

export async function loadCollectionForecastScreen(month: string): Promise<{
  buildings: ForecastBuildingInput[];
  payments: CollectionForecastPaymentRef[];
  forecasts: CollectionForecast[];
  error: string | null;
}> {
  const client = serviceClient();
  if (!client) {
    return {
      buildings: [],
      payments: [],
      forecasts: [],
      error: "Supabase service role לא מוגדר.",
    };
  }

  const [buildingsResult, forecastsResult] = await Promise.all([
    client
      .from(BUILDINGS_TABLE)
      .select(
        "building_id, name, project_number, contact_name, management_company, order_amount, next_payment_date, is_active, is_trial"
      )
      .eq("is_active", true)
      .eq("is_trial", false)
      .not("order_amount", "is", null)
      .order("name", { ascending: true }),
    client
      .from(COLLECTION_FORECASTS_TABLE)
      .select("*")
      .eq("forecast_month", month)
      .order("expected_collection_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (buildingsResult.error) {
    return {
      buildings: [],
      payments: [],
      forecasts: [],
      error: buildingsResult.error.message,
    };
  }

  if (forecastsResult.error) {
    return {
      buildings: [],
      payments: [],
      forecasts: [],
      error:
        tableMissingMessage(forecastsResult.error.message) ?? forecastsResult.error.message,
    };
  }

  const buildings = (buildingsResult.data ?? [])
    .map((row) => mapBuildingRow(row as Record<string, unknown>))
    .filter((row): row is ForecastBuildingInput => row != null);
  const buildingIds = buildings.map((building) => building.buildingId);

  let payments: CollectionForecastPaymentRef[] = [];
  if (buildingIds.length > 0) {
    const paymentsResult = await client
      .from(PROJECT_PAYMENTS_TABLE)
      .select("id, building_id, amount, payment_date, payment_method, notes")
      .in("building_id", buildingIds);

    if (paymentsResult.error) {
      return {
        buildings: [],
        payments: [],
        forecasts: [],
        error: paymentsResult.error.message,
      };
    }

    payments = (paymentsResult.data ?? [])
      .map((row) => mapPaymentRow(row as Record<string, unknown>))
      .filter((row): row is CollectionForecastPaymentRef => row != null);
  }

  const forecasts = (forecastsResult.data ?? [])
    .map((row) => mapForecastRow(row as Record<string, unknown>))
    .filter((row): row is CollectionForecast => row != null)
    .filter((row) => buildingIds.includes(row.buildingId));

  return { buildings, payments, forecasts, error: null };
}

export function presentCollectionForecastScreen(
  data: {
    buildings: ForecastBuildingInput[];
    payments: CollectionForecastPaymentRef[];
    forecasts: CollectionForecast[];
  },
  today: Date = new Date()
) {
  return buildCollectionForecastScreenModel({ ...data, today });
}

async function loadOpenBalance(buildingId: string): Promise<{
  openBalance: number | null;
  error: string | null;
  code: string | null;
}> {
  const client = serviceClient();
  if (!client) {
    return {
      openBalance: null,
      error: "Supabase service role לא מוגדר.",
      code: "unconfigured",
    };
  }

  const normalized = normalizeBuildingId(buildingId);
  const [buildingResult, paymentsResult] = await Promise.all([
    client
      .from(BUILDINGS_TABLE)
      .select(
        "building_id, name, project_number, contact_name, management_company, order_amount, next_payment_date, is_active, is_trial"
      )
      .eq("building_id", normalized)
      .maybeSingle(),
    client
      .from(PROJECT_PAYMENTS_TABLE)
      .select("id, building_id, amount, payment_date, payment_method, notes")
      .eq("building_id", normalized),
  ]);

  if (buildingResult.error) {
    return { openBalance: null, error: buildingResult.error.message, code: "read_failed" };
  }
  if (!buildingResult.data) {
    return { openBalance: null, error: "הפרויקט לא נמצא.", code: "not_found" };
  }
  if (paymentsResult.error) {
    return { openBalance: null, error: paymentsResult.error.message, code: "read_failed" };
  }

  const building = mapBuildingRow(buildingResult.data as Record<string, unknown>);
  const payments = (paymentsResult.data ?? [])
    .map((row) => mapPaymentRow(row as Record<string, unknown>))
    .filter((row): row is CollectionForecastPaymentRef => row != null);

  if (!building || !building.isActive || building.isTrial || building.orderAmount == null) {
    return {
      openBalance: null,
      error: "הפרויקט אינו זמין לתחזית גבייה.",
      code: "ineligible",
    };
  }

  const project = buildForecastProjects([building], payments)[0];
  if (!project) {
    return {
      openBalance: null,
      error: "הפרויקט אינו זמין לתחזית גבייה.",
      code: "ineligible",
    };
  }

  return { openBalance: project.balance, error: null, code: null };
}

async function readForecastById(
  forecastId: string
): Promise<{ forecast: CollectionForecast | null; error: string | null; code: string | null }> {
  const client = serviceClient();
  if (!client) {
    return { forecast: null, error: "Supabase service role לא מוגדר.", code: "unconfigured" };
  }

  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .select("*")
    .eq("id", forecastId)
    .maybeSingle();

  if (error) {
    return {
      forecast: null,
      error: tableMissingMessage(error.message) ?? error.message,
      code: "read_failed",
    };
  }
  if (!data) {
    return { forecast: null, error: "התחזית לא נמצאה.", code: "not_found" };
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  if (!forecast) {
    return { forecast: null, error: "התחזית לא נמצאה.", code: "not_found" };
  }
  return { forecast, error: null, code: null };
}

export async function createCollectionForecast(
  input: CollectionForecastCreateInput
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const balance = await loadOpenBalance(input.buildingId);
  if (balance.error || balance.openBalance == null) {
    return failure(balance.error ?? "הפרויקט אינו זמין לתחזית גבייה.", balance.code ?? "ineligible");
  }

  const allowed = evaluatePlannedAmountSave(
    input.plannedAmount,
    balance.openBalance,
    input.confirmExceedsBalance
  );
  if (!allowed.ok) {
    return failure(allowed.message, "planned_exceeds_balance", {
      openBalance: allowed.openBalance,
      excess: allowed.excess,
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .insert({
      building_id: input.buildingId,
      forecast_month: input.forecastMonth,
      planned_amount: input.plannedAmount,
      expected_collection_date: input.expectedCollectionDate,
      status: input.status,
      notes: input.notes,
      linked_payment_id: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  return forecast ? success(forecast) : failure("יצירת התחזית נכשלה.", "write_failed");
}

export async function updateCollectionForecast(
  forecastId: string,
  input: CollectionForecastPatchInput
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const current = await readForecastById(forecastId);
  if (!current.forecast) {
    return failure(current.error ?? "התחזית לא נמצאה.", current.code ?? "not_found");
  }

  if (input.plannedAmount !== undefined) {
    const balance = await loadOpenBalance(current.forecast.buildingId);
    if (balance.error || balance.openBalance == null) {
      return failure(
        balance.error ?? "הפרויקט אינו זמין לתחזית גבייה.",
        balance.code ?? "ineligible"
      );
    }
    const allowed = evaluatePlannedAmountSave(
      input.plannedAmount,
      balance.openBalance,
      input.confirmExceedsBalance
    );
    if (!allowed.ok) {
      return failure(allowed.message, "planned_exceeds_balance", {
        openBalance: allowed.openBalance,
        excess: allowed.excess,
      });
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.plannedAmount !== undefined) patch.planned_amount = input.plannedAmount;
  if (input.expectedCollectionDate !== undefined) {
    patch.expected_collection_date = input.expectedCollectionDate;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .update(patch)
    .eq("id", forecastId)
    .select("*")
    .single();

  if (error) {
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  return forecast ? success(forecast) : failure("עדכון התחזית נכשל.", "write_failed");
}

export async function deleteCollectionForecast(
  forecastId: string
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const current = await readForecastById(forecastId);
  if (!current.forecast) {
    return failure(current.error ?? "התחזית לא נמצאה.", current.code ?? "not_found");
  }
  if (!canDeleteCollectionForecast(current.forecast)) {
    return failure(
      "אי אפשר למחוק תחזית שמקושרת לתשלום בפועל. בטלו את הקישור קודם. התשלום עצמו לא נמחק.",
      "linked_delete_forbidden"
    );
  }

  const { error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .delete()
    .eq("id", forecastId);

  if (error) {
    if (error.message.includes("collection_forecast_linked_payment_delete_forbidden")) {
      return failure(
        "אי אפשר למחוק תחזית שמקושרת לתשלום בפועל.",
        "linked_delete_forbidden"
      );
    }
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }

  return success(current.forecast);
}

export async function moveCollectionForecastToNextMonth(
  forecastId: string
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const current = await readForecastById(forecastId);
  if (!current.forecast) {
    return failure(current.error ?? "התחזית לא נמצאה.", current.code ?? "not_found");
  }

  const moved = buildMovedForecastFields(current.forecast);
  if (!moved.ok) {
    if (moved.reason === "linked") {
      return failure(
        "אי אפשר להעביר לחודש הבא תחזית שמקושרת לתשלום בפועל.",
        "linked_move_forbidden"
      );
    }
    return failure("לא ניתן להעביר את התחזית.", "invalid");
  }

  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .update({
      forecast_month: moved.forecastMonth,
      expected_collection_date: moved.expectedCollectionDate,
    })
    .eq("id", forecastId)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("collection_forecast_linked_payment_month_change_forbidden")) {
      return failure(
        "אי אפשר להעביר לחודש הבא תחזית שמקושרת לתשלום בפועל.",
        "linked_move_forbidden"
      );
    }
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  return forecast ? success(forecast) : failure("העברת התחזית נכשלה.", "write_failed");
}

export async function linkCollectionForecastPayment(
  forecastId: string,
  paymentId: string
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const current = await readForecastById(forecastId);
  if (!current.forecast) {
    return failure(current.error ?? "התחזית לא נמצאה.", current.code ?? "not_found");
  }

  const paymentResult = await client
    .from(PROJECT_PAYMENTS_TABLE)
    .select("id, building_id, amount, payment_date, payment_method, notes")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentResult.error) {
    return failure(paymentResult.error.message, "read_failed");
  }
  const payment = paymentResult.data
    ? mapPaymentRow(paymentResult.data as Record<string, unknown>)
    : null;
  if (!payment) {
    return failure("התשלום לא נמצא.", "payment_not_found");
  }
  if (payment.buildingId !== current.forecast.buildingId) {
    return failure("התשלום שייך לפרויקט אחר.", "payment_building_mismatch");
  }

  const existingLink = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .select("id")
    .eq("linked_payment_id", paymentId)
    .neq("id", forecastId)
    .maybeSingle();

  if (existingLink.error) {
    return failure(
      tableMissingMessage(existingLink.error.message) ?? existingLink.error.message,
      "read_failed"
    );
  }
  if (existingLink.data) {
    return failure("התשלום כבר מקושר לתחזית אחרת.", "payment_already_linked");
  }

  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .update({ linked_payment_id: paymentId })
    .eq("id", forecastId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return failure("התשלום כבר מקושר לתחזית אחרת.", "payment_already_linked");
    }
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  return forecast ? success(forecast) : failure("קישור התשלום נכשל.", "write_failed");
}

export async function unlinkCollectionForecastPayment(
  forecastId: string
): Promise<CollectionForecastMutationResult> {
  const client = serviceClient();
  if (!client) return failure("Supabase service role לא מוגדר.", "unconfigured");

  const current = await readForecastById(forecastId);
  if (!current.forecast) {
    return failure(current.error ?? "התחזית לא נמצאה.", current.code ?? "not_found");
  }

  const { data, error } = await client
    .from(COLLECTION_FORECASTS_TABLE)
    .update({ linked_payment_id: null })
    .eq("id", forecastId)
    .select("*")
    .single();

  if (error) {
    return failure(tableMissingMessage(error.message) ?? error.message, "write_failed");
  }
  const forecast = mapForecastRow(data as Record<string, unknown>);
  return forecast ? success(forecast) : failure("ביטול הקישור נכשל.", "write_failed");
}
