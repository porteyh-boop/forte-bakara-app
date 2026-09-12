/**
 * Read-only pgcrypto / provision diagnostics (no DDL, no provision RPC on real leads).
 */
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
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

const QA_LEAD = "26b5010a-85c4-476d-ad38-4ba13ce5f764";

const { data: leadRow } = await client
  .from("sales_leads")
  .select("id, trial_building_id, trial_client_user_id, client_name, building_name")
  .eq("id", QA_LEAD)
  .maybeSingle();

const { data: qaHistory } = await client
  .from("sales_lead_history")
  .select("id, kind, entry_text, occurred_at")
  .eq("lead_id", QA_LEAD)
  .order("occurred_at", { ascending: false })
  .limit(5);

const { error: provisionErr } = await client.rpc(
  "provision_sales_lead_trial_portal",
  {
    p_lead_id: "00000000-0000-4000-8000-000000000000",
    p_expires_at: new Date(Date.now() + 86400000).toISOString(),
    p_elevator_names: ["x"],
  }
);

let orphanBuildings = [];
if (leadRow?.building_name) {
  const { data: bld } = await client
    .from("buildings")
    .select("building_id, is_trial, name")
    .ilike("name", leadRow.building_name.trim())
    .eq("is_trial", true);
  orphanBuildings = bld ?? [];
}

console.log(
  JSON.stringify(
    {
      ok: true,
      manualCatalogSql: [
        "select extname, n.nspname as schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace where extname = 'pgcrypto';",
        "select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'gen_random_bytes' order by 1, 2;",
        "select coalesce(array_to_string(p.proconfig, ', '), '') as proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'provision_sales_lead_trial_portal';",
      ],
      provisionSearchPathFromMigration041: "public",
      provisionProbeOnMissingLead: provisionErr?.message ?? null,
      qaLead: leadRow,
      qaLeadHistoryRecent: qaHistory,
      trialBuildingsMatchingLeadName: orphanBuildings,
      partialProvisionLikely:
        !leadRow?.trial_building_id && (orphanBuildings?.length ?? 0) > 0,
    },
    null,
    2
  )
);
