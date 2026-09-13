import fs from "fs";
import path from "path";

function loadEnvFiles() {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env.verify.local"),
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
  "supabase/migrations/044_trial_provision_elevator_floors_count.sql"
);

if (!fs.existsSync(sqlPath)) {
  console.error("FAIL: missing migration file", sqlPath);
  process.exit(1);
}

if (!dbUrl) {
  console.log(
    "SKIP: no DATABASE_URL / SUPABASE_DB_URL in env.\n" +
      "Apply once in Supabase SQL Editor (single transaction recommended):\n" +
      "  supabase/migrations/044_trial_provision_elevator_floors_count_SQL_EDITOR.sql"
  );
  process.exit(2);
}

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.error("FAIL: install pg (npm install pg) or run migration SQL manually.");
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
    "select pg_get_function_arguments(p.oid) as args, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'provision_sales_lead_trial_portal'"
  );
  const args = rows[0]?.args ?? "";
  const def = rows[0]?.def ?? "";
  if (!args.includes("p_elevators jsonb")) {
    throw new Error("post_check_failed: expected p_elevators jsonb signature");
  }
  if (!def.includes("floors_count")) {
    throw new Error("post_check_failed: expected floors_count in elevator insert");
  }
  await client.query("COMMIT");
  console.log("OK: migration 044 applied in one transaction");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("FAIL: migration rolled back:", error.message ?? error);
  process.exit(1);
} finally {
  await client.end();
}
