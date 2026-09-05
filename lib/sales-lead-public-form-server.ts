import { createHash } from "crypto";
import {
  consumeRateLimitBucket,
  findOpenMatchingSalesLead,
  isPublicFormDwellTooShort,
  mapPublicFormToCreateDraft,
  mapPublicFormToUpdateDraft,
  parsePublicFormStartedAt,
  parsePublicSalesLeadFormBody,
  parsePublicSalesLeadIdempotencyKey,
  publicFormPayloadHash,
  readIdempotencyRecord,
  rememberIdempotencyRecord,
  validatePublicSalesLeadFormInput,
  type IdempotencyRecord,
  type PublicSalesLeadFormInput,
  type RateLimitBucket,
} from "@/lib/sales-lead-public-form";
import {
  createSalesLeadServer,
  listSalesLeadsServer,
  updateSalesLeadServer,
} from "@/lib/sales-leads-server";
import {
  getSupabaseServiceClient,
  isSupabaseServiceConfigured,
} from "@/lib/supabase-server";

export const SALES_LEAD_FORM_SUBMISSIONS_TABLE = "sales_lead_form_submissions";

const memoryRateLimit = new Map<string, RateLimitBucket>();
const memoryIdempotency = new Map<string, IdempotencyRecord>();

export type PublicSalesLeadSubmitResult = {
  ok: boolean;
  status: number;
  error: string | null;
};

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function getPublicFormClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

async function readDurableIdempotency(
  key: string,
  payloadHash: string
): Promise<"miss" | "replay" | "conflict"> {
  const client = getSupabaseServiceClient();
  if (!client) return "miss";
  const { data, error } = await client
    .from(SALES_LEAD_FORM_SUBMISSIONS_TABLE)
    .select("idempotency_key, payload_hash")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error || !data) return "miss";
  const storedHash = String(
    (data as Record<string, unknown>).payload_hash ?? ""
  );
  return storedHash === payloadHash ? "replay" : "conflict";
}

async function persistDurableIdempotency(input: {
  key: string;
  payloadHash: string;
  leadId: string;
  ipHash: string;
}): Promise<void> {
  const client = getSupabaseServiceClient();
  if (!client) return;
  const { error } = await client.from(SALES_LEAD_FORM_SUBMISSIONS_TABLE).insert({
    idempotency_key: input.key,
    payload_hash: input.payloadHash,
    lead_id: input.leadId,
    ip_hash: input.ipHash,
  });
  if (error && !error.message.toLowerCase().includes("duplicate")) {
    console.error(
      "[sales-lead-public-form] idempotency persist failed",
      error.message
    );
  }
}

async function countRecentSubmissions(ipHash: string, sinceIso: string) {
  const client = getSupabaseServiceClient();
  if (!client) return 0;
  const { count, error } = await client
    .from(SALES_LEAD_FORM_SUBMISSIONS_TABLE)
    .select("idempotency_key", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

export async function submitPublicSalesLeadForm(input: {
  body: unknown;
  idempotencyKey: unknown;
  startedAt: unknown;
  clientIp: string;
  now?: Date;
}): Promise<PublicSalesLeadSubmitResult> {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  const key = parsePublicSalesLeadIdempotencyKey(input.idempotencyKey);
  if (!key) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const parsed = parsePublicSalesLeadFormBody(input.body);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }
  if (parsed.honeypotFilled) {
    return { ok: true, status: 200, error: null };
  }

  const ipKey = hashIp(input.clientIp || "unknown");
  if (consumeRateLimitBucket(memoryRateLimit, ipKey, nowMs)) {
    return { ok: false, status: 429, error: "rate_limited" };
  }

  if (isPublicFormDwellTooShort(parsePublicFormStartedAt(input.startedAt), nowMs)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const validationError = validatePublicSalesLeadFormInput(parsed.input);
  if (validationError) {
    return { ok: false, status: 400, error: validationError };
  }
  const recent = await countRecentSubmissions(
    ipKey,
    new Date(nowMs - 10 * 60 * 1000).toISOString()
  );
  if (recent >= 5) {
    return { ok: false, status: 429, error: "rate_limited" };
  }

  const payloadHash = publicFormPayloadHash(parsed.input);
  const memoryState = readIdempotencyRecord(
    memoryIdempotency,
    key,
    payloadHash,
    nowMs
  );
  if (memoryState === "replay") {
    return { ok: true, status: 200, error: null };
  }
  if (memoryState === "conflict") {
    return { ok: false, status: 409, error: "idempotency_conflict" };
  }

  const durableState = await readDurableIdempotency(key, payloadHash);
  if (durableState === "replay") {
    rememberIdempotencyRecord(memoryIdempotency, key, payloadHash, nowMs);
    return { ok: true, status: 200, error: null };
  }
  if (durableState === "conflict") {
    return { ok: false, status: 409, error: "idempotency_conflict" };
  }

  if (!isSupabaseServiceConfigured()) {
    return { ok: false, status: 503, error: "service_unavailable" };
  }

  const listed = await listSalesLeadsServer();
  if (listed.error) {
    return { ok: false, status: 502, error: "save_failed" };
  }

  const matchId = findOpenMatchingSalesLead(listed.leads, parsed.input);
  const saved = matchId
    ? await updateMatchedLead(matchId, parsed.input, listed.leads, now)
    : await createSalesLeadServer(mapPublicFormToCreateDraft(parsed.input), now);

  if (saved.error || !saved.lead) {
    const status =
      saved.error === "supabase_service_unconfigured"
        ? 503
        : saved.error === "not_found"
          ? 502
          : typeof saved.error === "string" &&
              saved.error !== "save_failed" &&
              saved.error !== "invalid_request"
            ? 400
            : 502;
    return {
      ok: false,
      status,
      error:
        typeof saved.error === "string" && saved.error !== "save_failed"
          ? saved.error
          : "save_failed",
    };
  }

  rememberIdempotencyRecord(memoryIdempotency, key, payloadHash, nowMs);
  await persistDurableIdempotency({
    key,
    payloadHash,
    leadId: saved.lead.id,
    ipHash: ipKey,
  });

  return { ok: true, status: 200, error: null };
}

async function updateMatchedLead(
  leadId: string,
  input: PublicSalesLeadFormInput,
  leads: Awaited<ReturnType<typeof listSalesLeadsServer>>["leads"],
  now: Date
) {
  const existing = leads.find((lead) => lead.id === leadId);
  if (!existing) {
    return createSalesLeadServer(mapPublicFormToCreateDraft(input), now);
  }
  return updateSalesLeadServer(
    leadId,
    mapPublicFormToUpdateDraft(input, existing),
    now
  );
}

export function resetPublicSalesLeadFormMemoryForTests(): void {
  memoryRateLimit.clear();
  memoryIdempotency.clear();
}
