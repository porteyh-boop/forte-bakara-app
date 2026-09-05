/**
 * Master sales leads — server authorization + migration lockdown QA.
 * Run: npx tsx scripts/qa-master-sales-leads-security.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";

function loadEnvFile(rel: string): void {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

import {
  createMasterSessionToken,
  FORTE_MASTER_SESSION_COOKIE,
} from "../lib/forte-master-api-auth";
import {
  GET as listSalesGET,
  POST as createSalesPOST,
} from "../app/forte/api/master-sales-leads/route";
import { PATCH as patchSalesPATCH } from "../app/forte/api/master-sales-leads/[leadId]/route";

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

function makeMasterApiRequest(
  urlPath: string,
  init?: { method?: string; body?: unknown; cookie?: string; origin?: boolean }
): NextRequest {
  const url = `http://localhost:3000${urlPath}`;
  const headers: Record<string, string> = {
    host: "localhost:3000",
    "Content-Type": "application/json",
  };
  if (init?.origin !== false) headers.origin = "http://localhost:3000";
  if (init?.cookie) headers.cookie = init.cookie;

  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function masterSessionCookie(): string | null {
  const token = createMasterSessionToken();
  if (!token) return null;
  return `${FORTE_MASTER_SESSION_COOKIE}=${token}`;
}

async function main(): Promise<void> {
  console.log("\n=== Master Sales Leads Security QA ===\n");

  const prevSecret = process.env.FORTE_SESSION_SECRET;
  const prevCode = process.env.MASTER_CODE;
  process.env.FORTE_SESSION_SECRET = "qa-test-secret";
  process.env.MASTER_CODE = "qa-test-code";

  const noOrigin = await listSalesGET(
    makeMasterApiRequest("/forte/api/master-sales-leads", { origin: false })
  );
  assert(noOrigin.status === 403, "GET without origin → 403");

  const listUnauth = await listSalesGET(
    makeMasterApiRequest("/forte/api/master-sales-leads")
  );
  assert(listUnauth.status === 401, "GET without session → 401");

  const createUnauth = await createSalesPOST(
    makeMasterApiRequest("/forte/api/master-sales-leads", {
      method: "POST",
      body: { clientName: "x", status: "חדש" },
    })
  );
  assert(createUnauth.status === 401, "POST without session → 401");

  const patchUnauth = await patchSalesPATCH(
    makeMasterApiRequest("/forte/api/master-sales-leads/11111111-1111-4111-8111-111111111111", {
      method: "PATCH",
      body: { clientName: "x", status: "חדש" },
    }),
    { params: Promise.resolve({ leadId: "11111111-1111-4111-8111-111111111111" }) }
  );
  assert(patchUnauth.status === 401, "PATCH without session → 401");

  const cookie = masterSessionCookie();
  assert(Boolean(cookie), "can mint master session cookie for QA");
  if (cookie) {
    const listAuthed = await listSalesGET(
      makeMasterApiRequest("/forte/api/master-sales-leads", { cookie })
    );
    assert(
      listAuthed.status === 503 || listAuthed.status === 200,
      "GET with session reaches server (503 if Supabase missing, 200 if configured)"
    );

    const createAuthed = await createSalesPOST(
      makeMasterApiRequest("/forte/api/master-sales-leads", {
        method: "POST",
        cookie,
        body: { clientName: "x", status: "חדש" },
      })
    );
    assert(
      createAuthed.status === 503 ||
        createAuthed.status === 201 ||
        createAuthed.status === 400 ||
        createAuthed.status === 502,
      "POST with session is not a public 401"
    );

    const patchBadId = await patchSalesPATCH(
      makeMasterApiRequest("/forte/api/master-sales-leads/not-a-uuid", {
        method: "PATCH",
        cookie,
        body: { clientName: "x", status: "חדש" },
      }),
      { params: Promise.resolve({ leadId: "not-a-uuid" }) }
    );
    assert(patchBadId.status === 400, "PATCH invalid id with session → 400");
  }

  if (prevSecret === undefined) delete process.env.FORTE_SESSION_SECRET;
  else process.env.FORTE_SESSION_SECRET = prevSecret;
  if (prevCode === undefined) delete process.env.MASTER_CODE;
  else process.env.MASTER_CODE = prevCode;

  const serverSource = read("lib/sales-leads-server.ts");
  assert(
    serverSource.includes("getSupabaseServiceClient") &&
      !serverSource.includes("getPilotSupabaseClient") &&
      !serverSource.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    "sales-leads-server: service_role only"
  );

  const listRoute = read("app/forte/api/master-sales-leads/route.ts");
  const patchRoute = read("app/forte/api/master-sales-leads/[leadId]/route.ts");
  for (const [file, source] of [
    ["master-sales-leads/route.ts", listRoute],
    ["master-sales-leads/[leadId]/route.ts", patchRoute],
  ] as const) {
    assert(source.includes("requireMasterApiSession"), `${file}: requireMasterApiSession`);
    assert(source.includes("isAllowedForteApiOrigin"), `${file}: origin check`);
  }

  const apiClient = read("lib/sales-leads-api.ts");
  const view = read("components/master-v2/MasterSalesLeadsView.tsx");
  assert(
    !apiClient.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !apiClient.includes("getSupabaseServiceClient") &&
      !apiClient.includes("createClient") &&
      !view.includes("SUPABASE_SERVICE_ROLE_KEY") &&
      !view.includes("createClient("),
    "browser sales files expose no service role / supabase client"
  );

  const migration = read("supabase/migrations/037_sales_leads.sql");
  assert(
    migration.includes("create table if not exists public.sales_leads") &&
      migration.includes("create table if not exists public.sales_lead_history") &&
      migration.includes("enable row level security") &&
      migration.includes("revoke all on table public.sales_leads from public, anon, authenticated") &&
      migration.includes(
        "revoke all on table public.sales_lead_history from public, anon, authenticated"
      ) &&
      migration.includes("grant select, insert, update, delete on table public.sales_leads to service_role") &&
      migration.includes("idx_sales_leads_status") &&
      migration.includes("idx_sales_leads_follow_up_date") &&
      migration.includes("idx_sales_leads_open_follow_up") &&
      !migration.includes("create_building_atomic") &&
      !migration.includes("הצעת מחיר") &&
      !migration.includes("המרה לפרויקט"),
    "037 migration: tables + RLS + revoke public + indexes; no quotes/security-branch RPC"
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

  console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
