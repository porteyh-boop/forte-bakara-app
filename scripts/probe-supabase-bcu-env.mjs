/**
 * Probe which Supabase project .env.local uses and whether migration 046 tables exist.
 * Does not print secrets.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local"]) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const keyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
let projectRef = "";
try {
  projectRef = new URL(url).hostname.split(".")[0] ?? "";
} catch {
  projectRef = "(invalid URL)";
}

console.log("\n=== Supabase env probe (BCU) ===\n");
console.log(`NEXT_PUBLIC_SUPABASE_URL host: ${url ? new URL(url).hostname : "(missing)"}`);
console.log(`Project ref: ${projectRef || "(unknown)"}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY configured: ${keyPresent ? "yes" : "no"}`);
console.log(`Integration script loads: .env.local only (same as this probe)`);
console.log(`Next.js dev loads: .env.local (per next build output)`);

if (!url || !keyPresent) {
  console.log("\nCannot probe tables — missing URL or service role key.\n");
  process.exit(1);
}

const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false },
});

async function probeTable(name) {
  const { error } = await sb.from(name).select("id").limit(1);
  if (!error) return { exists: true, hint: null };
  const msg = String(error.message ?? error.code ?? "unknown");
  const code = String(error.code ?? "");
  if (code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache")) {
    return { exists: false, hint: msg };
  }
  return { exists: false, hint: `${code}: ${msg}` };
}

const updates = await probeTable("building_client_updates");
const reads = await probeTable("building_client_update_reads");
const permCol = await sb
  .from("client_permissions")
  .select("can_view_client_updates")
  .limit(1);

console.log("\nTable building_client_updates:", updates.exists ? "EXISTS" : "MISSING");
if (updates.hint) console.log(`  detail: ${updates.hint}`);
console.log("Table building_client_update_reads:", reads.exists ? "EXISTS" : "MISSING");
if (reads.hint) console.log(`  detail: ${reads.hint}`);
console.log(
  "Column client_permissions.can_view_client_updates:",
  permCol.error ? `MISSING/ERROR (${permCol.error.message})` : "EXISTS"
);

console.log("\nDev vs integration: SAME project (both use NEXT_PUBLIC_SUPABASE_URL from .env.local)\n");
