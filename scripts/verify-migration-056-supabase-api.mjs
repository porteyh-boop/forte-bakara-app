/**
 * Partial 056 verification via Supabase REST (service role). No DDL, no secrets logged.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("FAIL: Supabase URL / service role missing");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: posts, error: postsErr } = await sb
    .from("social_marketing_posts")
    .select("id, post_image_mode, publish_targets")
    .limit(5);

  const migrationApplied = !postsErr && posts !== null;
  if (postsErr?.message?.includes("publish_targets")) {
    console.log("Migration 056 NOT applied yet (publish_targets missing)");
    process.exit(2);
  }
  if (postsErr) {
    console.error("FAIL: posts query", postsErr.message);
    process.exit(1);
  }

  const { data: pubs, error: pubErr } = await sb
    .from("social_marketing_facebook_publications")
    .select("id, post_id, connection_id")
    .limit(1000);
  if (pubErr) {
    console.error("FAIL: publications", pubErr.message);
    process.exit(1);
  }

  const { data: conns, error: connErr } = await sb
    .from("social_facebook_connection")
    .select(
      "id, singleton_key, page_name, display_label, connection_status, is_primary_for_instagram, instagram_username, instagram_business_account_id, encrypted_page_access_token"
    );
  if (connErr) {
    console.error("FAIL: connections", connErr.message);
    process.exit(1);
  }

  const rows = conns ?? [];
  const connected = rows.filter((r) => r.connection_status === "connected");
  const primary = rows.filter((r) => r.is_primary_for_instagram);
  const legacy = rows.find((r) => r.singleton_key === "default") ?? connected[0] ?? rows[0];

  const dup = new Map();
  for (const p of pubs ?? []) {
    const k = `${p.post_id}:${p.connection_id}`;
    dup.set(k, (dup.get(k) ?? 0) + 1);
  }
  const dupCount = [...dup.values()].filter((c) => c > 1).length;

  const badImage = (posts ?? []).filter(
    (p) => p.post_image_mode !== "with_image" && p.post_image_mode !== "without_image"
  );

  console.log("Migration 056 schema via API: applied");
  console.log(`Facebook connections total: ${rows.length}`);
  console.log(`Connected: ${connected.length}`);
  if (legacy) {
    console.log(`Legacy page_name: ${legacy.page_name}`);
    console.log(`Legacy display_label: ${legacy.display_label}`);
    console.log(`Legacy connection_status: ${legacy.connection_status}`);
    console.log(
      `Legacy token present: ${Boolean(legacy.encrypted_page_access_token?.length)}`
    );
    console.log(
      `Legacy IG: ${legacy.instagram_username ?? (legacy.instagram_business_account_id ? "(id set)" : "none")}`
    );
  }
  console.log(`Primary IG count: ${primary.length}`);
  if (primary[0]) {
    console.log(`Primary page_name: ${primary[0].page_name}`);
    console.log(`Primary display_label: ${primary[0].display_label}`);
  }
  console.log(`Publications rows (sample cap 1000): ${pubs?.length ?? 0}`);
  console.log(`Publication duplicate pairs: ${dupCount}`);
  console.log(`Posts sampled: ${posts?.length ?? 0}, bad post_image_mode: ${badImage.length}`);
  console.log(`INDEX idx_social_facebook_connection_one_primary_ig: cannot verify via REST`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
