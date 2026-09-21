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

export type OpenAiChatFetch = typeof fetch;

export async function requestMarketingPostsBatchFromOpenAi(input: {
  systemPrompt: string;
  userPrompt: string;
  fetchImpl?: OpenAiChatFetch;
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

  let response: Response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: MARKETING_POSTS_BATCH_JSON_SCHEMA,
        },
        temperature: 0.7,
      }),
    });
  } catch {
    return { batch: null, error: "openai_request_failed" };
  }

  if (!response.ok) {
    return { batch: null, error: "openai_request_failed" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { batch: null, error: "openai_invalid_response" };
  }

  const content = extractMessageContent(payload);
  if (!content) return { batch: null, error: "openai_invalid_response" };

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

function extractMessageContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}
