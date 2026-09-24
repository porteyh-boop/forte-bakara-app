/**
 * Task 053 — per-network publish status QA (no live Graph / no deploy).
 * Run: npx tsx scripts/qa-social-marketing-publish-status-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  canPublishToFacebookNetwork,
  isPostFullyPublishedOnAllTargets,
  overallStatusAfterFacebookFailure,
  overallStatusAfterFacebookSuccess,
  resolveFacebookPublishStatusFromRow,
  resolveInstagramPublishStatusFromRow,
} from "../lib/social-marketing/social-marketing-publish-status";

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

assert(overallStatusAfterFacebookSuccess("facebook") === "published", "FB-only success -> published");
assert(
  overallStatusAfterFacebookSuccess("both") === "ready_to_publish",
  "both success -> not global published until IG done"
);
assert(overallStatusAfterFacebookFailure("facebook") === "failed", "FB-only failure -> failed workflow");
assert(
  overallStatusAfterFacebookFailure("both") === "ready_to_publish",
  "both FB failure keeps workflow without fake published"
);

assert(
  resolveFacebookPublishStatusFromRow({
    platform: "both",
    facebookPostId: "1_2",
    facebookPublishStatus: "published",
  }) === "published",
  "facebook network published when post id saved"
);
assert(
  resolveInstagramPublishStatusFromRow({ platform: "both", instagramPublishStatus: "pending" }) ===
    "pending",
  "instagram pending on both"
);
assert(
  !isPostFullyPublishedOnAllTargets({
    platform: "both",
    facebookPostId: "1_2",
    facebookPublishStatus: "published",
    instagramPublishStatus: "pending",
  }),
  "both not fully published when only facebook done"
);
assert(
  canPublishToFacebookNetwork({
    platform: "facebook",
    status: "failed",
    facebookPostId: null,
    facebookPublishStatus: "failed",
  }),
  "retry allowed after failed facebook publish"
);
assert(
  !canPublishToFacebookNetwork({
    platform: "facebook",
    status: "published",
    facebookPostId: "9_9",
    facebookPublishStatus: "published",
  }),
  "duplicate publish blocked when post id exists"
);

const migration = read("supabase/migrations/053_social_marketing_publish_status.sql");
const meta = read("lib/social-marketing/meta-facebook-server.ts");
const ui = read("components/master-v2/SocialPostPublishStatusPanel.tsx");
const marketing = read("components/master-v2/MasterForteAiMarketingSection.tsx");

assert(migration.includes("facebook_publish_status"), "migration 053 adds network status");
assert(migration.includes("publish_error_message"), "migration stores error message");
assert(meta.includes("facebook_publish_status"), "publish success saves facebook status");
assert(meta.includes("published_to_facebook_at"), "publish success saves timestamp");
assert(meta.includes("facebook_post_id"), "publish success saves post id");
assert(meta.includes(".is(\"facebook_post_id\", null)"), "duplicate publish lock");
assert(meta.includes("overallStatusAfterFacebookSuccess"), "partial publish for both");
assert(ui.includes("פורסם בפועל"), "UI shows actual publish time");
assert(ui.includes("נסה לפרסם שוב"), "UI retry on failure");
assert(marketing.includes("SocialPostPublishStatusPanel"), "marketing list shows publish panel");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
