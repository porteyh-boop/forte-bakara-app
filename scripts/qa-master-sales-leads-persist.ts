/**
 * Optional live Supabase persistence for sales leads.
 * Skips when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are missing.
 * Run: npx tsx scripts/qa-master-sales-leads-persist.ts
 */
import fs from "fs";
import path from "path";
import {
  createSalesLeadServer,
  listSalesLeadsServer,
  SALES_LEAD_HISTORY_TABLE,
  SALES_LEADS_TABLE,
  updateSalesLeadServer,
} from "../lib/sales-leads-server";
import { emptySalesLeadDraft, jerusalemCalendarDate } from "../lib/sales-leads";
import { BUILDINGS_TABLE } from "../lib/building-contacts-server";
import { CONTACTS_TABLE, PROJECT_CONTACTS_TABLE } from "../lib/contacts-server";
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

async function main(): Promise<void> {
  console.log("\n=== Master Sales Leads live persistence QA ===\n");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.log("  ↷ skip: no safe Supabase service credentials in this environment");
    process.exit(0);
  }

  const marker = `qa-sales-${Date.now()}`;
  const today = jerusalemCalendarDate();
  const client = getSupabaseServiceClient();
  if (!client) {
    console.log("  ↷ skip: service client unavailable");
    process.exit(0);
  }

  try {
    const phone = `050${String(Date.now()).slice(-7)}`;
    const email = `${marker}@qa.example`;

    const created = await createSalesLeadServer({
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "בניין בדיקה",
      city: "חיפה",
      address: "הרצל 1",
      contactName: "איש קשר",
      phone,
      email,
      nextAction: "לחזור היום",
      followUpDate: today,
      note: "הערה ראשונה",
    });
    assert(created.error == null && created.lead?.clientName === marker, "create persists lead");
    assert(
      Boolean(created.lead?.history.some((entry) => entry.text === "הערה ראשונה")),
      "create persists note history"
    );
    assert(Boolean(created.lead?.contactId), "create syncs a contact and stores contact_id");

    const listed = await listSalesLeadsServer();
    assert(
      listed.error == null &&
        listed.leads.some((lead) => lead.id === created.lead?.id && lead.clientName === marker),
      "list/refresh returns created lead"
    );

    if (!created.lead) {
      throw new Error("create returned no lead");
    }

    const firstContactId = created.lead.contactId;

    const edited = await updateSalesLeadServer(created.lead.id, {
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "בניין מעודכן",
      city: "חיפה",
      address: "הרצל 1",
      contactName: "איש קשר מעודכן",
      phone,
      email,
      status: "נוצר קשר",
      followUpDate: today,
      note: "שיחת מעקב",
    });
    assert(
      edited.error == null &&
        edited.lead?.buildingName === "בניין מעודכן" &&
        edited.lead.status === "נוצר קשר" &&
        edited.lead.history.some((entry) => entry.text === "שיחת מעקב") &&
        edited.lead.contactId === firstContactId,
      "edit persists fields + history and updates the same linked contact"
    );

    const missingWin = await updateSalesLeadServer(created.lead.id, {
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "",
      contactName: "איש קשר מעודכן",
      phone,
      email,
      status: "זכייה",
      followUpDate: today,
    });
    assert(
      missingWin.error == null &&
        missingWin.lead?.status === "זכייה" &&
        missingWin.projectConversion?.required === true &&
        !missingWin.openedProject &&
        !missingWin.lead.convertedBuildingId,
      "win without building name asks for completion instead of failing"
    );

    const closed = await updateSalesLeadServer(created.lead.id, {
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "בניין מעודכן",
      city: "חיפה",
      address: "הרצל 1",
      contactName: "איש קשר מעודכן",
      phone,
      email,
      needDescription: "צורך לבדיקה",
      serviceType: "ייעוץ",
      estimatedValue: "12000",
      status: "זכייה",
      followUpDate: today,
    });
    assert(
      closed.error == null &&
        closed.lead?.status === "זכייה" &&
        Boolean(closed.lead.convertedBuildingId) &&
        closed.openedProject?.buildingId === closed.lead.convertedBuildingId,
      "first win creates one project and returns openedProject"
    );

    const firstBuildingId = closed.lead?.convertedBuildingId ?? null;
    const closedAgain = await updateSalesLeadServer(created.lead.id, {
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "בניין מעודכן",
      city: "חיפה",
      address: "הרצל 1",
      contactName: "איש קשר מעודכן",
      phone,
      email,
      status: "זכייה",
      followUpDate: today,
    });
    assert(
      closedAgain.error == null &&
        closedAgain.lead?.convertedBuildingId === firstBuildingId &&
        !closedAgain.openedProject,
      "saving זכייה again does not create another project"
    );

    const afterWin = await updateSalesLeadServer(created.lead.id, {
      ...emptySalesLeadDraft(),
      clientName: marker,
      buildingName: "בניין מעודכן",
      city: "חיפה",
      address: "הרצל 1",
      contactName: "איש קשר מעודכן",
      phone,
      email,
      status: "משא ומתן",
      followUpDate: today,
    });
    assert(
      afterWin.error == null &&
        afterWin.lead?.status === "משא ומתן" &&
        afterWin.lead.convertedBuildingId === firstBuildingId,
      "status change after conversion keeps the project id"
    );
  } finally {
    await client.from(SALES_LEAD_HISTORY_TABLE).delete().like("entry_text", "");
    const { data } = await client
      .from(SALES_LEADS_TABLE)
      .select("id, contact_id, converted_building_id")
      .eq("client_name", marker);
    const rows = data ?? [];
    const ids = rows.map((row) => row.id);
    const contactIds = rows
      .map((row) => row.contact_id)
      .filter((id): id is string => Boolean(id));
    const buildingIds = rows
      .map((row) => row.converted_building_id)
      .filter((id): id is string => Boolean(id));
    if (buildingIds.length > 0) {
      await client.from(PROJECT_CONTACTS_TABLE).delete().in("building_id", buildingIds);
      await client.from(BUILDINGS_TABLE).delete().in("building_id", buildingIds);
    }
    if (ids.length > 0) {
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
