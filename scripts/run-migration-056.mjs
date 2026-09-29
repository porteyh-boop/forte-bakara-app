import fs from "fs";
import path from "path";

function loadEnvFiles() {
  const candidates = [
    path.join(process.cwd(), ".env.production.local"),
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
  "supabase/migrations/056_social_multi_facebook_pages.sql"
);

if (!fs.existsSync(sqlPath)) {
  console.error("FAIL: missing migration file", sqlPath);
  process.exit(1);
}

if (!dbUrl) {
  console.error(
    "FAIL: set DATABASE_URL (Supabase Session pooler) to apply migration 056"
  );
  process.exit(1);
}

const { Client } = await import("pg");
const sql = fs.readFileSync(sqlPath, "utf8");
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("OK: migration 056 applied");
} catch (e) {
  console.error("FAIL: migration 056", e instanceof Error ? e.message : String(e));
  process.exit(1);
} finally {
  await client.end();
}
