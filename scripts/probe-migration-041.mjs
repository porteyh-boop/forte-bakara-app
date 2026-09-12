import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

for (const file of [
  ".env.local",
  path.join("..", "forte-bakara-app", ".env.local"),
]) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "supabase_env_missing" }));
  process.exit(0);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const { error } = await client.from("buildings").select("is_trial").limit(1);
const applied = !error;
console.log(
  JSON.stringify({
    ok: true,
    migration041Applied: applied,
    probeError: error?.message ?? null,
  })
);
