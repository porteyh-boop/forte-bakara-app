/**
 * Facebook photo publish routing QA (mock Graph — no live publish).
 * Run: npx tsx scripts/qa-meta-facebook-photo-publish-v1.ts
 */
import fs from "fs";
import path from "path";
import { buildFacebookPostPermalink } from "../lib/social-marketing/meta-facebook-config";
import {
  facebookGraphPostIdFromPhotoCreateResponse,
  publishPageFeedPost,
  publishPagePhotoPost,
  type MetaGraphFetch,
} from "../lib/social-marketing/meta-facebook-graph";
import {
  isPublicImageUrlForMetaFetch,
  publishApprovedFacebookPostContent,
} from "../lib/social-marketing/meta-facebook-publish";

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

assert(
  isPublicImageUrlForMetaFetch(
    "https://xxxx.supabase.co/storage/v1/object/public/document-center/forte-marketing/social/x.png"
  ),
  "public supabase object URL allowed"
);
assert(!isPublicImageUrlForMetaFetch("http://insecure.example/x.png"), "http rejected");
assert(
  !isPublicImageUrlForMetaFetch("https://x.supabase.co/storage/v1/object/sign/x?token=abc"),
  "signed token URL rejected"
);

assert(
  facebookGraphPostIdFromPhotoCreateResponse({ id: "555", post_id: "999_555" }) === "999_555",
  "prefer post_id from /photos response"
);
assert(
  facebookGraphPostIdFromPhotoCreateResponse({ id: "555" }) === "555",
  "fallback to photo id"
);

const feedLink = buildFacebookPostPermalink("999888777_112233445566778");
assert(feedLink.includes("/posts/"), "feed post permalink uses /posts/");
const photoLink = buildFacebookPostPermalink("444555666");
assert(photoLink.includes("photo/?fbid="), "photo-only id uses photo permalink");

void (async () => {
  let feedCalls = 0;
  let photoCalls = 0;
  let lastPhotoBody: Record<string, unknown> | null = null;

  const mockFetch: MetaGraphFetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/photos") && init?.method === "POST") {
      photoCalls += 1;
      lastPhotoBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: "photo123", post_id: "page9_photo123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.includes("/feed") && init?.method === "POST") {
      feedCalls += 1;
      return new Response(JSON.stringify({ id: "999888777_112233445566778" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
  };

  const imageUrl =
    "https://example.supabase.co/storage/v1/object/public/document-center/forte-marketing/social/a.png";
  const withImage = await publishApprovedFacebookPostContent({
    pageId: "page9",
    pageAccessToken: "mock",
    message: "caption text",
    imageUrl,
    fetchImpl: mockFetch,
  });
  assert(withImage.mode === "photos", "post with image_url uses photos mode");
  assert(photoCalls === 1, "calls /photos once");
  assert(feedCalls === 0, "with image does not call /feed");
  assert(lastPhotoBody?.url === imageUrl, "photos url is image_url");
  assert(lastPhotoBody?.caption === "caption text", "photos caption is body_facebook");
  assert(withImage.facebookPostId === "page9_photo123", "stores graph post id from photo response");

  feedCalls = 0;
  photoCalls = 0;
  const textOnly = await publishApprovedFacebookPostContent({
    pageId: "page9",
    pageAccessToken: "mock",
    message: "text only",
    imageUrl: null,
    fetchImpl: mockFetch,
  });
  assert(textOnly.mode === "feed", "no image uses feed mode");
  assert(feedCalls === 1, "text-only calls /feed");
  assert(photoCalls === 0, "text-only does not call /photos");

  photoCalls = 0;
  feedCalls = 0;
  let photoFailed = false;
  const failPhotoFetch: MetaGraphFetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/photos")) {
      photoFailed = true;
      return new Response(JSON.stringify({ error: { message: "photo failed" } }), { status: 400 });
    }
    if (url.includes("/feed")) {
      feedCalls += 1;
      return new Response(JSON.stringify({ id: "fallback" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
  };

  try {
    await publishApprovedFacebookPostContent({
      pageId: "page9",
      pageAccessToken: "mock",
      message: "cap",
      imageUrl: imageUrl,
      fetchImpl: failPhotoFetch,
    });
    assert(false, "photo failure should throw");
  } catch {
    assert(photoFailed, "photo publish attempted");
    assert(feedCalls === 0, "photo failure does not fallback to /feed");
  }

  await publishPageFeedPost({
    pageId: "999888777",
    pageAccessToken: "mock",
    message: "QA mock post",
    fetchImpl: mockFetch,
  });
  await publishPagePhotoPost({
    pageId: "999888777",
    pageAccessToken: "mock",
    imageUrl: imageUrl,
    caption: "cap",
    fetchImpl: mockFetch,
  });

  const server = read("lib/social-marketing/meta-facebook-server.ts");
  assert(server.includes("publishApprovedFacebookPostContent"), "server uses unified publish");
  assert(server.includes("image_url"), "server passes image_url");
  assert(!server.includes("publishPageFeedPost({"), "server does not call feed directly");

  console.log(`\n${passed} passed, ${failed} failed (MOCK — not live Meta)`);
  process.exit(failed > 0 ? 1 : 0);
})();
