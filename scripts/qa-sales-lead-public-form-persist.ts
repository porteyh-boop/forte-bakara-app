/**
 * Optional live Supabase check for the public sales-lead form.
 * Skips when service credentials are missing. Does not run against Production
 * unless this environment is pointed at it.
 * Run: npx tsx scripts/qa-sales-lead-public-form-persist.ts
 */
import fs from "fs";
import path from "path";
import {
  PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT,
  PUBLIC_SALES_LEAD_SOURCE,
} from "../lib/sales-lead-public-form";
import {
  resetPublicSalesLeadFormMemoryForTests,
  submitPublicSalesLeadForm,
  SALES_LEAD_FORM_SUBMISSIONS_TABLE,
} from "../lib/sales-lead-public-form-server";
import {
  listSalesLeadsServer,
  SALES_LEAD_HISTORY_TABLE,
  SALES_LEADS_TABLE,
  updateSalesLeadServer,
} from "../lib/sales-leads-server";
import { emptySalesLeadDraft } from "../lib/sales-leads";
import { CONTACTS_TABLE } from "../lib/contacts-server";
import { getSupabaseServiceClient } from "../lib/supabase-server";

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

function key(suffix: string): string {
  return `aaaaaaaa-bbbb-4ccc-8ddd-${suffix.padStart(12, "0")}`;
}

async function main(): Promise<void> {
  console.log("\n=== Public sales lead form live persistence QA ===\n");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    console.log("  ↷ skip: no safe Supabase service credentials in this environment");
    process.exit(0);
  }

  const client = getSupabaseServiceClient();
  if (!client) {
    console.log("  ↷ skip: service client unavailable");
    process.exit(0);
  }

  resetPublicSalesLeadFormMemoryForTests();
  const marker = `qa-public-form-${Date.now()}`;
  const phone = `052${String(Date.now()).slice(-7)}`;
  const startedAt = Date.now() - 5000;

  try {
    const created = await submitPublicSalesLeadForm({
      body: {
        clientName: marker,
        contactName: "איש קשר טופס",
        phone,
        email: `${marker}@qa.example`,
        buildingName: "בניין טופס",
        city: "חיפה",
        needDescription: "פנייה מטופס",
        preferredContactAt: "בוקר",
        startedAt,
      },
      idempotencyKey: key("1"),
      startedAt,
      clientIp: "10.0.0.8",
    });
    assert(created.ok && created.status === 200, "public submit creates a lead");

    const listed = await listSalesLeadsServer();
    const lead = listed.leads.find((item) => item.clientName === marker) ?? null;
    assert(lead?.status === "חדש", "created lead status is חדש");
    assert(lead?.source === PUBLIC_SALES_LEAD_SOURCE, "created lead source is digital form");
    assert(
      Boolean(lead?.history.some((entry) => entry.text === PUBLIC_SALES_LEAD_FORM_HISTORY_TEXT)),
      "created lead has form history"
    );
    assert(Boolean(lead?.contactId), "public submit syncs a contact");
    assert(lead?.nextAction === "מועד מועדף: בוקר", "preferred time mapped");

    const replay = await submitPublicSalesLeadForm({
      body: {
        clientName: marker,
        contactName: "איש קשר טופס",
        phone,
        email: `${marker}@qa.example`,
        buildingName: "בניין טופס",
        city: "חיפה",
        needDescription: "פנייה מטופס",
        preferredContactAt: "בוקר",
        startedAt,
      },
      idempotencyKey: key("1"),
      startedAt,
      clientIp: "10.0.0.8",
    });
    assert(replay.ok && replay.status === 200, "same idempotency key replays as success");
    const listedReplay = await listSalesLeadsServer();
    assert(
      listedReplay.leads.filter((item) => item.clientName === marker).length === 1,
      "replay does not create a second lead"
    );

    const updated = await submitPublicSalesLeadForm({
      body: {
        clientName: marker,
        contactName: "איש קשר מעודכן טופס",
        phone,
        email: `${marker}@qa.example`,
        city: "תל אביב",
        needDescription: "עדכון מטופס",
        startedAt,
      },
      idempotencyKey: key("2"),
      startedAt,
      clientIp: "10.0.0.8",
    });
    assert(updated.ok, "second submit with same phone updates the open lead");
    const afterUpdate = (await listSalesLeadsServer()).leads.find(
      (item) => item.clientName === marker
    );
    assert(afterUpdate?.contactName === "איש קשר מעודכן טופס", "open lead fields updated");
    assert(afterUpdate?.city === "תל אביב", "open lead city updated");
    assert(afterUpdate?.id === lead?.id, "same open lead id reused");

    if (lead) {
      await updateSalesLeadServer(lead.id, {
        ...emptySalesLeadDraft(),
        clientName: marker,
        contactName: "איש קשר מעודכן טופס",
        phone,
        email: `${marker}@qa.example`,
        status: "לא נסגר",
      });
      const afterClosed = await submitPublicSalesLeadForm({
        body: {
          clientName: `${marker}-new`,
          contactName: "פנייה חדשה",
          phone,
          email: `${marker}@qa.example`,
          startedAt,
        },
        idempotencyKey: key("3"),
        startedAt,
        clientIp: "10.0.0.9",
      });
      assert(afterClosed.ok, "closed lost + same phone creates a new lead");
      const all = (await listSalesLeadsServer()).leads.filter((item) =>
        item.clientName.startsWith(marker)
      );
      assert(all.length === 2, "closed match created a second inquiry");
    }
  } finally {
    const { data } = await client
      .from(SALES_LEADS_TABLE)
      .select("id, contact_id")
      .like("client_name", `${marker}%`);
    const rows = data ?? [];
    const ids = rows.map((row) => String(row.id));
    const contactIds = rows
      .map((row) => row.contact_id)
      .filter((id): id is string => Boolean(id));
    if (ids.length > 0) {
      await client.from(SALES_LEAD_FORM_SUBMISSIONS_TABLE).delete().in("lead_id", ids);
      await client.from(SALES_LEAD_HISTORY_TABLE).delete().in("lead_id", ids);
      await client.from(SALES_LEADS_TABLE).delete().in("id", ids);
    }
    if (contactIds.length > 0) {
      await client.from(CONTACTS_TABLE).delete().in("id", contactIds);
    }
  }

  console.log(`\n=== סיכום: ${passed} עברו, ${failed} נכשלו ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
