/**
 * Temporary /me/accounts diagnostic route QA (mock Graph only).
 * Run: npx tsx scripts/qa-meta-facebook-pages-diagnostic-v1.ts
 */
import fs from "fs";
import path from "path";
import { fetchMeAccountsDiagnostic } from "../lib/social-marketing/meta-facebook-graph";
import type { MetaGraphFetch } from "../lib/social-marketing/meta-facebook-graph";
import { isMetaFacebookMeAccountsDebugEnabled } from "../lib/social-marketing/meta-facebook-config";

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

const route = read(
  "app/forte/api/master/ai-marketing/marketing/facebook/pages/diagnostic/route.ts"
);
const graph = read("lib/social-marketing/meta-facebook-graph.ts");
const config = read("lib/social-marketing/meta-facebook-config.ts");

assert(route.includes("debug_disabled"), "route returns 404 when debug off");
assert(route.includes("requireMasterApiSession"), "route requires master session");
assert(route.includes("no_pending_oauth"), "route hints pending oauth");
assert(!route.includes("access_token"), "route handler does not echo access_token");
assert(config.includes("META_FACEBOOK_ME_ACCOUNTS_DEBUG"), "debug env documented in config");
assert(graph.includes("instagram_business_account"), "diagnostic requests ig business account field");

const prev = process.env.META_FACEBOOK_ME_ACCOUNTS_DEBUG;
process.env.META_FACEBOOK_ME_ACCOUNTS_DEBUG = "1";
assert(isMetaFacebookMeAccountsDebugEnabled(), "debug flag enabled when env is 1");
process.env.META_FACEBOOK_ME_ACCOUNTS_DEBUG = "0";
assert(!isMetaFacebookMeAccountsDebugEnabled(), "debug flag off otherwise");
process.env.META_FACEBOOK_ME_ACCOUNTS_DEBUG = prev;

const mockFetch: MetaGraphFetch = async (input) => {
  const url = String(input);
  if (!url.includes("/me/accounts")) {
    return new Response(JSON.stringify({ error: { message: "unexpected" } }), { status: 400 });
  }
  return new Response(
    JSON.stringify({
      data: [
        {
          id: "111",
          name: "יהודה פורטה",
          tasks: ["CREATE_CONTENT"],
          access_token: "SECRET_PAGE_TOKEN",
          instagram_business_account: { id: "178999" },
        },
        {
          id: "222",
          name: "ישראלי יועצים",
          tasks: ["ANALYZE"],
          instagram_business_account: { id: "178888" },
        },
      ],
      paging: { next: "https://graph.facebook.com/v26.0/me/accounts?after=cursor" },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

void (async () => {
  const result = await fetchMeAccountsDiagnostic({
    userAccessToken: "user-token-not-returned",
    fetchImpl: mockFetch,
  });
  assert(result.graphOk && result.rawCount === 2, "mock rawCount");
  assert(result.hasNextPage, "hasNextPage when paging.next set");
  const serialized = JSON.stringify(result);
  assert(!serialized.includes("SECRET_PAGE_TOKEN"), "response never includes page access_token");
  assert(!serialized.includes("user-token-not-returned"), "response never includes user token");

  const yehuda = result.pages.find((p) => p.name === "יהודה פורטה");
  assert(yehuda?.instagramBusinessAccountId === "178999", "ig business id on page");
  assert(yehuda?.hasPageAccessToken === true, "hasPageAccessToken true when token present");
  assert(yehuda?.forteWouldShow === true, "forteWouldShow when id+token");

  const israeli = result.pages.find((p) => p.name === "ישראלי יועצים");
  assert(israeli?.hasPageAccessToken === false, "missing token flagged");
  assert(israeli?.forteWouldShow === false, "forteWouldShow false without token");

  console.log(`\nFacebook pages diagnostic QA: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})();
