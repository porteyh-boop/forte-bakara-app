export const DEFAULT_OPENAI_MARKETING_MODEL = "gpt-5.4-mini";

export function resolveOpenAiApiKey(): string | null {
  const key =
    process.env.FORTE_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  return key.length > 0 ? key : null;
}

export function resolveOpenAiMarketingModel(): string {
  return (
    process.env.FORTE_OPENAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MARKETING_MODEL
  );
}

export function isOpenAiConfigured(): boolean {
  return resolveOpenAiApiKey() !== null;
}
