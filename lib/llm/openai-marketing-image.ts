import { resolveOpenAiApiKey } from "@/lib/llm/openai-config";

export const DEFAULT_OPENAI_IMAGE_MODEL =
  process.env.FORTE_OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";

export type OpenAiImageClientError =
  | "openai_not_configured"
  | "openai_request_failed"
  | "openai_invalid_response";

export type OpenAiImageFetch = typeof fetch;

const IMAGES_URL = "https://api.openai.com/v1/images/generations";

const BRAND_GUARDRAILS =
  "Professional commercial photograph for residential building elevator context. " +
  "Shared residential building / vaad bayit setting, modern clean trustworthy style. " +
  "Realistic, well-lit, suitable for Facebook and Instagram marketing. " +
  "No brand names, no company logos, no property management companies, no elevator company logos, " +
  "no trademarks, no Hebrew or any text in the image, no phone numbers, " +
  "no contact details, no accident or danger scenes, no gore.";

export function buildMarketingImagePrompt(visualPromptHe: string): string {
  const core = visualPromptHe.trim();
  return `${BRAND_GUARDRAILS}\n\nScene (Hebrew brief for context only — do not render text):\n${core}`;
}

/** Parse gpt-image-1 /v1/images/generations success payload. */
export function pngBufferFromImagesGenerationsPayload(
  payload: unknown
): Buffer | null {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0];
  if (!first || typeof first !== "object") return null;
  const item = first as Record<string, unknown>;

  const b64 = item.b64_json;
  if (typeof b64 === "string" && b64.trim()) {
    try {
      const pngBuffer = Buffer.from(b64, "base64");
      if (pngBuffer.length >= 100) return pngBuffer;
    } catch {
      return null;
    }
  }

  return null;
}

export function logOpenAiImageError(httpStatus: number, body: unknown): void {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : root;
  const code =
    typeof nested.code === "string"
      ? nested.code
      : typeof nested.type === "string"
        ? nested.type
        : "unknown";
  const message =
    typeof nested.message === "string" ? nested.message.slice(0, 500) : "request_failed";
  console.warn("[openai-marketing-image] openai_error", {
    httpStatus,
    code,
    message,
  });
}

export async function generateMarketingImagePngServer(input: {
  visualPromptHe: string;
  fetchImpl?: OpenAiImageFetch;
}): Promise<{ pngBuffer: Buffer | null; error: OpenAiImageClientError | null }> {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) return { pngBuffer: null, error: "openai_not_configured" };

  const fetchImpl = input.fetchImpl ?? fetch;
  const model = DEFAULT_OPENAI_IMAGE_MODEL;

  let response: Response;
  try {
    response = await fetchImpl(IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: buildMarketingImagePrompt(input.visualPromptHe),
        n: 1,
        size: "1536x1024",
      }),
    });
  } catch (err) {
    console.warn("[openai-marketing-image] network_error", {
      message: err instanceof Error ? err.message.slice(0, 200) : "fetch_failed",
    });
    return { pngBuffer: null, error: "openai_request_failed" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    logOpenAiImageError(response.status, null);
    return { pngBuffer: null, error: "openai_invalid_response" };
  }

  if (!response.ok) {
    logOpenAiImageError(response.status, payload);
    return { pngBuffer: null, error: "openai_request_failed" };
  }

  const pngBuffer = pngBufferFromImagesGenerationsPayload(payload);
  if (!pngBuffer) {
    return { pngBuffer: null, error: "openai_invalid_response" };
  }
  return { pngBuffer, error: null };
}

/** For meta_payload — text model name kept separate from image model. */
export function marketingImageModelLabel(): string {
  return DEFAULT_OPENAI_IMAGE_MODEL;
}

export function marketingImageProviderLabel(): string {
  return "openai";
}
