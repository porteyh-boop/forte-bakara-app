/**
 * Instagram publish + cross-post QA (mock Graph only — no live publish).
 * Run: npx tsx scripts/qa-meta-instagram-cross-post-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  canPublishToFacebookNetwork,
  canPublishToInstagramNetwork,
  overallStatusAfterInstagramSuccess,
  resolveInstagramPublishStatusFromRow,
} from "../lib/social-marketing/social-marketing-publish-status";
import { publishApprovedInstagramPostContent } from "../lib/social-marketing/meta-instagram-publish";
import type { MetaGraphFetch } from "../lib/social-marketing/meta-facebook-graph";
import { fetchInstagramBusinessAccountForPage } from "../lib/social-marketing/meta-instagram-graph";
import { META_FACEBOOK_OAUTH_SCOPES } from "../lib/social-marketing/meta-facebook-config";

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

assert(META_FACEBOOK_OAUTH_SCOPES.includes("instagram_content_publish"), "oauth includes instagram_content_publish");
assert(META_FACEBOOK_OAUTH_SCOPES.includes("instagram_basic"), "oauth includes instagram_basic");

assert(
  !canPublishToInstagramNetwork({
    platform: "instagram",
    status: "approved",
    imageUrl: null,
    bodyInstagram: "cap",
    instagramMediaId: null,
    instagramPublishStatus: "pending",
  }),
  "instagram blocked without image_url"
);

assert(
  !canPublishToInstagramNetwork({
    platform: "instagram",
    status: "pending_approval",
    imageUrl: "https://example.com/a.jpg",
    bodyInstagram: "cap",
    instagramMediaId: null,
    instagramPublishStatus: "pending",
  }),
  "instagram blocked without approval"
);

assert(
  !canPublishToInstagramNetwork({
    platform: "instagram",
    status: "approved",
    imageUrl: "https://example.com/a.jpg",
    bodyInstagram: "cap",
    instagramMediaId: "178414",
    instagramPublishStatus: "published",
  }),
  "duplicate instagram blocked when media id exists"
);

assert(
  resolveInstagramPublishStatusFromRow({
    platform: "both",
    instagramMediaId: "99",
    instagramPublishStatus: "published",
  }) === "published",
  "instagram published when media id saved"
);

assert(
  overallStatusAfterInstagramSuccess("both", { facebookPublished: true }) === "published",
  "both workflow published when fb already done"
);

assert(
  !canPublishToFacebookNetwork({
    platform: "both",
    status: "ready_to_publish",
    facebookPostId: "1_2",
    facebookPublishStatus: "published",
  }),
  "cross-post retry fb skipped when already published"
);

const migration = read("supabase/migrations/054_social_instagram_publish.sql");
assert(migration.includes("instagram_media_id"), "migration 054 adds instagram_media_id");
assert(migration.includes("instagram_business_account_id"), "migration 054 adds ig account on connection");

const igServer = read("lib/social-marketing/meta-instagram-server.ts");
assert(igServer.includes('.is("instagram_media_id", null)'), "instagram duplicate lock");
assert(igServer.includes("approval_stale"), "instagram requires approval match");

const marketing = read("components/master-v2/MasterForteAiMarketingSection.tsx");
assert(marketing.includes("publish_both"), "UI publish both action");
assert(marketing.includes("publish_instagram"), "UI instagram publish");

const metaConfig = read("lib/social-marketing/meta-facebook-config.ts");
assert(metaConfig.includes("META_FACEBOOK_LOGIN_CONFIG_ID"), "login config id env");
assert(metaConfig.includes("config_id"), "oauth url uses config_id");
assert(metaConfig.includes("meta_login_config_not_configured"), "missing config id error");

void (async () => {
  const discoveryFetch: MetaGraphFetch = async (input) => {
    const url = String(input);
    if (url.includes("instagram_business_account")) {
      return new Response(
        JSON.stringify({
          instagram_business_account: { id: "1789654321", username: "lifts.forte" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
  };

  const ig = await fetchInstagramBusinessAccountForPage({
    pageId: "page1",
    pageAccessToken: "token",
    fetchImpl: discoveryFetch,
  });
  assert(ig?.id === "1789654321", "discovery returns instagram business account id");
  assert(ig?.username === "lifts.forte", "discovery returns username");

  let publishStep = 0;
  const publishFetch: MetaGraphFetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/media") && init?.method === "POST" && !url.includes("media_publish")) {
      publishStep += 1;
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      assert(body.image_url?.startsWith("https://"), "/media receives public image_url");
      assert(Boolean(body.caption?.trim()), "/media receives body_instagram caption");
      return new Response(JSON.stringify({ id: "container_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("status_code")) {
      return new Response(JSON.stringify({ status_code: "FINISHED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/media_publish") && init?.method === "POST") {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      assert(body.creation_id === "container_123", "/media_publish receives creation_id");
      return new Response(JSON.stringify({ id: "media_456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("permalink")) {
      return new Response(JSON.stringify({ permalink: "https://www.instagram.com/p/ABC/" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
  };

  const published = await publishApprovedInstagramPostContent({
    igUserId: "1789654321",
    pageAccessToken: "page-token",
    imageUrl: "https://cdn.example.com/image.jpg",
    caption: "טקסט IG",
    fetchImpl: publishFetch,
  });
  assert(publishStep === 1, "single /media create call");
  assert(published.mediaId === "media_456", "media id returned");
  assert(published.permalink?.includes("instagram.com"), "permalink fetched");

  const socialServer = read("lib/social-marketing/social-marketing-server.ts");
  assert(socialServer.includes("publish_both"), "server publish_both orchestration");
  assert(socialServer.includes("canPublishToInstagramNetwork"), "both skips published channels");

  console.log(`\nInstagram cross-post QA: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
