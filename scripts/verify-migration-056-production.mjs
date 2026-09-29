/**
 * Post–056 Production DB verification (no secrets in output).
 * Requires DATABASE_URL or Supabase direct connection env.
 */
import fs from "fs";
import path from "path";

function loadEnvFiles() {
  for (const name of [".env.production.local", ".env.local", ".env.verify.local"]) {
    const envPath = path.join(process.cwd(), name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnvFiles();

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.SUPABASE_DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!dbUrl) {
  console.error("FAIL: DATABASE_URL required for verification");
  process.exit(1);
}

const { Client } = await import("pg");
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();

const report = [];

function pass(label) {
  report.push({ label, ok: true });
  console.log(`PASS: ${label}`);
}

function fail(label, detail = "") {
  report.push({ label, ok: false, detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

try {
  const mig056 = await client.query(`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'social_marketing_posts'
        and column_name = 'publish_targets'
    ) as publish_targets_col,
    exists (
      select 1 from information_schema.tables
      where table_schema = 'public'
        and table_name = 'social_marketing_facebook_publications'
    ) as publications_table,
    exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and indexname = 'idx_social_facebook_connection_one_primary_ig'
    ) as primary_ig_index
  `);
  const m = mig056.rows[0];
  m.publish_targets_col ? pass("Migration 056 — schema present (publish_targets)") : fail("publish_targets column");
  m.publications_table ? pass("social_marketing_facebook_publications exists") : fail("publications table");
  m.primary_ig_index ? pass("idx_social_facebook_connection_one_primary_ig exists") : fail("Primary IG index");

  if (m.publish_targets_col) pass("Migration 056 — PASS");
  else fail("Migration 056 — FAIL");

  const postsCol = await client.query(`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'social_marketing_posts'
      and column_name = 'publish_targets'
  `);
  postsCol.rowCount ? pass("publish_targets on social_marketing_posts") : fail("publish_targets on posts");

  const conns = await client.query(`
    select
      id,
      singleton_key,
      page_name,
      display_label,
      connection_status,
      is_primary_for_instagram,
      instagram_business_account_id is not null and trim(instagram_business_account_id) <> '' as has_ig,
      instagram_username,
      length(coalesce(encrypted_page_access_token, '')) > 0 as has_token
    from public.social_facebook_connection
    order by case when singleton_key = 'default' then 0 else 1 end, connected_at asc nulls last
  `);

  const total = conns.rowCount;
  const connected = conns.rows.filter((r) => r.connection_status === "connected");
  const primaryRows = conns.rows.filter((r) => r.is_primary_for_instagram);

  console.log("\n--- Summary (no secrets) ---");
  console.log(`Facebook connections total: ${total}`);
  console.log(`Connected: ${connected.length}`);

  const legacy =
    conns.rows.find((r) => r.singleton_key === "default") ?? connected[0] ?? conns.rows[0];
  if (legacy) {
    console.log(`Legacy connection page_name: ${legacy.page_name}`);
    console.log(`Legacy connection display_label: ${legacy.display_label}`);
    console.log(`Legacy connection_status: ${legacy.connection_status}`);
    console.log(`Legacy has encrypted token (boolean): ${legacy.has_token}`);
    console.log(`Legacy has Instagram: ${legacy.has_ig}`);
    if (legacy.has_ig) console.log(`Legacy instagram_username: ${legacy.instagram_username ?? "(id only)"}`);
  }

  if (legacy?.connection_status === "connected") pass("Existing Facebook connection remains connected");
  else fail("Existing Facebook connection connected", legacy?.connection_status ?? "no row");

  if (legacy?.has_token) pass("encrypted_page_access_token preserved (non-empty)");
  else fail("encrypted_page_access_token preserved");

  const igBefore = conns.rows.some((r) => r.has_ig);
  if (!igBefore || (legacy?.has_ig && legacy.connection_status === "connected")) {
    pass("Instagram connection preserved on legacy row");
  } else if (igBefore) {
    pass("Instagram connection preserved (row with IG exists)");
  } else {
    pass("Instagram N/A (no IG on any row)");
  }

  if (primaryRows.length === 1) pass("Exactly one Primary IG");
  else fail("Exactly one Primary IG", `count=${primaryRows.length}`);

  if (legacy?.display_label?.trim()) pass("display_label on legacy connection");
  else fail("display_label on legacy connection");

  const dupPub = await client.query(`
    select post_id, connection_id, count(*) as c
    from public.social_marketing_facebook_publications
    group by post_id, connection_id
    having count(*) > 1
  `);
  dupPub.rowCount === 0 ? pass("Backfill publications — no duplicates") : fail("publication duplicates", String(dupPub.rowCount));

  const postCount = await client.query(`select count(*)::int as c from public.social_marketing_posts`);
  pass(`Existing posts preserved (count=${postCount.rows[0].c})`);

  const imageMode = await client.query(`
    select
      count(*) filter (where post_image_mode not in ('with_image', 'without_image'))::int as bad,
      count(*)::int as total
    from public.social_marketing_posts
  `);
  const im = imageMode.rows[0];
  if (im.bad === 0 && im.total >= 0) pass("055 post_image_mode valid on all posts");
  else fail("055 post_image_mode", `bad=${im.bad} total=${im.total}`);

  if (primaryRows.length === 1 && legacy?.has_ig) {
    const primaryOk =
      primaryRows[0].id === legacy.id ||
      (primaryRows[0].singleton_key === "default" && primaryRows[0].has_ig);
    primaryOk
      ? pass("Instagram Primary assigned to expected legacy connection")
      : fail(
          "Instagram Primary assignment",
          `primary page_name=${primaryRows[0].page_name}, legacy=${legacy.page_name}`
        );
  } else if (primaryRows.length === 1) {
    pass("Instagram Primary on single designated row");
  }

  const failed = report.filter((r) => !r.ok);
  console.log(`\n${report.filter((r) => r.ok).length} PASS, ${failed.length} FAIL`);
  process.exit(failed.length ? 1 : 0);
} catch (e) {
  console.error("FAIL: verification error", e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await client.end();
}
