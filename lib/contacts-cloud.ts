import type { Contact, ContactInput } from "./contacts";
import { isPilotCloudConfigured } from "./pilot-cloud";

const CONTACTS_API = "/forte/api/contacts";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  contacts?: Contact[];
  error?: string | null;
}

interface ContactResponse {
  contact?: Contact | null;
  error?: string | null;
  projectCount?: number;
}

interface DeleteResponse {
  ok?: boolean;
  error?: string | null;
  projectCount?: number;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (payload.error === "unauthorized") {
      return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
    }
    if (payload.error === "supabase_service_unconfigured") {
      return "Supabase Service Role לא מוגדר בשרת.";
    }
    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    /* ignore */
  }

  if (response.status === 401) {
    return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
  }
  if (response.status === 503) {
    return "שירות אנשי קשר אינו זמין כרגע.";
  }
  return "פעולה נכשלה.";
}

export function isContactsConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function listContacts(): Promise<{
  contacts: Contact[];
  error: string | null;
}> {
  if (!isContactsConfigured()) {
    return { contacts: [], error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(CONTACTS_API, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const payload = (await response.json()) as ListResponse;
    if (!response.ok) {
      return {
        contacts: [],
        error: payload.error ?? (await parseApiError(response)),
      };
    }

    return {
      contacts: payload.contacts ?? [],
      error: payload.error ?? null,
    };
  } catch {
    return { contacts: [], error: "טעינת אנשי קשר נכשלה." };
  }
}

export async function createContact(
  input: ContactInput
): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(CONTACTS_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    });

    const payload = (await response.json()) as ContactResponse;
    if (!response.ok) {
      return {
        contact: null,
        error: payload.error ?? (await parseApiError(response)),
      };
    }

    return {
      contact: payload.contact ?? null,
      error: payload.error ?? null,
    };
  } catch {
    return { contact: null, error: "שמירת איש קשר נכשלה." };
  }
}

export async function updateContact(
  contactId: string,
  input: ContactInput
): Promise<{ contact: Contact | null; error: string | null }> {
  if (!isContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(
      `${CONTACTS_API}/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      }
    );

    const payload = (await response.json()) as ContactResponse;
    if (!response.ok) {
      return {
        contact: null,
        error: payload.error ?? (await parseApiError(response)),
      };
    }

    return {
      contact: payload.contact ?? null,
      error: payload.error ?? null,
    };
  } catch {
    return { contact: null, error: "עדכון איש קשר נכשל." };
  }
}

export async function deleteContact(
  contactId: string
): Promise<{ ok: boolean; error: string | null; projectCount?: number }> {
  if (!isContactsConfigured()) {
    return { ok: false, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(
      `${CONTACTS_API}/${encodeURIComponent(contactId)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const payload = (await response.json()) as DeleteResponse;
    if (!response.ok) {
      return {
        ok: false,
        error: payload.error ?? (await parseApiError(response)),
        projectCount: payload.projectCount,
      };
    }

    return {
      ok: Boolean(payload.ok),
      error: payload.error ?? null,
      projectCount: payload.projectCount,
    };
  } catch {
    return { ok: false, error: "מחיקה נכשלה." };
  }
}
