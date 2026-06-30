import fs from "fs";
import path from "path";

function loadEnv() {
  for (const file of [".env.verify.local", ".env.local"]) {
    const envPath = path.join(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadEnv();

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL;

if (!dbUrl) {
  console.log(
    "SKIP: הגדר DATABASE_URL והרץ שוב, או הרץ ידנית ב-Supabase SQL Editor:\n" +
      "  supabase/migrations/017_document_center_50mb_limit.sql"
  );
  process.exit(0);
}

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.log("SKIP: חבילת pg לא מותקנת — הרץ migration 017 ב-SQL Editor");
  process.exit(0);
}

const sql = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/017_document_center_50mb_limit.sql"),
  "utf8"
);

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
const { rows } = await client.query(
  "select id, file_size_limit from storage.buckets where id = 'document-center'"
);
await client.end();

console.log("OK: migration 017 applied", rows[0] ?? "bucket not found");
