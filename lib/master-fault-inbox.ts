import { isPilotCloudConfigured } from "./pilot-cloud";

export const MASTER_FAULT_INBOX_TABLE = "master_fault_inbox";

const MASTER_FAULT_INBOX_API = "/forte/api/master-fault-inbox";

export interface MasterFaultInboxRecord {
  id: string;
  fault_id: string;
  building_id: string;
  created_at: string;
  read_at: string | null;
}

export interface MasterFaultInboxItem extends MasterFaultInboxRecord {
  building_name: string;
  elevator_name: string | null;
  fault_type: string;
  description: string;
  status: string;
  ticket_number: string | null;
  fault_created_at: string;
}

export function mapMasterFaultInboxRow(
  row: Record<string, unknown>
): MasterFaultInboxRecord | null {
  if (!row.id || !row.fault_id || !row.building_id) return null;

  return {
    id: String(row.id),
    fault_id: String(row.fault_id),
    building_id: String(row.building_id),
    created_at: String(row.created_at ?? new Date().toISOString()),
    read_at: row.read_at ? String(row.read_at) : null,
  };
}

export function isMasterFaultInboxUnread(item: MasterFaultInboxRecord): boolean {
  return item.read_at == null;
}

export async function listMasterFaultInboxItems(options?: {
  unreadOnly?: boolean;
}): Promise<{ items: MasterFaultInboxItem[]; error: string | null }> {
  if (!isPilotCloudConfigured()) {
    return { items: [], error: "Supabase לא מוגדר." };
  }

  try {
    const params = new URLSearchParams();
    if (options?.unreadOnly) params.set("unreadOnly", "1");

    const url = params.toString()
      ? `${MASTER_FAULT_INBOX_API}?${params.toString()}`
      : MASTER_FAULT_INBOX_API;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const payload = (await response.json()) as {
      items?: MasterFaultInboxItem[];
      error?: string | null;
    };

    if (!response.ok) {
      return {
        items: [],
        error: payload.error ?? `request_failed_${response.status}`,
      };
    }

    return { items: payload.items ?? [], error: null };
  } catch (error) {
    return {
      items: [],
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}

export async function markMasterFaultInboxRead(input: {
  inboxId?: string;
  faultId?: string;
}): Promise<{ ok: boolean; error: string | null }> {
  if (!isPilotCloudConfigured()) {
    return { ok: false, error: "Supabase לא מוגדר." };
  }

  try {
    const response = await fetch(`${MASTER_FAULT_INBOX_API}/read`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string | null;
    };

    if (!response.ok) {
      return { ok: false, error: payload.error ?? `request_failed_${response.status}` };
    }

    return { ok: Boolean(payload.ok), error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}

export function formatMasterFaultInboxTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function summarizeMasterFaultInboxDescription(
  description: string,
  maxLength = 120
): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export const MASTER_FAULT_INBOX_POPUP_DISMISS_PREFIX =
  "forte-fault-inbox-popup-dismissed:";

export function isMasterFaultInboxPopupDismissed(faultId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      sessionStorage.getItem(
        `${MASTER_FAULT_INBOX_POPUP_DISMISS_PREFIX}${faultId}`
      ) === "1"
    );
  } catch {
    return false;
  }
}

export function dismissMasterFaultInboxPopup(faultId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `${MASTER_FAULT_INBOX_POPUP_DISMISS_PREFIX}${faultId}`,
      "1"
    );
  } catch {
    /* ignore */
  }
}

function inboxItemSortTime(item: MasterFaultInboxItem): number {
  const iso = item.fault_created_at || item.created_at;
  return new Date(iso).getTime();
}

/** Inbox rows that were not present in the previous snapshot (by inbox id or fault_id). */
export function findNewMasterFaultInboxItems(
  previousItems: MasterFaultInboxItem[],
  nextItems: MasterFaultInboxItem[]
): MasterFaultInboxItem[] {
  const knownInboxIds = new Set(previousItems.map((item) => item.id));
  const knownFaultIds = new Set(previousItems.map((item) => item.fault_id));

  return nextItems.filter(
    (item) =>
      !knownInboxIds.has(item.id) && !knownFaultIds.has(item.fault_id)
  );
}

/** Latest unread inbox row eligible for popup (not session-dismissed). */
export function pickMasterFaultInboxPopupItem(
  candidates: MasterFaultInboxItem[]
): MasterFaultInboxItem | null {
  const eligible = candidates
    .filter(isMasterFaultInboxUnread)
    .filter((item) => !isMasterFaultInboxPopupDismissed(item.fault_id));

  if (eligible.length === 0) return null;

  return [...eligible].sort(
    (a, b) => inboxItemSortTime(b) - inboxItemSortTime(a)
  )[0];
}

/** First-load re-entry: earliest eligible unread in list order. */
export function pickFirstLoadMasterFaultInboxPopupItem(
  items: MasterFaultInboxItem[]
): MasterFaultInboxItem | null {
  for (const item of items) {
    if (
      isMasterFaultInboxUnread(item) &&
      !isMasterFaultInboxPopupDismissed(item.fault_id)
    ) {
      return item;
    }
  }
  return null;
}
