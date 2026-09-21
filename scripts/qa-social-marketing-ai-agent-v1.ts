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
const generateRoute = read("app/forte/api/master/ai-marketing/marketing/posts/generate/route.ts");
const ui = read("components/master-v2/MasterForteAiMarketingSection.tsx");

assert(!agentSrc.includes("meta-facebook-graph"), "agent does not import Facebook graph");
assert(!agentSrc.includes("publishSocialPostToFacebook"), "agent does not publish");
assert(!openaiSrc.includes("graph.facebook.com"), "OpenAI client has no Facebook URLs");
assert(!generateRoute.includes("publish_facebook"), "generate route does not publish");
assert(patchSrc.includes("send_social_post") && patchSrc.includes("applyJudahDecisionToSocialPostServer"), "dashboard sync hook");
assert(serverSrc.includes("approval_via_dashboard"), "blocks parallel approve in post API");
assert(serverSrc.includes("persistAiMarketingBatchServer"), "batch persist helper");
assert(serverSrc.includes("pending_approval"), "AI posts start pending");
assert(ui.includes("צור פוסטים עם AI"), "AI button in UI");
assert(ui.includes("visualPrompt"), "visual prompt in preview UI");
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

  assert(validateMarketingPostDrafts((await mockGenerator({ systemPrompt: "", userPrompt: "" })).posts!), "mock batch shape");
  const bad = await badGenerator({ systemPrompt: "", userPrompt: "" });
  assert(!validateMarketingPostDrafts(bad.posts!), "invalid mock batch rejected");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
