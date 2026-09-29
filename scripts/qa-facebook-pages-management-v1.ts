/**
 * Facebook pages management UI + API QA (static + unit, no live Graph).
 * Run: npx tsx scripts/qa-facebook-pages-management-v1.ts
 */
import fs from "fs";
import path from "path";
import { planInstagramPrimaryFlags } from "../lib/social-marketing/social-facebook-pages-server";

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

function displayLabelValidation(label: string): "invalid_input" | null {
  return label.trim() ? null : "invalid_input";
}

assert(displayLabelValidation("") === "invalid_input", "empty display_label → invalid_input");
assert(displayLabelValidation("   ") === "invalid_input", "whitespace display_label → invalid_input");
assert(displayLabelValidation("דף השמאי") === null, "non-empty display_label accepted");

const ids = ["c1", "c2", "c3"];
const flags = planInstagramPrimaryFlags(ids, "c2");
assert(Object.values(flags).filter(Boolean).length === 1, "exactly one IG primary in plan");
assert(flags.c2 === true && !flags.c1 && !flags.c3, "selected id is sole primary");

const disconnectRoute = read(
  "app/forte/api/master/ai-marketing/marketing/facebook/disconnect/route.ts"
);
assert(disconnectRoute.includes("connectionId"), "disconnect API accepts connectionId query");

const disconnectServer = read("lib/social-marketing/meta-facebook-server.ts");
assert(
  disconnectServer.includes('.eq("id", connectionId)') ||
    disconnectServer.includes(".eq('id', connectionId)"),
  "disconnect server scopes to single connection id"
);

const patchRoute = read(
  "app/forte/api/master/ai-marketing/marketing/facebook/connections/[connectionId]/route.ts"
);
assert(patchRoute.includes("updateFacebookConnectionDisplayLabelServer"), "PATCH updates display_label");
assert(patchRoute.includes("setPrimaryInstagramConnectionServer"), "PATCH can set IG primary");

const primaryServer = read("lib/social-marketing/social-facebook-pages-server.ts");
assert(
  primaryServer.includes("is_primary_for_instagram: false") &&
    primaryServer.includes("is_primary_for_instagram: true"),
  "set primary clears then sets one row"
);

const manager = read("components/master-v2/FacebookConnectedPagesManager.tsx");
assert(manager.includes("patchFacebookConnection"), "UI patches connection");
assert(manager.includes("disconnectFacebookPage"), "UI disconnects by connection id");
assert(manager.includes("לנתק את") && manager.includes("נתק דף"), "disconnect confirmation copy");
assert(manager.includes("setPrimaryForInstagram"), "UI can set IG primary");
assert(manager.includes("displayLabel"), "UI edits display_label");

const marketing = read("components/master-v2/MasterForteAiMarketingSection.tsx");
assert(marketing.includes("FacebookConnectedPagesManager"), "marketing section embeds pages manager");
assert(marketing.includes("PostPublishTargetsChoice"), "regression: publish targets UI (055/056)");
assert(marketing.includes("postImageMode") || marketing.includes("PostImageModeChoice"), "regression: 055 image mode");

const types055 = read("lib/social-marketing/social-marketing-types.ts");
assert(types055.includes("postImageMode"), "regression: post_image_mode type");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
