/**
 * Multi Facebook pages + publish_targets QA (static + unit, no live Graph).
 * Run: npx tsx scripts/qa-social-multi-facebook-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  canPublishToFacebookNetwork,
  canRetryFacebookPublication,
} from "../lib/social-marketing/social-marketing-publish-status";
import {
  defaultPublishTargetsForPlatform,
  normalizePublishTargets,
  publishTargetsEqual,
} from "../lib/social-marketing/social-publish-targets";

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

const t1 = defaultPublishTargetsForPlatform({
  platform: "both",
  connectedFacebookConnectionIds: ["a", "b"],
  instagramAvailable: true,
});
assert(t1.facebookConnectionIds.length === 2 && t1.instagram, "default selects all FB + IG");

const t2 = normalizePublishTargets({ facebookConnectionIds: ["x"], instagram: false });
assert(!publishTargetsEqual(t1, t2), "targets equality");

assert(
  canPublishToFacebookNetwork({
    platform: "facebook",
    status: "approved",
    facebookPostId: null,
    facebookPublishStatus: "pending",
    publishTargets: { facebookConnectionIds: ["c1"], instagram: false },
    facebookPublications: [
      {
        id: "1",
        connectionId: "c1",
        pageId: "p",
        displayLabel: "L",
        publishStatus: "pending",
        facebookPostId: null,
        facebookPostUrl: null,
        publishMode: null,
        publishErrorCode: null,
        publishErrorMessage: null,
        publishedAt: null,
      },
    ],
  }),
  "can publish pending selected page"
);

assert(
  canRetryFacebookPublication(
    {
      connectionId: "c1",
      publishStatus: "failed",
      id: "",
      pageId: "",
      displayLabel: "",
      facebookPostId: null,
      facebookPostUrl: null,
      publishMode: null,
      publishErrorCode: "x",
      publishErrorMessage: "y",
      publishedAt: null,
    },
    {
      status: "ready_to_publish",
      publishTargets: { facebookConnectionIds: ["c1"], instagram: false },
    }
  ),
  "retry only failed selected"
);

const mig = read("supabase/migrations/056_social_multi_facebook_pages.sql");
assert(mig.includes("social_marketing_facebook_publications"), "migration publications table");
assert(mig.includes("publish_targets"), "migration publish_targets");
assert(
  mig.includes("idx_social_facebook_connection_one_primary_ig") &&
    mig.includes("where is_primary_for_instagram"),
  "migration DB unique partial index for one Primary IG"
);
assert(mig.includes("singleton_key = 'default'"), "migration prefers legacy singleton row");
const primaryIdx = mig.indexOf("idx_social_facebook_connection_one_primary_ig");
const pubBackfill = mig.indexOf("Backfill publication row");
assert(primaryIdx > 0 && pubBackfill > primaryIdx, "Primary IG index before publications backfill");

const mig055 = read("supabase/migrations/055_social_post_image_mode.sql");
assert(mig055.includes("post_image_mode"), "055 migration intact");
assert(!/alter table public\.social_marketing_posts[\s\S]*post_image_mode/.test(mig), "056 does not alter post_image_mode");

const multi = read("lib/social-marketing/meta-facebook-multi-publish.ts");
assert(multi.includes("publishSocialPostToFacebookPageServer"), "per-page publish");

const ui = read("components/master-v2/MasterForteAiMarketingSection.tsx");
assert(ui.includes("PostPublishTargetsChoice"), "UI publish targets");
assert(ui.includes("publish_facebook_page"), "UI retry per page");
assert(ui.includes("FacebookConnectedPagesManager"), "UI connected pages manager");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
