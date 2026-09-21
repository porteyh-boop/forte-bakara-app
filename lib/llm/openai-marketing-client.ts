import {
  isOpenAiConfigured,
  resolveOpenAiApiKey,
  resolveOpenAiMarketingModel,
} from "@/lib/llm/openai-config";
import {
  MARKETING_POSTS_BATCH_JSON_SCHEMA,
  type OpenAiMarketingBatchResponse,
} from "@/lib/llm/openai-marketing-schema";

export type OpenAiMarketingClientError =
  | "openai_not_configured"
  | "openai_request_failed"
  | "openai_invalid_response";

export type OpenAiFetch = typeof fetch;

const RESPONSES_URL = "https://api.openai.com/v1/responses";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

/** Safe diagnostics — never logs API keys or Authorization. */
export function logOpenAiMarketingError(httpStatus: number, body: unknown): void {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : root;
  const code = asString(nested.code).trim() || asString(nested.type).trim() || "unknown";
  const message = asString(nested.message).trim().slice(0, 500) || "request_failed";
  console.warn("[openai-marketing] openai_error", {
    httpStatus,
    code,
    message,
  });
}

/** Extract JSON text from a Responses API payload (output_text or output[].message). */
export function extractResponsesOutputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;

  const direct = asString(root.output_text).trim();
  if (direct) return direct;

  const output = root.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (asString(rec.type) !== "message") continue;
    const content = rec.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const block = part as Record<string, unknown>;
      if (asString(block.type) === "refusal") return null;
      if (asString(block.type) === "output_text") {
        const text = asString(block.text).trim();
        if (text) return text;
      }
    }
  }

  return null;
}

export async function requestMarketingPostsBatchFromOpenAi(input: {
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: OpenAiFetch;
}): Promise<{
  batch: OpenAiMarketingBatchResponse | null;
  error: OpenAiMarketingClientError | null;
}> {
  if (!isOpenAiConfigured()) {
    return { batch: null, error: "openai_not_configured" };
  }

  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) return { batch: null, error: "openai_not_configured" };

  const fetchImpl = input.fetchImpl ?? fetch;
  const model = resolveOpenAiMarketingModel();

  const requestBody = {
    model,
    input: [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: MARKETING_POSTS_BATCH_JSON_SCHEMA.name,
        strict: MARKETING_POSTS_BATCH_JSON_SCHEMA.strict,
        schema: MARKETING_POSTS_BATCH_JSON_SCHEMA.schema,
      },
    },
  };

  let response: Response;
  try {
    response = await fetchImpl(RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.warn("[openai-marketing] network_error", {
      message: err instanceof Error ? err.message.slice(0, 200) : "fetch_failed",
    });
    return { batch: null, error: "openai_request_failed" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    logOpenAiMarketingError(response.status, null);
    return { batch: null, error: "openai_invalid_response" };
  }

  if (!response.ok) {
    logOpenAiMarketingError(response.status, payload);
    return { batch: null, error: "openai_request_failed" };
  }

  const status = asString((payload as Record<string, unknown>).status);
  if (status && status !== "completed") {
    logOpenAiMarketingError(response.status, payload);
    return { batch: null, error: "openai_request_failed" };
  }

  const content = extractResponsesOutputText(payload);
  if (!content) {
    console.warn("[openai-marketing] missing_output_text", { httpStatus: response.status });
    return { batch: null, error: "openai_invalid_response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { batch: null, error: "openai_invalid_response" };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("posts" in parsed) ||
    !Array.isArray((parsed as OpenAiMarketingBatchResponse).posts)
  ) {
    return { batch: null, error: "openai_invalid_response" };
  }

  return { batch: parsed as OpenAiMarketingBatchResponse, error: null };
}
