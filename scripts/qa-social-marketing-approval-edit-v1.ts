/**
 * Judah pre-approval edit + content policy QA (static, no live OpenAI).
 * Run: npx tsx scripts/qa-social-marketing-approval-edit-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  marketingDraftPassesContentPolicy,
  textContainsForbiddenMarketingContent,
} from "../lib/social-marketing/social-marketing-content-policy";
import { validateMarketingPostDrafts } from "../lib/social-marketing/social-marketing-agent";
import type { OpenAiMarketingPostDraft } from "../lib/llm/openai-marketing-schema";

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

const goodDraft = (): OpenAiMarketingPostDraft => ({
  topic: "כשהמעלית מושבתת שוב ושוב",
  target_audience: "ועד בית בבניין משותף",
  platform: "both",
  body_facebook: "לא תמיד ברור אם התיקון שמציעים באמת נדרש. כדאי לבדוק לפני שמאשרים.",
  body_instagram: "תקלה חוזרת במעלית? שווה להבין מה קורה לפני שמאשרים תיקון. #ועדבית",
  visual_prompt: "מעלית מודרנית בלוב בניין מגורים, תאורה נקייה, ללא טקסט",
  publish_date: "2026-05-01",
  publish_time: "09:00",
});

assert(!textContainsForbiddenMarketingContent("ועד בית"), "allowed copy passes");
assert(textContainsForbiddenMarketingContent("FORTE מומלץ"), "blocks FORTE");
assert(textContainsForbiddenMarketingContent("פורטה"), "blocks פורטה");
assert(textContainsForbiddenMarketingContent("לחברות ניהול"), "blocks חברות ניהול");
assert(textContainsForbiddenMarketingContent("חברת ניהול"), "blocks חברת ניהול");
assert(marketingDraftPassesContentPolicy(goodDraft()), "good draft passes policy");
assert(
  !marketingDraftPassesContentPolicy({ ...goodDraft(), topic: "Forte tips" }),
  "draft with Forte fails"
);
assert(
  !validateMarketingPostDrafts([
    goodDraft(),
    { ...goodDraft(), topic: "נושא שני" },
    { ...goodDraft(), topic: "נושא שלישי", body_facebook: "חברת ניהול צריכה" },
  ]),
  "batch with forbidden phrase rejected"
);

const agent = read("lib/social-marketing/social-marketing-agent.ts");
const policy = read("lib/social-marketing/social-marketing-content-policy.ts");
const server = read("lib/social-marketing/social-marketing-server.ts");
const route = read("app/forte/api/master/ai-marketing/marketing/posts/[postId]/route.ts");
const api = read("lib/social-marketing/social-marketing-api.ts");
const view = read("components/master-v2/MasterForteAiView.tsx");
const image = read("lib/llm/openai-marketing-image.ts");

assert(agent.includes("marketingDraftPassesContentPolicy"), "server validates AI batch policy");
assert(!agent.includes("ל-FORTE") && !agent.includes("שירותי FORTE"), "prompt without brand in user prompt");
assert(policy.includes("פורטה"), "policy covers Hebrew brand");
assert(server.includes("updateSocialMarketingPendingApprovalCopyServer"), "pending copy update server");
assert(server.includes('status !== "pending_approval"'), "edit only while pending");
assert(!server.includes("generateMarketingImagePngServer"), "edit path no image gen in server file");
assert(route.includes("pendingApprovalCopyEdit"), "API flag for Judah edit");
assert(api.includes("updateSocialMarketingPendingApprovalCopy"), "client API for edit");
assert(view.includes("ערוך פוסט"), "edit button in Judah approvals");
assert(view.includes("שמור שינויים"), "save changes in edit dialog");
assert(!view.includes("generateSocialMarketingPostsWithAi"), "Judah view does not trigger AI generate");
assert(image.includes("/v1/images/generations"), "image generation unchanged");
assert(!/"response_format"/.test(image), "image request still without response_format");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
