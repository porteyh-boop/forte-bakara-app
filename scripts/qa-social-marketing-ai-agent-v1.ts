/**
 * FORTE AI Marketing Agent — unit + static QA (no live OpenAI / Facebook).
 * Run: npx tsx scripts/qa-social-marketing-ai-agent-v1.ts
 */
import fs from "fs";
import path from "path";
import { actionTypeRequiresApproval } from "../lib/forte-ai-marketing";
import {
  validateMarketingPostDrafts,
  type MarketingBatchGenerator,
} from "../lib/social-marketing/social-marketing-agent";
import type { OpenAiMarketingPostDraft } from "../lib/llm/openai-marketing-schema";
import { DEFAULT_OPENAI_MARKETING_MODEL } from "../lib/llm/openai-config";
import {
  extractResponsesOutputText,
  logOpenAiMarketingError,
} from "../lib/llm/openai-marketing-client";
import { pngBufferFromImagesGenerationsPayload } from "../lib/llm/openai-marketing-image";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const sample = (i: number): OpenAiMarketingPostDraft => ({
  topic: `נושא בדיקה ${i}`,
  target_audience: "ועדי בתים",
  platform: "both",
  body_facebook: `תוכן פייסbוק ${i} — ליווי מקצועי בתחום המעליות.`,
  body_instagram: `תוכן אינסטגרם ${i} #מעליות`,
  visual_prompt: `תמונה מקצועית ${i}: בניין מגורים ומעלית.`,
  publish_date: "2026-04-01",
  publish_time: "10:30",
});

assert(validateMarketingPostDrafts([sample(1), sample(2), sample(3)]), "validates 3 distinct posts");
assert(!validateMarketingPostDrafts([sample(1), sample(1), sample(3)]), "rejects duplicate topics");
assert(!validateMarketingPostDrafts([sample(1), sample(2)]), "rejects count != 3");
assert(
  !validateMarketingPostDrafts([
    sample(1),
    sample(2),
    { ...sample(3), body_facebook: "חיסכון של 40% מובטח" },
  ]),
  "rejects banned marketing claims"
);

assert(actionTypeRequiresApproval("send_social_post"), "send_social_post requires approval");

const agentSrc = read("lib/social-marketing/social-marketing-agent.ts");
const serverSrc = read("lib/social-marketing/social-marketing-server.ts");
const patchSrc = read("lib/forte-ai-marketing-server.ts");
const openaiSrc = read("lib/llm/openai-marketing-client.ts");
const imageSrc = read("lib/llm/openai-marketing-image.ts");
const imageStorageSrc = read("lib/social-marketing/social-marketing-image-storage.ts");
const generateRoute = read("app/forte/api/master/ai-marketing/marketing/posts/generate/route.ts");
const ui = read("components/master-v2/MasterForteAiMarketingSection.tsx");
const aiView = read("components/master-v2/MasterForteAiView.tsx");

assert(!agentSrc.includes("meta-facebook-graph"), "agent does not import Facebook graph");
assert(!agentSrc.includes("publishSocialPostToFacebook"), "agent does not publish");
assert(!openaiSrc.includes("graph.facebook.com"), "OpenAI client has no Facebook URLs");
assert(!openaiSrc.includes("chat/completions"), "uses Responses API not Chat Completions");
assert(openaiSrc.includes("/v1/responses"), "Responses endpoint");
assert(!openaiSrc.includes("temperature"), "temperature not sent");
assert(openaiSrc.includes("logOpenAiMarketingError"), "safe OpenAI error logging");
assert(!generateRoute.includes("publish_facebook"), "generate route does not publish");
assert(patchSrc.includes("send_social_post") && patchSrc.includes("applyJudahDecisionToSocialPostServer"), "dashboard sync hook");
assert(serverSrc.includes("approval_via_dashboard"), "blocks parallel approve in post API");
assert(serverSrc.includes("persistAiMarketingBatchServer"), "batch persist helper");
assert(serverSrc.includes("imageGenerated: true"), "meta marks image generated");
assert(serverSrc.includes("image_url: draft.imagePublicUrl"), "stable image_url on AI posts");
assert(agentSrc.includes("generateMarketingImagePngServer"), "agent generates images before persist");
assert(agentSrc.includes("cleanupOrphanMarketingImagesServer"), "orphan cleanup on failure");
assert(imageSrc.includes("/v1/images/generations"), "OpenAI Images API server-side");
assert(!/"response_format"/.test(imageSrc), "images request has no response_format");
assert(imageSrc.includes("b64_json"), "parses data[0].b64_json from response");
assert(
  agentSrc.includes("cleanupOrphanMarketingImagesServer") &&
    agentSrc.includes("image_generation_failed"),
  "image failure does not leave partial batch (cleanup + error)"
);
const parsedImg = pngBufferFromImagesGenerationsPayload({
  data: [{ b64_json: Buffer.alloc(120, 0x41).toString("base64") }],
});
assert(parsedImg !== null && parsedImg.length >= 100, "b64_json payload decodes to Buffer");
assert(
  pngBufferFromImagesGenerationsPayload({ data: [{ url: "https://example.com/x.png" }] }) ===
    null,
  "does not treat url-only as success without b64_json"
);
assert(!imageSrc.includes("OPENAI_API_KEY"), "image module does not log key");
assert(imageStorageSrc.includes("document-center"), "images in document-center bucket");
assert(imageStorageSrc.includes("forte-marketing/social"), "marketing image prefix");
assert(generateRoute.includes("image_generation_failed"), "generate route maps image errors");
assert(serverSrc.includes("pending_approval"), "AI posts start pending");
assert(ui.includes("צור פוסטים עם AI"), "AI button in UI");
assert(ui.includes("visualPrompt"), "visual prompt in preview UI");
assert(ui.includes("MarketingPostImage"), "real image preview in marketing UI");
assert(aiView.includes("linkedPostImageUrl"), "approval thumbnails for Judah");
assert(!ui.includes('runAction(previewPost, "approve")'), "no parallel approve in preview dialog");

assert(DEFAULT_OPENAI_MARKETING_MODEL === "gpt-5.4-mini", "default model gpt-5.4-mini");

void (async () => {
  const mockGenerator: MarketingBatchGenerator = async () => ({
    posts: [sample(1), sample(2), sample(3)],
    error: null,
  });

  const badGenerator: MarketingBatchGenerator = async () => ({
    posts: [sample(1), sample(2)],
    error: null,
  });

  const mockResponsesPayload = {
    output_text: JSON.stringify({
      posts: [sample(1), sample(2), sample(3)],
    }),
  };
  assert(
    extractResponsesOutputText(mockResponsesPayload)?.includes("נושא בדיקה"),
    "Responses output_text parsing"
  );
  const nestedPayload = {
    output: [
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: JSON.stringify({ posts: [sample(1)] }) }],
      },
    ],
  };
  assert(extractResponsesOutputText(nestedPayload) !== null, "Responses nested output parsing");

  logOpenAiMarketingError(400, {
    error: { code: "unsupported_value", message: "test only" },
  });

  assert(validateMarketingPostDrafts((await mockGenerator({ systemPrompt: "", userPrompt: "" })).posts!), "mock batch shape");
  const bad = await badGenerator({ systemPrompt: "", userPrompt: "" });
  assert(!validateMarketingPostDrafts(bad.posts!), "invalid mock batch rejected");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
