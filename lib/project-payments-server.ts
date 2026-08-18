import { normalizeBuildingId } from "@/lib/buildings-cloud";
import {
  isPaymentMethod,
  parsePositiveMoneyInput,
  roundMoney,
} from "@/lib/project-financial";
import type { ProjectPayment, ProjectPaymentInput } from "@/lib/project-payments";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const PROJECT_PAYMENTS_TABLE = "project_payments";

function mapProjectPaymentRow(row: Record<string, unknown>): ProjectPayment | null {
  if (!row.id || !row.building_id) return null;

  const rawAmount = row.amount;
  const amount =
    typeof rawAmount === "number"
      ? roundMoney(rawAmount)
      : parsePositiveMoneyInput(String(rawAmount ?? ""));
  if (amount == null) return null;

  const paymentMethod = String(row.payment_method ?? "");
  if (!isPaymentMethod(paymentMethod)) return null;

  return {
    id: String(row.id),
    buildingId: String(row.building_id),
    amount,
    paymentDate: String(row.payment_date ?? ""),
    paymentMethod,
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function tableMissingMessage(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  if (
    errorMessage.includes("project_payments") &&
    (errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find"))
  ) {
    return "טבלת תשלומים טרם הוגדרה. הריצו את migration 033_project_financial.sql.";
  }
  return null;
}

export function normalizeRequestedBuildingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeBuildingId(value);
  return normalized || null;
}

function parsePaymentDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export function parseProjectPaymentInput(value: unknown): ProjectPaymentInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const amountRaw =
    typeof raw.amount === "number"
      ? raw.amount
      : typeof raw.amount === "string"
        ? parsePositiveMoneyInput(raw.amount)
        : null;
  const amount =
    typeof amountRaw === "number" ? roundMoney(amountRaw) : amountRaw;
  if (amount == null || amount <= 0) return null;

  const paymentDate = parsePaymentDate(raw.paymentDate);
  if (!paymentDate) return null;

  const paymentMethod =
    typeof raw.paymentMethod === "string" ? raw.paymentMethod.trim() : "";
  if (!isPaymentMethod(paymentMethod)) return null;

  return {
    amount,
    paymentDate,
    paymentMethod,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
  };
}

export function parseProjectPaymentPatch(
  value: unknown
): Partial<ProjectPaymentInput> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const patch: Partial<ProjectPaymentInput> = {};

  if (raw.amount !== undefined) {
    const amountRaw =
      typeof raw.amount === "number"
        ? raw.amount
        : typeof raw.amount === "string"
          ? parsePositiveMoneyInput(raw.amount)
          : null;
    const amount =
      typeof amountRaw === "number" ? roundMoney(amountRaw) : amountRaw;
    if (amount == null || amount <= 0) return null;
    patch.amount = amount;
  }

  if (raw.paymentDate !== undefined) {
    const paymentDate = parsePaymentDate(raw.paymentDate);
    if (!paymentDate) return null;
    patch.paymentDate = paymentDate;
  }

  if (raw.paymentMethod !== undefined) {
    const paymentMethod =
      typeof raw.paymentMethod === "string" ? raw.paymentMethod.trim() : "";
    if (!isPaymentMethod(paymentMethod)) return null;
    patch.paymentMethod = paymentMethod;
  }

  if (raw.notes !== undefined) {
    patch.notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export async function listProjectPaymentsForBuilding(
  buildingId: string
): Promise<{ payments: ProjectPayment[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { payments: [], error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { payments: [], error: "Supabase service role לא מוגדר." };

  const { data, error } = await client
    .from(PROJECT_PAYMENTS_TABLE)
    .select("*")
    .eq("building_id", normalizeBuildingId(buildingId))
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return {
      payments: [],
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const payments = (data ?? [])
    .map((row) => mapProjectPaymentRow(row as Record<string, unknown>))
    .filter((payment): payment is ProjectPayment => payment != null);

  return { payments, error: null };
}

export async function createProjectPaymentForBuilding(
  buildingId: string,
  input: ProjectPaymentInput
): Promise<{ payment: ProjectPayment | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { payment: null, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { payment: null, error: "Supabase service role לא מוגדר." };

  const now = new Date().toISOString();
  const { data, error } = await client
    .from(PROJECT_PAYMENTS_TABLE)
    .insert({
      building_id: normalizeBuildingId(buildingId),
      amount: input.amount,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      notes: input.notes,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    return {
      payment: null,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const payment = mapProjectPaymentRow(data as Record<string, unknown>);
  return { payment, error: payment ? null : "יצירת תשלום נכשלה." };
}

export async function updateProjectPaymentById(
  paymentId: string,
  buildingId: string,
  input: Partial<ProjectPaymentInput>
): Promise<{ payment: ProjectPayment | null; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { payment: null, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { payment: null, error: "Supabase service role לא מוגדר." };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.paymentDate !== undefined) patch.payment_date = input.paymentDate;
  if (input.paymentMethod !== undefined) patch.payment_method = input.paymentMethod;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await client
    .from(PROJECT_PAYMENTS_TABLE)
    .update(patch)
    .eq("id", paymentId)
    .eq("building_id", normalizeBuildingId(buildingId))
    .select("*")
    .single();

  if (error) {
    return {
      payment: null,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  const payment = mapProjectPaymentRow(data as Record<string, unknown>);
  return { payment, error: payment ? null : "עדכון תשלום נכשל." };
}

export async function deleteProjectPaymentById(
  paymentId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "Supabase service role לא מוגדר." };
  }

  const client = getSupabaseServiceClient();
  if (!client) return { ok: false, error: "Supabase service role לא מוגדר." };

  const { error } = await client
    .from(PROJECT_PAYMENTS_TABLE)
    .delete()
    .eq("id", paymentId)
    .eq("building_id", normalizeBuildingId(buildingId));

  if (error) {
    return {
      ok: false,
      error: tableMissingMessage(error.message) ?? error.message,
    };
  }

  return { ok: true, error: null };
}
