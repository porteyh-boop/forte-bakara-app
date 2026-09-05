import { createHash } from "crypto";
import {
  consumeRateLimitBucket,
  isPublicFormDwellTooShort,
  parsePublicFormStartedAt,
  parsePublicSalesLeadFormBody,
  parsePublicSalesLeadIdempotencyKey,
  preferredContactToNextAction,
  publicFormPayloadHash,
  readIdempotencyRecord,
  rememberIdempotencyRecord,
  validatePublicSalesLeadFormInput,
  type IdempotencyRecord,
  type RateLimitBucket,
} from "@/lib/sales-lead-public-form";
import {
  buildPublicSalesLeadSubmitRpcArgs,
  parsePublicSalesLeadSubmitRpcResult,
  PUBLIC_SALES_LEAD_SUBMIT_RPC,
} from "@/lib/sales-lead-public-form-submit";
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

  if (!isSupabaseServiceConfigured()) {
    return { ok: false, status: 503, error: "service_unavailable" };
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    return { ok: false, status: 503, error: "service_unavailable" };
  }

  const { data, error } = await client.rpc(
    PUBLIC_SALES_LEAD_SUBMIT_RPC,
    buildPublicSalesLeadSubmitRpcArgs({
      key,
      payloadHash,
      form: parsed.input,
      nextAction: preferredContactToNextAction(parsed.input.preferredContactAt),
      ipHash: ipKey,
    })
  );

  if (error) {
    const message = error.message || "";
    if (message.includes("idempotency_conflict")) {
      return { ok: false, status: 409, error: "idempotency_conflict" };
    }
    if (
      message.includes("missing_client_name") ||
      message.includes("missing_contact_name") ||
      message.includes("missing_phone") ||
      message.includes("missing_service_type_other") ||
      message.includes("invalid_request")
    ) {
      return { ok: false, status: 400, error: "invalid_request" };
    }
    console.error("[sales-lead-public-form] submit RPC failed", error.message);
    return { ok: false, status: 502, error: "save_failed" };
  }

  const parsedResult = parsePublicSalesLeadSubmitRpcResult(data);
  if (!parsedResult) {
    return { ok: false, status: 502, error: "save_failed" };
  }

  rememberIdempotencyRecord(memoryIdempotency, key, payloadHash, nowMs);
  return { ok: true, status: 200, error: null };
}

export function resetPublicSalesLeadFormMemoryForTests(): void {
  memoryRateLimit.clear();
  memoryIdempotency.clear();
}
