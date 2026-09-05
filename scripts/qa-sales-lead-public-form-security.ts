/**
 * Public sales-lead intake — API lockdown + migration grants.
 * Run: npx tsx scripts/qa-sales-lead-public-form-security.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST as publicSalesPOST } from "../app/api/public/sales-lead/route";
import { resetPublicSalesLeadFormMemoryForTests } from "../lib/sales-lead-public-form-server";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function makeRequest(
  init?: {
    method?: string;
    body?: unknown;
    origin?: boolean;
    idempotencyKey?: string;
  }
): NextRequest {
  const url = "http://localhost:3000/api/public/sales-lead";
  const headers: Record<string, string> = {
    host: "localhost:3000",
    "Content-Type": "application/json",
  };
  if (init?.origin !== false) headers.origin = "http://localhost:3000";
  if (init?.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  return new NextRequest(url, {
    method: init?.method ?? "POST",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function main(): Promise<void> {
  console.log("\n=== Public sales lead form security QA ===\n");
  resetPublicSalesLeadFormMemoryForTests();

  const noOrigin = await publicSalesPOST(makeRequest({ origin: false, body: {} }));
  assert(noOrigin.status === 403, "POST without origin → 403");
  const noOriginBody = (await noOrigin.json()) as { error?: string };
  assert(noOriginBody.error === "origin_not_allowed", "403 body is origin_not_allowed");

  const badJson = new NextRequest("http://localhost:3000/api/public/sales-lead", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: "{",
  });
  const badJsonRes = await publicSalesPOST(badJson);
  assert(badJsonRes.status === 400, "invalid JSON → 400");

  const missingKey = await publicSalesPOST(
    makeRequest({
      body: {
        clientName: "ועד",
        contactName: "ישראל",
        phone: "0501234567",
        startedAt: Date.now() - 5000,
      },
    })
  );
  assert(missingKey.status === 400, "missing idempotency key → 400");

  const route = read("app/api/public/sales-lead/route.ts");
  assert(route.includes("isAllowedForteApiOrigin"), "public API origin check");
  assert(route.includes("export async function POST"), "POST only create");
  assert(!/\bexport async function GET\b/.test(route), "no GET export");
  assert(!/\bexport async function PATCH\b/.test(route), "no PATCH export");
  assert(!/\bexport async function PUT\b/.test(route), "no PUT export");
  assert(!/\bexport async function DELETE\b/.test(route), "no DELETE export");
  assert(!route.includes("listSalesLeads"), "route does not read/list leads");
  assert(
    !route.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !route.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    "route file does not embed supabase keys"
  );

  const server = read("lib/sales-lead-public-form-server.ts");
  assert(server.includes("getSupabaseServiceClient"), "writes via service client");
  assert(!server.includes("getPilotSupabaseClient"), "no browser supabase client");
  assert(server.includes("consumeRateLimitBucket"), "in-memory rate limit");
  assert(server.includes("SALES_LEAD_FORM_SUBMISSIONS_TABLE"), "durable idempotency table");
  assert(
    server.includes("PUBLIC_SALES_LEAD_SUBMIT_RPC") &&
      server.includes(".rpc(") &&
      !server.includes("createSalesLeadServer") &&
      !server.includes("updateSalesLeadServer"),
    "server submit uses RPC only"
  );
  assert(
    route.includes("return json({ ok: true }") && !route.includes("lead:"),
    "success response is ok-only, no lead payload"
  );

  const form = read("components/public/PublicSalesLeadForm.tsx");
  assert(
    !form.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !form.includes("getSupabaseServiceClient") &&
      !form.includes("createClient("),
    "browser form exposes no service role"
  );

  const migration = read("supabase/migrations/039_sales_lead_public_form.sql");
  assert(
    migration.includes("create table if not exists public.sales_lead_form_submissions") &&
      migration.includes("enable row level security") &&
      migration.includes(
        "revoke all on table public.sales_lead_form_submissions from public, anon, authenticated"
      ) &&
      migration.includes(
        "grant select, insert on table public.sales_lead_form_submissions to service_role"
      ) &&
      migration.includes("create or replace function public.submit_public_sales_lead_form") &&
      migration.includes("pg_advisory_xact_lock") &&
      migration.includes("set search_path = public") &&
      migration.includes("security invoker") &&
      migration.includes(
        "revoke all on function public.submit_public_sales_lead_form"
      ) &&
      migration.includes("from public, anon, authenticated") &&
      migration.includes(
        "grant execute on function public.submit_public_sales_lead_form"
      ) &&
      migration.includes("to service_role") &&
      !migration.includes("grant select, insert, update, delete") &&
      !migration.includes("create_building_atomic") &&
      !migration.includes("convert_sales_lead_win_to_project"),
    "039: table + atomic RPC locked to service_role; no security-branch RPC"
  );

  const untouched = [
    "components/master-v2/MasterProjectsTable.tsx",
    "lib/project-financial.ts",
    "lib/client-access.ts",
    "app/manifest.ts",
  ];
  for (const file of untouched) {
    assert(fs.existsSync(path.join(process.cwd(), file)), `${file}: left in place`);
  }

  const winConvert = read("lib/sales-lead-win-convert.ts");
  assert(
    !read("lib/sales-lead-public-form.ts").includes("create_building_atomic") &&
      !read("lib/sales-lead-public-form-server.ts").includes("create_building_atomic") &&
      winConvert.includes("convert_sales_lead_win_to_project"),
    "public form does not include security-branch RPC"
  );

  console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
