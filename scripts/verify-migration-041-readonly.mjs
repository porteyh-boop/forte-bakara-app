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

async function columnOk(table, name) {
  const { error } = await client.from(table).select(name).limit(0);
  return !error;
}

function rpcExists(err) {
  if (!err) return true;
  const msg = err.message ?? "";
  return !msg.includes("Could not find the function");
}

const checks = {
  buildings_is_trial: await columnOk("buildings", "is_trial"),
  sales_leads_trial_building_id: await columnOk("sales_leads", "trial_building_id"),
  sales_leads_trial_client_user_id: await columnOk(
    "sales_leads",
    "trial_client_user_id"
  ),
};

const fakeLead = "00000000-0000-4000-8000-000000000000";
const expiresAt = new Date(Date.now() + 86400000).toISOString();

const { error: provisionErr } = await client.rpc("provision_sales_lead_trial_portal", {
  p_lead_id: fakeLead,
  p_expires_at: expiresAt,
  p_elevator_names: ["x"],
});
checks.provision_sales_lead_trial_portal = rpcExists(provisionErr);

const { error: winErr } = await client.rpc("convert_sales_lead_win_to_project", {
  p_lead_id: fakeLead,
  p_name: "x",
  p_city: null,
  p_address: null,
  p_management_company: null,
  p_contact_name: null,
  p_contact_phone: null,
  p_project_notes: null,
  p_project_type: "standard",
  p_order_amount: 1,
  p_service_type: null,
  p_service_type_other: null,
  p_contact_id: null,
});
checks.convert_sales_lead_win_to_project = rpcExists(winErr);

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, note: "read-only; no migration re-run" }, null, 2));
process.exit(ok ? 0 : 1);
