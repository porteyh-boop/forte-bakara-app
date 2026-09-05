/**
 * Sales-lead notification lockdown.
 * Run: npx tsx scripts/qa-sales-lead-notifications-security.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { GET as listNotifications } from "../app/forte/api/master-sales-lead-notifications/route";
import { POST as markRead } from "../app/forte/api/master-sales-lead-notifications/read/route";

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
  pathName: string,
  init?: { method?: string; body?: unknown; origin?: boolean }
): NextRequest {
  const url = `http://localhost:3000${pathName}`;
  const headers: Record<string, string> = {
    host: "localhost:3000",
    "Content-Type": "application/json",
  };
  if (init?.origin !== false) headers.origin = "http://localhost:3000";
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function main(): Promise<void> {
  console.log("\n=== Sales lead notifications security QA ===\n");

  const noOrigin = await listNotifications(
    makeRequest("/forte/api/master-sales-lead-notifications", { origin: false })
  );
  assert(noOrigin.status === 403, "GET notifications without origin → 403");

  const noSession = await listNotifications(
    makeRequest("/forte/api/master-sales-lead-notifications")
  );
  assert(noSession.status === 401 || noSession.status === 503, "GET notifications without session is blocked");

  const readNoOrigin = await markRead(
    makeRequest("/forte/api/master-sales-lead-notifications/read", {
      method: "POST",
      origin: false,
      body: { notificationId: "x" },
    })
  );
  assert(readNoOrigin.status === 403, "POST read without origin → 403");

  const listRoute = read("app/forte/api/master-sales-lead-notifications/route.ts");
  const readRoute = read(
    "app/forte/api/master-sales-lead-notifications/read/route.ts"
  );
  assert(
    listRoute.includes("isAllowedForteApiOrigin") &&
      listRoute.includes("requireMasterApiSession") &&
      readRoute.includes("isAllowedForteApiOrigin") &&
      readRoute.includes("requireMasterApiSession") &&
      readRoute.includes("invalid_input"),
    "Master notification APIs require origin + session + validation"
  );

  const migration = read("supabase/migrations/040_sales_lead_notifications.sql");
  assert(
    migration.includes("enable row level security") &&
      migration.includes(
        "revoke all on table public.sales_lead_notifications from public, anon, authenticated"
      ) &&
      migration.includes(
        "grant select, insert, update on table public.sales_lead_notifications to service_role"
      ) &&
      migration.includes(
        "revoke all on function public.submit_public_sales_lead_form"
      ) &&
      migration.includes("from public, anon, authenticated") &&
      migration.includes("to service_role") &&
      !migration.includes("grant select, insert, update, delete") &&
      !migration.includes("create_building_atomic"),
    "040 table + RPC locked to service_role"
  );

  const provider = read(
    "components/master-v2/MasterSalesLeadNotificationsProvider.tsx"
  );
  assert(
    provider.includes("listSalesLeadNotifications") &&
      !provider.includes("createClient(") &&
      !provider.includes("getSupabaseServiceClient") &&
      !read("lib/sales-lead-notifications.ts").includes("TELEGRAM_BOT_TOKEN") &&
      !read("lib/telegram.ts").includes("NEXT_PUBLIC_TELEGRAM"),
    "browser polls Master API only; telegram token stays server-side"
  );

  const publicRoute = read("app/api/public/sales-lead/route.ts");
  assert(
    publicRoute.includes("return json({ ok: true }") &&
      !publicRoute.includes("notification_id") &&
      !publicRoute.includes("lead_id"),
    "public success body does not leak lead or notification ids"
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
