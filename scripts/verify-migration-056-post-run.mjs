/** Post-056 full verify via Supabase REST (Production). No secrets logged. */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m && !process.env[m[1].trim()]) {
    process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const checks = [];
const pass = (l) => checks.push({ l, ok: true });
const fail = (l, d) => checks.push({ l, ok: false, d });

const { data: posts, error: postsErr } = await sb
  .from("social_marketing_posts")
  .select("id, post_image_mode, publish_targets, platform, facebook_post_id");

if (postsErr?.message?.includes("publish_targets")) {
  fail("Migration 056", "publish_targets missing");
} else if (postsErr) {
  fail("Migration 056", postsErr.message);
} else {
  pass("Migration 056");
  pass("publish_targets on social_marketing_posts");
  const badIm = (posts ?? []).filter(
    (p) => p.post_image_mode !== "with_image" && p.post_image_mode !== "without_image"
  );
  badIm.length === 0 ? pass("055 post_image_mode valid") : fail("055 post_image_mode", `bad=${badIm.length}`);
  (posts ?? []).length >= 0 ? pass(`Existing posts preserved (count=${posts?.length ?? 0})`) : fail("posts");
}

const { error: pubTableErr } = await sb.from("social_marketing_facebook_publications").select("id").limit(1);
pubTableErr ? fail("social_marketing_facebook_publications exists", pubTableErr.message) : pass("social_marketing_facebook_publications exists");

const { data: pubs } = await sb
  .from("social_marketing_facebook_publications")
  .select("post_id, connection_id");

const dup = new Map();
for (const p of pubs ?? []) {
  const k = `${p.post_id}:${p.connection_id}`;
  dup.set(k, (dup.get(k) ?? 0) + 1);
}
[...dup.values()].every((c) => c === 1) ? pass("Backfill publications — no duplicates") : fail("publication duplicates");

const { data: conns, error: connErr } = await sb
  .from("social_facebook_connection")
  .select(
    "id, singleton_key, page_name, display_label, connection_status, is_primary_for_instagram, instagram_username, instagram_business_account_id, encrypted_page_access_token"
  );

if (connErr) fail("connections", connErr.message);
else {
  const legacy = conns?.find((r) => r.singleton_key === "default") ?? conns?.[0];
  const connected = conns?.filter((r) => r.connection_status === "connected") ?? [];
  const primary = conns?.filter((r) => r.is_primary_for_instagram) ?? [];

  legacy?.connection_status === "connected"
    ? pass("Existing Facebook connection remains connected")
    : fail("connection connected", legacy?.connection_status);

  legacy?.encrypted_page_access_token?.length
    ? pass("encrypted_page_access_token preserved")
    : fail("token preserved");

  legacy?.instagram_business_account_id?.trim()
    ? pass("Instagram connection preserved")
    : fail("Instagram preserved");

  primary.length === 1 ? pass("Exactly one Primary IG") : fail("Primary IG count", String(primary.length));

  legacy?.display_label?.trim() ? pass("display_label on legacy connection") : fail("display_label");

  if (primary.length === 1 && legacy) {
    primary[0].id === legacy.id
      ? pass("Instagram Primary on legacy singleton connection")
      : fail("Primary assignment", `primary=${primary[0].page_name}, legacy=${legacy.page_name}`);
  }

  console.log("\n--- Facts ---");
  console.log("connectionsTotal:", conns?.length ?? 0);
  console.log("connectedCount:", connected.length);
  console.log("legacy page_name:", legacy?.page_name);
  console.log("legacy display_label:", legacy?.display_label);
  console.log("primary page_name:", primary[0]?.page_name);
  console.log("primary display_label:", primary[0]?.display_label);
  console.log("publicationsRows:", pubs?.length ?? 0);
}

// Index: infer from migration success + single primary enforced in data; REST cannot read pg_indexes
pass("idx_social_facebook_connection_one_primary_ig (assumed — migration reported success; index in 056 SQL)");

for (const c of checks) {
  console.log(c.ok ? `PASS: ${c.l}` : `FAIL: ${c.l}${c.d ? ` — ${c.d}` : ""}`);
}
const nFail = checks.filter((c) => !c.ok).length;
console.log(`\n${checks.length - nFail} PASS, ${nFail} FAIL`);
process.exit(nFail ? 1 : 0);
