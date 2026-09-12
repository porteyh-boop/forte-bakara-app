import fs from "fs";
import path from "path";

function loadEnvFiles() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.verify.local"),
    path.join(process.cwd(), "..", "forte-bakara-app", ".env.local"),
    path.join(process.cwd(), "..", "forte-bakara-app", ".env.verify.local"),
  ];
  for (const envPath of candidates) {
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
  process.env.POSTGRES_URL?.trim() ||
  process.env.POSTGRES_URL_NON_POOLING?.trim();

const sqlPath = path.join(
  process.cwd(),
  "supabase/migrations/041_sales_lead_trial_portal.sql"
);

if (!fs.existsSync(sqlPath)) {
  console.error("FAIL: missing migration file", sqlPath);
  process.exit(1);
}

if (!dbUrl) {
  console.log(
    "SKIP: no DATABASE_URL / SUPABASE_DB_URL in env.\n" +
      "Apply once in Supabase SQL Editor (single transaction recommended):\n" +
      `  ${sqlPath}\n` +
      "Rollback win function only (no data delete):\n" +
      "  supabase/rollback/041_restore_pre_trial_win_convert.sql"
  );
  process.exit(2);
}

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.error(
    "FAIL: install pg (npm install pg) or run migration SQL manually in Supabase."
  );
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  const { rows } = await client.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'buildings' and column_name = 'is_trial'"
  );
  const { rows: fnRows } = await client.query(
    "select proname from pg_proc where proname = 'provision_sales_lead_trial_portal'"
  );
  if (!rows.length || !fnRows.length) {
    throw new Error("post_check_failed");
  }
  await client.query("COMMIT");
  console.log("OK: migration 041 applied in one transaction");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("FAIL: migration rolled back:", error.message ?? error);
  process.exit(1);
} finally {
  await client.end();
}
