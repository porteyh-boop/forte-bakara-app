import type { BuildingContact, BuildingContactInput } from "./building-contacts";
import { isPilotCloudConfigured } from "./pilot-cloud";

const BUILDING_CONTACTS_API = "/forte/api/building-contacts";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  contacts?: BuildingContact[];
  error?: string | null;
}

interface ContactResponse {
  contact?: BuildingContact | null;
  error?: string | null;
}

interface DeleteResponse {
  ok?: boolean;
  error?: string | null;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload & {
      error?: string | null;
    };
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

export function isBuildingContactsConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function listBuildingContacts(
  buildingId: string
): Promise<{ contacts: BuildingContact[]; error: string | null }> {
  if (!isBuildingContactsConfigured()) {
    return { contacts: [], error: "Supabase לא מוגדר." };
  }

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await fetch(`${BUILDING_CONTACTS_API}?${params.toString()}`, {
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

export async function createBuildingContact(
  buildingId: string,
  input: BuildingContactInput
): Promise<{ contact: BuildingContact | null; error: string | null }> {
  if (!isBuildingContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(BUILDING_CONTACTS_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingId, input }),
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

export async function updateBuildingContact(
  contactId: string,
  buildingId: string,
  input: BuildingContactInput
): Promise<{ contact: BuildingContact | null; error: string | null }> {
  if (!isBuildingContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(
      `${BUILDING_CONTACTS_API}/${encodeURIComponent(contactId)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, input }),
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

export async function deleteBuildingContact(
  contactId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isBuildingContactsConfigured()) {
    return { ok: false, error: "Supabase לא מוגדר." };
  }

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await fetch(
      `${BUILDING_CONTACTS_API}/${encodeURIComponent(contactId)}?${params.toString()}`,
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
      };
    }

    return { ok: Boolean(payload.ok), error: payload.error ?? null };
  } catch {
    return { ok: false, error: "מחיקה נכשלה." };
  }
}
