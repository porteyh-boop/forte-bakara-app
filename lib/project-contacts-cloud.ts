import type { ContactInput, ProjectContactWithDetails } from "./contacts";
import { isPilotCloudConfigured } from "./pilot-cloud";

const PROJECT_CONTACTS_API = "/forte/api/project-contacts";

interface ApiErrorPayload {
  error?: string;
}

interface ListResponse {
  contacts?: ProjectContactWithDetails[];
  error?: string | null;
}

interface ContactResponse {
  contact?: ProjectContactWithDetails | null;
  error?: string | null;
}

interface BatchAttachResponse {
  attached?: ProjectContactWithDetails[];
  skipped?: string[];
  error?: string | null;
}

interface DeleteResponse {
  ok?: boolean;
  error?: string | null;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    if (payload.error === "unauthorized") {
      return "נדרש אימות מחדש. הזינו שוב את קוד הגישה.";
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
  return "פעולה נכשלה.";
}

export function isProjectContactsConfigured(): boolean {
  return isPilotCloudConfigured();
}

export async function listProjectContacts(
  buildingId: string
): Promise<{ contacts: ProjectContactWithDetails[]; error: string | null }> {
  if (!isProjectContactsConfigured()) {
    return { contacts: [], error: "Supabase לא מוגדר." };
  }

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await fetch(`${PROJECT_CONTACTS_API}?${params.toString()}`, {
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
    return { contacts: [], error: "טעינת אנשי קשר לפרויקט נכשלה." };
  }
}

export async function attachContactsToProject(
  buildingId: string,
  contactIds: string[]
): Promise<{
  attached: ProjectContactWithDetails[];
  skipped: string[];
  error: string | null;
}> {
  if (!isProjectContactsConfigured()) {
    return { attached: [], skipped: contactIds, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(PROJECT_CONTACTS_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingId, contactIds }),
    });

    const payload = (await response.json()) as BatchAttachResponse;
    if (!response.ok) {
      return {
        attached: payload.attached ?? [],
        skipped: payload.skipped ?? contactIds,
        error: payload.error ?? (await parseApiError(response)),
      };
    }

    return {
      attached: payload.attached ?? [],
      skipped: payload.skipped ?? [],
      error: payload.error ?? null,
    };
  } catch {
    return {
      attached: [],
      skipped: contactIds,
      error: "שיוך אנשי קשר לפרויקט נכשל.",
    };
  }
}

export async function createProjectContact(
  buildingId: string,
  input: ContactInput,
  options?: { projectRole?: string; isPrimary?: boolean }
): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  if (!isProjectContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(PROJECT_CONTACTS_API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        buildingId,
        input,
        projectRole: options?.projectRole,
        isPrimary: options?.isPrimary,
      }),
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

export async function updateProjectContactRelation(
  relationId: string,
  buildingId: string,
  patch: { projectRole?: string; isPrimary?: boolean }
): Promise<{ contact: ProjectContactWithDetails | null; error: string | null }> {
  if (!isProjectContactsConfigured()) {
    return { contact: null, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(
      `${PROJECT_CONTACTS_API}/${encodeURIComponent(relationId)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId, ...patch }),
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
    return { contact: null, error: "עדכון שיוך נכשל." };
  }
}

export async function removeContactFromProject(
  relationId: string,
  buildingId: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!isProjectContactsConfigured()) {
    return { ok: false, error: "Supabase לא מוגדר." };
  }

  try {
    const params = new URLSearchParams({ buildingId });
    const response = await fetch(
      `${PROJECT_CONTACTS_API}/${encodeURIComponent(relationId)}?${params.toString()}`,
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
    return { ok: false, error: "הסרה מהפרויקט נכשלה." };
  }
}
