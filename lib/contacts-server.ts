import {
  validateContactInput,
  type Contact,
  type ContactInput,
} from "./contacts";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "./supabase-server";

export const CONTACTS_TABLE = "contacts";
export const PROJECT_CONTACTS_TABLE = "project_contacts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isContactId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function tableMissingMessage(
  tableName: string,
  errorMessage: string | undefined
): string | null {
  if (!errorMessage) return null;
  if (
    errorMessage.includes(tableName) &&
    (errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find"))
  ) {
    return `טבלת ${tableName} טרם הוגדרה ב-Supabase. הריצו את migration 024_central_contacts.sql.`;
  }
  return null;
}

function mapContactRow(row: Record<string, unknown>): Contact | null {
  if (!row.id) return null;
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    company: String(row.company ?? ""),
    roleTitle: String(row.role_title ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

function buildContactInsertRow(input: ContactInput) {
  const now = new Date().toISOString();
  return {
    full_name: input.fullName.trim(),
    company: input.company.trim(),
    role_title: input.roleTitle.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    notes: input.notes.trim(),
    updated_at: now,
  };
}

export function normalizeContactPhoneForLookup(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Exact match only — email (case-insensitive) or normalized phone digits. No fuzzy name match. */
export async function findExistingContactByExactMatch(
  input: ContactInput
): Promise<Contact | null> {
  const client = getSupabaseServiceClient();
  if (!client) return null;

  const email = input.email.trim().toLowerCase();
  if (email) {
    const { data, error } = await client.from(CONTACTS_TABLE).select("*");
    if (!error && data) {
      const match = data.find(
        (row) => String(row.email ?? "").trim().toLowerCase() === email
      );
      if (match) {
        return mapContactRow(match as Record<string, unknown>);
      }
    }
  }

  const phoneNorm = normalizeContactPhoneForLookup(input.phone);
  if (phoneNorm) {
    const { data, error } = await client
      .from(CONTACTS_TABLE)
      .select("*")
      .neq("phone", "");
    if (!error && data) {
      const match = data.find(
        (row) =>
          normalizeContactPhoneForLookup(String(row.phone ?? "")) === phoneNorm
      );
      if (match) {
        return mapContactRow(match as Record<string, unknown>);
      }
    }
  }

  return null;
}

export function parseContactInput(body: unknown): ContactInput | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return {
    fullName: String(record.fullName ?? ""),
    company: String(record.company ?? ""),
    roleTitle: String(record.roleTitle ?? ""),
    phone: String(record.phone ?? ""),
    email: String(record.email ?? ""),
    notes: String(record.notes ?? ""),
  };
}

export async function listContacts(): Promise<{
  contacts: Contact[];
  error: string | null;
}> {
  if (!isSupabaseServiceConfigured()) {
    return { contacts: [], error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contacts: [], error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const { data, error } = await client
    .from(CONTACTS_TABLE)
    .select("*")
    .order("full_name", { ascending: true });

  if (error) {
    const message =
      tableMissingMessage(CONTACTS_TABLE, error.message) ??
      "טעינת אנשי קשר נכשלה.";
    console.warn("[contacts-server] list failed:", error.message);
    return { contacts: [], error: message };
  }

  const contacts = (data ?? [])
    .map((row) => mapContactRow(row as Record<string, unknown>))
    .filter((row): row is Contact => row !== null);

  return { contacts, error: null };
}

export async function getContactById(
  contactId: string
): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isContactId(contactId)) {
    return { contact: null, error: "מזהה איש קשר לא תקין." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const { data, error } = await client
    .from(CONTACTS_TABLE)
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error || !data) {
    return { contact: null, error: "איש קשר לא נמצא." };
  }

  const contact = mapContactRow(data as Record<string, unknown>);
  return contact
    ? { contact, error: null }
    : { contact: null, error: "איש קשר לא נמצא." };
}

export async function countContactProjectRelations(
  contactId: string
): Promise<number> {
  const client = getSupabaseServiceClient();
  if (!client || !isContactId(contactId)) return 0;

  const { count, error } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("contact_id", contactId);

  if (error) return 0;
  return count ?? 0;
}

export async function createContact(
  input: ContactInput
): Promise<{ contact: Contact | null; error: string | null }> {
  const validationError = validateContactInput(input);
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

  const { data, error } = await client
    .from(CONTACTS_TABLE)
    .insert(buildContactInsertRow(input))
    .select("*")
    .single();

  if (error || !data) {
    const message =
      tableMissingMessage(CONTACTS_TABLE, error?.message) ??
      (error?.message ?? "שמירת איש קשר נכשלה.");
    console.warn("[contacts-server] create failed:", error?.message);
    return { contact: null, error: message };
  }

  const contact = mapContactRow(data as Record<string, unknown>);
  return contact
    ? { contact, error: null }
    : { contact: null, error: "שמירת איש קשר נכשלה." };
}

export async function updateContact(
  contactId: string,
  input: ContactInput
): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isContactId(contactId)) {
    return { contact: null, error: "מזהה איש קשר לא תקין." };
  }

  const validationError = validateContactInput(input);
  if (validationError) {
    return { contact: null, error: validationError };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const { data: existing, error: existingError } = await client
    .from(CONTACTS_TABLE)
    .select("id")
    .eq("id", contactId)
    .maybeSingle();

  if (existingError || !existing) {
    return { contact: null, error: "איש קשר לא נמצא." };
  }

  const { data, error } = await client
    .from(CONTACTS_TABLE)
    .update(buildContactInsertRow(input))
    .eq("id", contactId)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[contacts-server] update failed:", error?.message);
    return {
      contact: null,
      error: error?.message ?? "עדכון איש קשר נכשל.",
    };
  }

  const contact = mapContactRow(data as Record<string, unknown>);
  return contact
    ? { contact, error: null }
    : { contact: null, error: "עדכון איש קשר נכשל." };
}

export async function deleteContact(
  contactId: string
): Promise<{ ok: boolean; error: string | null; projectCount?: number }> {
  if (!isContactId(contactId)) {
    return { ok: false, error: "מזהה איש קשר לא תקין." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const projectCount = await countContactProjectRelations(contactId);
  if (projectCount > 0) {
    return {
      ok: false,
      error: `איש הקשר משויך ל-${projectCount} פרויקטים.`,
      projectCount,
    };
  }

  const { data: existing, error: existingError } = await client
    .from(CONTACTS_TABLE)
    .select("id")
    .eq("id", contactId)
    .maybeSingle();

  if (existingError || !existing) {
    return { ok: false, error: "איש קשר לא נמצא." };
  }

  const { error } = await client.from(CONTACTS_TABLE).delete().eq("id", contactId);

  if (error) {
    console.warn("[contacts-server] delete failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}
