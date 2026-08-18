import { BUILDINGS_TABLE } from "@/lib/buildings-cloud";
import {
  mapBuildingIncomeType,
  type BusinessBuildingRecord,
  type BusinessPaymentRecord,
} from "@/lib/business-dashboard";
import { PROJECT_PAYMENTS_TABLE } from "@/lib/project-payments-server";
import { parseMoneyInput, parsePositiveMoneyInput, roundMoney } from "@/lib/project-financial";
import { getSupabaseServiceClient, isSupabaseServiceConfigured } from "@/lib/supabase-server";

function mapBuildingRow(row: Record<string, unknown>): BusinessBuildingRecord | null {
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
    orderDate: row.order_date != null ? String(row.order_date) : null,
    incomeType: mapBuildingIncomeType(row.income_type),
    nextPaymentDate:
      row.next_payment_date != null ? String(row.next_payment_date) : null,
  };
}

function mapPaymentRow(row: Record<string, unknown>): BusinessPaymentRecord | null {
  const buildingId = String(row.building_id ?? "").trim();
  if (!buildingId) return null;

  const rawAmount = row.amount;
  const amount =
    typeof rawAmount === "number"
      ? roundMoney(rawAmount)
      : parsePositiveMoneyInput(String(rawAmount ?? ""));
  if (amount == null || amount <= 0) return null;

  const paymentDate = String(row.payment_date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return null;

  return { buildingId, amount, paymentDate };
}

export async function loadBusinessDashboardData(): Promise<{
  buildings: BusinessBuildingRecord[];
  payments: BusinessPaymentRecord[];
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return {
      buildings: [],
      payments: [],
      error: "Supabase service role לא מוגדר.",
    };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return {
      buildings: [],
      payments: [],
      error: "Supabase service role לא מוגדר.",
    };
  }

  const [buildingsResult, paymentsResult] = await Promise.all([
    client
      .from(BUILDINGS_TABLE)
      .select(
        "building_id, name, project_number, contact_name, management_company, order_amount, order_date, income_type, next_payment_date"
      )
      .eq("is_active", true)
      .order("name", { ascending: true }),
    client
      .from(PROJECT_PAYMENTS_TABLE)
      .select("building_id, amount, payment_date"),
  ]);

  if (buildingsResult.error) {
    return {
      buildings: [],
      payments: [],
      error: buildingsResult.error.message,
    };
  }

  if (paymentsResult.error) {
    return {
      buildings: [],
      payments: [],
      error: paymentsResult.error.message,
    };
  }

  const buildings = (buildingsResult.data ?? [])
    .map((row) => mapBuildingRow(row as Record<string, unknown>))
    .filter((row): row is BusinessBuildingRecord => row != null);

  const payments = (paymentsResult.data ?? [])
    .map((row) => mapPaymentRow(row as Record<string, unknown>))
    .filter((row): row is BusinessPaymentRecord => row != null);

  return { buildings, payments, error: null };
}
