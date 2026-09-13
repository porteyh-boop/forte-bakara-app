/**
 * Production QA integration (synthetic lead only). Requires:
 * - migration 041 applied
 * - FORTE_SALES_TRIAL_PORTAL_ENABLED=true
 * - FORTE_SALES_TRIAL_PORTAL_ALLOWED_LEAD_IDS=<qa-lead-uuid>
 * - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env (from .env.local)
 *
 * Run: node scripts/qa-sales-trial-portal-integration.mjs
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
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
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const enabled = process.env.FORTE_SALES_TRIAL_PORTAL_ENABLED?.trim().toLowerCase();
const allowedRaw = process.env.FORTE_SALES_TRIAL_PORTAL_ALLOWED_LEAD_IDS?.trim() ?? "";
const existingLeadId =
  process.env.FORTE_QA_TRIAL_EXISTING_LEAD_ID?.trim().toLowerCase() ?? "";

if (!url || !key) {
  console.error("FAIL: missing Supabase URL or service role in env");
  process.exit(1);
}
if (!(enabled === "true" || enabled === "1")) {
  console.error("FAIL: set FORTE_SALES_TRIAL_PORTAL_ENABLED=true for this script only");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

const QA_PREFIX = "QA-TRIAL-PORTAL";
const QA_EMAIL = `qa-${Date.now()}@qa.forte.invalid`;
const QA_PHONE = "0500000000";

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function columnExists(name, table) {
  const { data, error } = await client
    .from(table)
    .select(name)
    .limit(1);
  if (error?.message?.includes(name)) return false;
  return !error;
}

async function main() {
  console.log("\nTrial portal integration QA (synthetic)\n");

  if (!(await columnExists("is_trial", "buildings"))) {
    bad("migration 041", "buildings.is_trial missing");
    process.exit(1);
  }
  ok("migration 041 columns visible");

  let leadId = existingLeadId;
  if (leadId) {
    const { data: existing, error: existingErr } = await client
      .from("sales_leads")
      .select("id, trial_building_id, client_name")
      .eq("id", leadId)
      .maybeSingle();
    if (existingErr || !existing?.id) {
      bad("load existing QA lead", existingErr?.message ?? "not_found");
      process.exit(1);
    }
    if (!String(existing.client_name ?? "").startsWith(QA_PREFIX)) {
      bad("existing lead is not QA-TRIAL-PORTAL synthetic");
      process.exit(1);
    }
    ok(`use existing QA lead ${leadId}`);
  } else {
    const { data: leadRow, error: leadErr } = await client
      .from("sales_leads")
      .insert({
        client_name: `${QA_PREFIX} ${new Date().toISOString().slice(0, 10)}`,
        building_name: `${QA_PREFIX} בניין`,
        address: "רחוב QA 1",
        city: "QA",
        contact_name: "QA וועד",
        phone: QA_PHONE,
        email: QA_EMAIL,
        status: "חדש",
      })
      .select("id")
      .single();

    if (leadErr || !leadRow?.id) {
      bad("create QA lead", leadErr?.message);
      process.exit(1);
    }
    leadId = leadRow.id;
    ok("create QA lead");
  }

  if (allowedRaw && !allowedRaw.toLowerCase().includes(leadId.toLowerCase())) {
    console.log(
      `NOTE: add lead to FORTE_SALES_TRIAL_PORTAL_ALLOWED_LEAD_IDS=${leadId} then re-run provision tests`
    );
  }

  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { data: p1, error: e1 } = await client.rpc(
    "provision_sales_lead_trial_portal",
    {
      p_lead_id: leadId,
      p_expires_at: expiresAt,
      p_elevators: [
        { name: "QA מעלית 1", floors_count: 10 },
        { name: "QA מעלית 2", floors_count: 12 },
      ],
    }
  );
  if (e1 || !p1?.building_id) {
    bad("provision trial", e1?.message);
    process.exit(1);
  }
  const buildingId = p1.building_id;
  ok("provision trial");

  const { data: p2, error: e2 } = await client.rpc(
    "provision_sales_lead_trial_portal",
    {
      p_lead_id: leadId,
      p_expires_at: expiresAt,
      p_elevators: [{ name: "QA מעלית 1", floors_count: 10 }],
    }
  );
  if (e2 || p2?.building_id !== buildingId || p2?.already_provisioned !== true) {
    bad("idempotent provision", e2?.message ?? "building mismatch");
  } else ok("idempotent provision");

  const { data: bld } = await client
    .from("buildings")
    .select("is_trial, order_amount")
    .eq("building_id", buildingId)
    .single();
  if (bld?.is_trial !== true || bld?.order_amount != null) {
    bad("trial building flags");
  } else ok("trial building is_trial, no order_amount");

  const { count: bizCount } = await client
    .from("buildings")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_trial", false);
  if (bizCount == null) bad("business buildings count");
  else ok("business query excludes is_trial filter path");

  const { data: win, error: winErr } = await client.rpc(
    "convert_sales_lead_win_to_project",
    {
      p_lead_id: leadId,
      p_name: `${QA_PREFIX} בניין`,
      p_city: "QA",
      p_address: "רחוב QA 1",
      p_management_company: QA_PREFIX,
      p_contact_name: "QA",
      p_contact_phone: QA_PHONE,
      p_project_notes: "QA win",
      p_project_type: "standard",
      p_order_amount: 1,
      p_service_type: null,
      p_service_type_other: null,
      p_contact_id: null,
    }
  );
  if (winErr || win?.building_id !== buildingId || win?.from_trial !== true) {
    bad("win reuses trial building", winErr?.message);
  } else ok("win reuses trial building");

  const { data: afterWin } = await client
    .from("buildings")
    .select("is_trial")
    .eq("building_id", buildingId)
    .single();
  if (afterWin?.is_trial !== false) bad("is_trial cleared on win");
  else ok("is_trial cleared on win");

  console.log(`\nQA lead id (keep for review): ${leadId}`);
  console.log(`QA building id: ${buildingId}`);
  console.log(`\nDone: ${passed} passed, ${failed} failed\n`);
  if (failed) process.exit(1)