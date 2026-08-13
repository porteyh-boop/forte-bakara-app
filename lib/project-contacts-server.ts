import { normalizeBuildingId } from "./buildings-cloud";
import {
  validateContactInput,
  type ContactInput,
  type ProjectContactWithDetails,
} from "./contacts";
import {
  CONTACTS_TABLE,
  createContact,
  findExistingContactByExactMatch,
  isContactId,
  PROJECT_CONTACTS_TABLE,
} from "./contacts-server";
import { assertBuildingExists } from "./building-contacts-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "./supabase-server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProjectContactId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function tableMissingMessage(errorMessage: string | undefined): string | null {
  if (!errorMessage) return null;
  if (
    (errorMessage.includes("project_contacts") ||
      errorMessage.includes("contacts")) &&
    (errorMessage.includes("does not exist") ||
      errorMessage.includes("Could not find"))
  ) {
    return "טבלאות אנשי קשר טרם הוגדרו ב-Supabase. הריצו את migration 024_central_contacts.sql.";
  }
  return null;
}

function mapProjectContactRow(
  row: Record<string, unknown>
): ProjectContactWithDetails | null {
  if (!row.id || !row.contact_id || !row.building_id) return null;
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    buildingId: String(row.building_id),
    projectRole: String(row.project_role ?? ""),
    isPrimary: Boolean(row.is_primary),
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

async function clearPrimaryProjectContacts(
  buildingId: string,
  exceptRelationId?: string
) {
  const client = getSupabaseServiceClient();
  if (!client) return false;

  let query = client
    .from(PROJECT_CONTACTS_TABLE)
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq("building_id", buildingId)
    .eq("is_primary", true);

  if (exceptRelationId) {
    query = query.neq("id", exceptRelationId);
  }

  const { error } = await query;
  return !error;
}

export async function listProjectContactsForBuilding(
  buildingId: string
): Promise<{ contacts: ProjectContactWithDetails[]; error: string | null }> {
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
    .from(PROJECT_CONTACTS_TABLE)
    .select(
      `
      id,
      contact_id,
      building_id,
      project_role,
      is_primary,
      created_at,
      updated_at,
      contacts (
        full_name,
        company,
        role_title,
        phone,
        email,
        notes
      )
    `
    )
    .eq("building_id", normalized)
    .order("is_primary", { ascending: false });

  if (error) {
    const message =
      tableMissingMessage(error.message) ?? "טעינת אנשי קשר לפרויקט נכשלה.";
    console.warn("[project-contacts-server] list failed:", error.message);
    return { contacts: [], error: message };
  }

  const contacts = (data ?? [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const contact = record.contacts as Record<string, unknown> | null;
      return mapProjectContactRow({
        ...record,
        full_name: contact?.full_name,
        company: contact?.company,
        role_title: contact?.role_title,
        phone: contact?.phone,
        email: contact?.email,
        notes: contact?.notes,
      });
    })
    .filter((row): row is ProjectContactWithDetails => row !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "he"));

  return { contacts, error: null };
}

export async function attachContactToProject(params: {
  buildingId: string;
  contactId: string;
  projectRole?: string;
  isPrimary?: boolean;
}): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  if (!isContactId(params.contactId)) {
    return { contact: null, error: "מזהה איש קשר לא תקין." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(params.buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { contact: null, error: "בניין לא נמצא." };
  }

  const { data: contactRow, error: contactError } = await client
    .from(CONTACTS_TABLE)
    .select("id")
    .eq("id", params.contactId)
    .maybeSingle();

  if (contactError || !contactRow) {
    return { contact: null, error: "איש קשר לא נמצא בספר." };
  }

  const { data: existingRelation } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .select("id")
    .eq("building_id", normalized)
    .eq("contact_id", params.contactId)
    .maybeSingle();

  if (existingRelation) {
    return { contact: null, error: "איש הקשר כבר משויך לפרויקט זה." };
  }

  if (params.isPrimary) {
    await clearPrimaryProjectContacts(normalized);
  }

  const now = new Date().toISOString();
  const { data, error } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .insert({
      contact_id: params.contactId,
      building_id: normalized,
      project_role: params.projectRole?.trim() ?? "",
      is_primary: params.isPrimary ?? false,
      updated_at: now,
    })
    .select(
      `
      id,
      contact_id,
      building_id,
      project_role,
      is_primary,
      created_at,
      updated_at,
      contacts (
        full_name,
        company,
        role_title,
        phone,
        email,
        notes
      )
    `
    )
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { contact: null, error: "איש הקשר כבר משויך לפרויקט זה." };
    }
    console.warn("[project-contacts-server] attach failed:", error?.message);
    return {
      contact: null,
      error: error?.message ?? "שיוך איש קשר לפרויקט נכשל.",
    };
  }

  const record = data as Record<string, unknown>;
  const contact = record.contacts as Record<string, unknown> | null;
  const mapped = mapProjectContactRow({
    ...record,
    full_name: contact?.full_name,
    company: contact?.company,
    role_title: contact?.role_title,
    phone: contact?.phone,
    email: contact?.email,
    notes: contact?.notes,
  });

  return mapped
    ? { contact: mapped, error: null }
    : { contact: null, error: "שיוך איש קשר לפרויקט נכשל." };
}

export async function attachContactsToProject(params: {
  buildingId: string;
  contactIds: string[];
}): Promise<{
  attached: ProjectContactWithDetails[];
  skipped: string[];
  error: string | null;
}> {
  const attached: ProjectContactWithDetails[] = [];
  const skipped: string[] = [];

  for (const contactId of params.contactIds) {
    const result = await attachContactToProject({
      buildingId: params.buildingId,
      contactId,
    });
    if (result.contact) {
      attached.push(result.contact);
    } else {
      skipped.push(contactId);
    }
  }

  if (attached.length === 0 && params.contactIds.length > 0) {
    return {
      attached,
      skipped,
      error: "לא ניתן לצרף אנשי קשר לפרויקט.",
    };
  }

  return { attached, skipped, error: null };
}

export async function createContactAndAttachToProject(params: {
  buildingId: string;
  input: ContactInput;
  projectRole?: string;
  isPrimary?: boolean;
}): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  const existing = await findExistingContactByExactMatch(params.input);
  if (existing) {
    return attachContactToProject({
      buildingId: params.buildingId,
      contactId: existing.id,
      projectRole: params.projectRole,
      isPrimary: params.isPrimary,
    });
  }

  const created = await createContact(params.input);
  if (!created.contact) {
    return { contact: null, error: created.error };
  }

  return attachContactToProject({
    buildingId: params.buildingId,
    contactId: created.contact.id,
    projectRole: params.projectRole,
    isPrimary: params.isPrimary,
  });
}

export async function updateProjectContactRelation(params: {
  relationId: string;
  buildingId: string;
  projectRole?: string;
  isPrimary?: boolean;
}): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  if (!isProjectContactId(params.relationId)) {
    return { contact: null, error: "מזהה שיוך לא תקין." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { contact: null, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(params.buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { contact: null, error: "בניין לא נמצא." };
  }

  const { data: existing, error: existingError } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .select("id")
    .eq("id", params.relationId)
    .eq("building_id", normalized)
    .maybeSingle();

  if (existingError || !existing) {
    return { contact: null, error: "שיוך לא נמצא." };
  }

  if (params.isPrimary) {
    await clearPrimaryProjectContacts(normalized, params.relationId);
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.projectRole !== undefined) {
    patch.project_role = params.projectRole.trim();
  }
  if (params.isPrimary !== undefined) {
    patch.is_primary = params.isPrimary;
  }

  const { data, error } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .update(patch)
    .eq("id", params.relationId)
    .eq("building_id", normalized)
    .select(
      `
      id,
      contact_id,
      building_id,
      project_role,
      is_primary,
      created_at,
      updated_at,
      contacts (
        full_name,
        company,
        role_title,
        phone,
        email,
        notes
      )
    `
    )
    .single();

  if (error || !data) {
    console.warn("[project-contacts-server] update relation failed:", error?.message);
    return {
      contact: null,
      error: error?.message ?? "עדכון שיוך נכשל.",
    };
  }

  const record = data as Record<string, unknown>;
  const contact = record.contacts as Record<string, unknown> | null;
  const mapped = mapProjectContactRow({
    ...record,
    full_name: contact?.full_name,
    company: contact?.company,
    role_title: contact?.role_title,
    phone: contact?.phone,
    email: contact?.email,
    notes: contact?.notes,
  });

  return mapped
    ? { contact: mapped, error: null }
    : { contact: null, error: "עדכון שיוך נכשל." };
}

export async function removeContactFromProject(params: {
  relationId: string;
  buildingId: string;
}): Promise<{ ok: boolean; error: string | null }> {
  if (!isProjectContactId(params.relationId)) {
    return { ok: false, error: "מזהה שיוך לא תקין." };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: "Supabase Service Role לא מוגדר בשרת." };
  }

  const normalized = normalizeBuildingId(params.buildingId);
  if (!(await assertBuildingExists(normalized))) {
    return { ok: false, error: "בניין לא נמצא." };
  }

  const { data: existing, error: existingError } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .select("id")
    .eq("id", params.relationId)
    .eq("building_id", normalized)
    .maybeSingle();

  if (existingError || !existing) {
    return { ok: false, error: "שיוך לא נמצא." };
  }

  const { error } = await client
    .from(PROJECT_CONTACTS_TABLE)
    .delete()
    .eq("id", params.relationId)
    .eq("building_id", normalized);

  if (error) {
    console.warn("[project-contacts-server] remove failed:", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

export function parseProjectContactUpdateInput(
  body: unknown
): { projectRole?: string; isPrimary?: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  return {
    ...(record.projectRole !== undefined
      ? { projectRole: String(record.projectRole) }
      : {}),
    ...(record.isPrimary !== undefined
      ? { isPrimary: Boolean(record.isPrimary) }
      : {}),
  };
}

export function parseAttachContactsBody(body: unknown): {
  buildingId: string;
  contactIds: string[];
} | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const buildingId =
    typeof record.buildingId === "string" ? record.buildingId : "";
  const contactIds = Array.isArray(record.contactIds)
    ? record.contactIds.filter((id): id is string => typeof id === "string")
    : typeof record.contactId === "string"
      ? [record.contactId]
      : [];
  if (!buildingId || contactIds.length === 0) return null;
  return { buildingId, contactIds };
}

export async function createContactAndAttachFromBody(params: {
  buildingId: string;
  input: ContactInput;
  projectRole?: string;
  isPrimary?: boolean;
}): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  const validationError = validateContactInput(params.input);
  if (validationError) {
    return { contact: null, error: validationError };
  }
  return createContactAndAttachToProject(params);
}
