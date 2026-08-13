import { normalizeBuildingId } from "./buildings-cloud";
import {
  isBuildingContactType,
  validateBuildingContactInput,
  type BuildingContact,
  type BuildingContactInput,
} from "./building-contacts";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "./supabase-server";

export const BUILDING_CONTACTS_TABLE = "building_contacts";
export const BUILDINGS_TABLE = "buildings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBuildingContactId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function mapBuildingContactRow(row: Record<string, unknown>): BuildingContact | null {
  if (!row.id || !row.building_id) return null;
  const contactType = String(row.contact_type ?? "");
  if (!isBuildingContactType(contactType)) return null;

  return {
    id: String(row.id),
    buildingId: String(row.building_id),
    fullName: String(row.full_name ?? ""),
    roleTitle: String(row.role_title ?? ""),
    company: String(row.company ?? ""),
    phone: String(row.phone ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    email: String(row.email ?? ""),
    contactType,
    isPrimary: Boolean(row.is_primary),
    receivesReports: Boolean(row.receives_reports),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function buildInsertRow(buildingId: string, input: BuildingContactInput) {
  const now = new Date().toISOString();
  return {
    building_id: normalizeBuildingId(buildingId),
    full_name: input.fullName.trim(),
    role_title: input.roleTitle.trim(),
    company: input.company.trim(),
    phone: input.phone.trim(),
    whatsapp: input.whatsapp.trim(),
    email: input.email.trim(),
    contact_type: input.contactType,
    is_primary: input.isPrimary,
    receives_reports: input.receivesReports,
    notes: input.notes.trim(),
    updated_at: now,
  };
}

function tableMissingMessage(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  if (
    errorMessage.includes("building_contacts") &&
    (errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find"))
  ) {
    return "טבלת אנשי קשר טרם הוגדרה ב-Supabase. הריצו את migration 020_building_contacts.sql.";
  }
  return null;
}

export function normalizeRequestedBuildingId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeBuildingId(value);
  if (!normalized) return null;
  return normalized;
}

export async function assertBuildingExists(buildingId: string): Promise<boolean> {
  const client = getSupabaseServiceClient();
  if (!client) return false;

  const { data, error } = await client
    .from(BUILDINGS_TABLE)
    .select("building_id")
    .eq("building_id", buildingId)
    .maybeSingle();

  return !error && Boolean(data?.building_id);
}

async function clearPrimaryContacts(buildingId: string, exceptId?: string) {
  const client = getSupabaseServiceClient();
  if (!client) return false;

  let query = client
    .from(BUILDING_CONTACTS_TABLE)
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("building_id", buildingId)
    .eq("is_primary", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }

  const { error } = await query;
  return !error;
}

export async function listBuildingContactsForBuilding(
  buildingId: string
): Promise<{ contacts: BuildingContact[]; error: string | null }> {
  if (!isSupabaseServiceConfigured()) {
    return { contacts: [], error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contacts: [], error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { contacts: [], error: "בניין לא נמצא." };
  }

  const { data, error } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .select("*")
    .eq("building_id", normalized)
    .order("is_primary", { ascending: false })
    .order("full_name", { ascending: true });

  if (error) {
    const message =
      tableMissingMessage(error.message) ?? "טעינת אנשי קשר נכשלה.";
    console.warn("[building-contacts-server] list failed:", error.message);
    return { contacts: [], error: message };
  }

  const contacts = (data ?? [])
    .map((row) => mapBuildingContactRow(row as Record<string, unknown>))
    .filter((row): row is BuildingContact => row !== null);

  return { contacts, error: null };
}

export async function createBuildingContactForBuilding(
  buildingId: string,
  input: BuildingContactInput
): Promise<{ contact: BuildingContact | null; error: string | null }> {
  const validationError = validateBuildingContactInput(input);
  if (validationError) {
    return { contact: null, error: validationError };
  }

  if (!isSupabaseServiceConfigured()) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { contact: null, error: "בניין לא נמצא." };
  }

  if (input.isPrimary) {
    await clearPrimaryContacts(normalized);
  }

  const { data, error } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .insert(buildInsertRow(normalized, input))
    .select("*")
    .single();

  if (error || !data) {
    const message =
      tableMissingMessage(error?.message) ??
      (error?.message ?? "שמירת איש קשר נכשלה.");
    console.warn("[building-contacts-server] create failed:", error?.message);
    return { contact: null, error: message };
  }

  const contact = mapBuildingContactRow(data as Record<string, unknown>);
  return contact
    ? { contact, error: null }
    : { contact: null, error: "שמירת איש קשר נכשלה." };
}

export async function updateBuildingContactForBuilding(
  contactId: string,
  buildingId: string,
  input: BuildingContactInput
): Promise<{ contact: BuildingContact | null; error: string | null }> {
  if (!isBuildingContactId(contactId)) {
    return { contact: null, error: "מזהה איש קשר לא תקין." };
  }

  const validationError = validateBuildingContactInput(input);
  if (validationError) {
    return { contact: null, error: validationError };
  }

  if (!isSupabaseServiceConfigured()) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { contact: null, error: "בניין לא נמצא." };
  }

  const { data: existing, error: existingError } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .select("id")
    .eq("id", contactId)
    .eq("building_id", normalized)
    .maybeSingle();

  if (existingError || !existing) {
    return { contact: null, error: "איש קשר לא נמצא." };
  }

  if (input.isPrimary) {
    await clearPrimaryContacts(normalized, contactId);
  }

  const row = buildInsertRow(normalized, input);
  const patch = { ...row };
  delete (patch as { building_id?: string }).building_id;

  const { data, error } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .update(patch)
    .eq("id", contactId)
    .eq("building_id", normalized)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[building-contacts-server] update failed:", error?.message);
    return {
      contact: null,
      error: error?.message ?? "עדכון איש קשר נכשל.",
    };
  }

  const contact = mapBuildingContactRow(data as Record<string, unknown>);
  return contact
    ? { contact, error: null }
    : { contact: null, error: "עדכון איש קשר נכשל." };
}

export async function deleteBuildingContactForBuilding(
  contactId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isBuildingContactId(contactId)) {
    return { ok: false, error: "מזהה איש קשר לא תקין." };
  }

  if (!isSupabaseServiceConfigured()) {
    return { ok: false, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { ok: false, error: "בניין לא נמצא." };
  }

  const { data: existing, error: existingError } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .select("id")
    .eq("id", contactId)
    .eq("building_id", normalized)
    .maybeSingle();

  if (existingError || !existing) {
    return { ok: false, error: "איש קשר לא נמצא." };
  }

  const { error } = await client
    .from(BUILDING_CONTACTS_TABLE)
    .delete()
    .eq("id", contactId)
    .eq("building_id", normalized);

  if (error) {
    console.warn("[building-contacts-server] delete failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

export function parseBuildingContactInput(body: unknown): BuildingContactInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  const contactType = String(record.contactType ?? "");
  if (!isBuildingContactType(contactType)) return null;

  return {
    fullName: String(record.fullName ?? ""),
    roleTitle: String(record.roleTitle ?? ""),
    company: String(record.company ?? ""),
    phone: String(record.phone ?? ""),
    whatsapp: String(record.whatsapp ?? ""),
    email: String(record.email ?? ""),
    contactType,
    isPrimary: Boolean(record.isPrimary),
    receivesReports: Boolean(record.receivesReports),
    notes: String(record.notes ?? ""),
  };
}
