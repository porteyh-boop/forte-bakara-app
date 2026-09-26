/**
 * Meta Facebook publish — unit tests with MOCK fetch (not live Graph API).
 * Run: npx tsx scripts/qa-meta-facebook-mock-v1.ts
 */
import fs from "fs";
import path from "path";

function loadEnvFile(rel: string): void {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

import {
  buildFacebookPostPermalink,
  getMetaFacebookOAuthRedirectUri,
  metaFacebookDialogOAuthUrl,
  META_FACEBOOK_OAUTH_SCOPES,
} from "../lib/social-marketing/meta-facebook-config";
import { encryptSecret, hashOpaque } from "../lib/social-marketing/meta-facebook-crypto";
import {
  publishPageFeedPost,
  type MetaGraphFetch,
} from "../lib/social-marketing/meta-facebook-graph";
import { verifyOAuthState } from "../lib/social-marketing/meta-facebook-server";

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

const stateA = "test-state-token-123456789012345678901234";
const stateB = "other-state-token-123456789012345678901234";
assert(verifyOAuthState(stateA, stateA), "oauth state matches (mock CSRF)");
assert(!verifyOAuthState(stateA, stateB), "oauth state rejects mismatch (mock CSRF)");

assert(
  getMetaFacebookOAuthRedirectUri().endsWith(
    "/forte/api/master/ai-marketing/marketing/facebook/callback"
  ),
  "oauth redirect path"
);

process.env.META_FACEBOOK_APP_ID = process.env.META_FACEBOOK_APP_ID ?? "qa-app-id";
process.env.META_FACEBOOK_LOGIN_CONFIG_ID = process.env.META_FACEBOOK_LOGIN_CONFIG_ID ?? "qa-config-id";
const oauthUrl = metaFacebookDialogOAuthUrl({
  state: "qa-state",
  redirectUri: getMetaFacebookOAuthRedirectUri(),
});
assert(oauthUrl.includes("config_id=qa-config-id"), "oauth url includes config_id");
assert(oauthUrl.includes("scope="), "oauth url includes scope");
assert(
  META_FACEBOOK_OAUTH_SCOPES.every((s) => oauthUrl.includes(s)),
  "oauth url includes all configured scopes"
);

delete process.env.META_FACEBOOK_LOGIN_CONFIG_ID;
let configMissing = false;
try {
  metaFacebookDialogOAuthUrl({ state: "x", redirectUri: "https://example.com/cb" });
} catch (err) {
  configMissing = err instanceof Error && err.message === "meta_login_config_not_configured";
}
assert(configMissing, "oauth rejects missing META_FACEBOOK_LOGIN_CONFIG_ID");
process.env.META_FACEBOOK_LOGIN_CONFIG_ID = "qa-config-id";

const enc = encryptSecret("page-token-sample");
assert(enc.includes("."), "token encryption produces payload");

const mockFetch: MetaGraphFetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/feed") && init?.method === "POST") {
    return new Response(JSON.stringify({ id: "999888777_112233445566778" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
};

void (async () => {
  const published = await publishPageFeedPost({
    pageId: "999888777",
    pageAccessToken: "mock",
    message: "QA mock post",
    fetchImpl: mockFetch,
  });
  assert(published.id.includes("_"), "mock publish returns facebook post id shape");
  const link = buildFacebookPostPermalink(published.id);
  assert(link.includes("facebook.com"), "permalink builder");

  assert(typeof hashOpaque("x") === "string", "state hash helper");

  console.log(`\n${passed} passed, ${failed} failed (MOCK — not live Meta)`);
  process.exit(failed > 0 ? 1 : 0);
})();
