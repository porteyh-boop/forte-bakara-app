/**
 * Dev server smoke: env presence + Master updates API (no secrets printed).
 * Usage: node scripts/probe-dev-supabase-smoke.mjs [baseUrl]
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const baseUrl = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");
const buildingId = "bty4";

const vars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FORTE_SESSION_SECRET",
  "MASTER_CODE",
];

console.log("\n=== Dev env + Supabase smoke ===\n");
for (const v of vars) {
  const val = process.env[v]?.trim();
  console.log(`  ${v}: ${val ? "loaded" : "MISSING"}`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.log("\nEnv FAIL: Supabase vars missing\n");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const { error: pingErr } = await sb.from("buildings").select("building_id").limit(1);
if (pingErr) {
  console.log("\nDirect Supabase query FAIL:", pingErr.message);
  process.exit(1);
}
console.log("\nDirect Supabase query: PASS");

import { createHmac } from "crypto";
const FORTE_MASTER_SESSION_COOKIE = "forte_master_api_session";
function createMasterSessionToken() {
  const secret = process.env.FORTE_SESSION_SECRET?.trim();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8;
  const payload = `forte-master:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${exp}.${sig}`;
}
const token = createMasterSessionToken();
if (!token) {
  console.log("\nMaster session token: FAIL (FORTE_SESSION_SECRET?)");
  process.exit(1);
}

const getRes = await fetch(
  `${baseUrl}/forte/api/master/building-client-updates?buildingId=${encodeURIComponent(buildingId)}`,
  {
    headers: {
      origin: baseUrl,
      cookie: `${FORTE_MASTER_SESSION_COOKIE}=${token}`,
    },
  }
);
const getBody = await getRes.text();
console.log(`\nGET master updates: ${getRes.status}`);
if (getRes.status !== 200 || getBody.includes("fetch failed")) {
  console.log(getBody.slice(0, 300));
  process.exit(1);
}
console.log("GET: PASS");

const qaTitle = `QA_SMOKE_${Date.now()}`;
const postRes = await fetch(`${baseUrl}/forte/api/master/building-client-updates`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    origin: baseUrl,
    cookie: `${FORTE_MASTER_SESSION_COOKIE}=${token}`,
  },
  body: JSON.stringify({
    input: {
      buildingId,
      title: qaTitle,
      body: "smoke",
      updateType: "general",
      status: "for_information",
      visibleToClient: false,
    },
  }),
});
const postJson = await postRes.json().catch(() => ({}));
console.log(`POST create: ${postRes.status}`);
if (postRes.status !== 200 || postJson.error || !postJson.update?.id) {
  console.log(JSON.stringify(postJson).slice(0, 400));
  process.exit(1);
}
console.log("POST: PASS");
const id = postJson.update.id;
await sb.from("building_client_updates").delete().eq("id", id);
console.log("Cleanup: PASS\n");
