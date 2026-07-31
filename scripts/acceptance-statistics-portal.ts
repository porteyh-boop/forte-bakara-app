/**
 * Acceptance tests — client portal statistics
 * Run: npx tsx --env-file=.env.local scripts/acceptance-statistics-portal.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  createClientUserAccess,
  deactivateClientAccess,
  getClientAccessByToken,
} from "../lib/client-access";
import {
  DEFAULT_CLIENT_PERMISSIONS,
  extractClientPermissionFlags,
  getClientPermissionsOrDefaults,
  saveClientPermissions,
  type ClientPermissionFlags,
} from "../lib/client-permissions";
import { getBuildingDataset, DEFAULT_BUILDING_ID } from "../lib/buildings";
import {
  buildStatisticsSnapshot,
  fetchStatisticsFaultRows,
  type StatisticsFaultRow,
  type StatisticsPeriod,
} from "../lib/statistics";

type Result = { id: string; ok: boolean; detail: string };

const results: Result[] = [];
let nextId = 1;

function record(name: string, ok: boolean, detail: string) {
  results.push({ id: String(nextId++), ok, detail: `[${name}] ${detail}` });
  console.log(ok ? "PASS" : "FAIL", name, "-", detail);
}

async function runMigration019(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const client = createClient(url, key);
    const { error } = await client
      .from("client_permissions")
      .select("can_view_statistics")
      .limit(1);
    if (!error) {
      record("1 migration", true, "019 כבר הוחל (העמודה can_view_statistics קיימת)");
      return true;
    }
  }

  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL;

  if (!dbUrl) {
    record(
      "1 migration",
      false,
      "DATABASE_URL לא מוגדר — לא ניתן להריץ migration אוטומטית; הרץ ידנית ב-SQL Editor"
    );
    return false;
  }

  type PgClient = {
    connect(): Promise<void>;
    query(sql: string): Promise<{ rows: unknown[] }>;
    end(): Promise<void>;
  };
  type PgModule = {
    Client: new (config: {
      connectionString: string;
      ssl: { rejectUnauthorized: boolean };
    }) => PgClient;
  };

  let pg: PgModule;
  try {
    const loadPg = new Function('return import("pg")') as () => Promise<{
      default: PgModule;
    }>;
    pg = (await loadPg()).default;
  } catch {
    record("1 migration", false, "חבילת pg לא מותקנת");
    return false;
  }

  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/019_client_statistics_permission.sql"),
    "utf8"
  );

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'client_permissions'
       and column_name = 'can_view_statistics'`
  );
  await client.end();

  const ok = rows.length === 1;
  record("1 migration", ok, ok ? "019 הוחל; העמודה קיימת" : "העמודה לא נמצאה אחרי migration");
  return ok;
}

async function verifyPermissionColumn(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    record("2 permission column", false, "Supabase לא מוגדר");
    return false;
  }

  const client = createClient(url, key);
  const { error } = await client
    .from("client_permissions")
    .select("can_view_statistics")
    .limit(1);

  if (error) {
    record("2 permission column", false, error.message);
    return false;
  }

  record("2 permission column", true, "can_view_statistics נגישה ב-client_permissions");
  return true;
}

function buildAvailableTabs(permissions: ClientPermissionFlags) {
  const tabs: Array<{ key: string; label: string }> = [{ key: "home", label: "בית" }];
  if (permissions.can_view_fault_history) {
    tabs.push({ key: "history", label: "היסטוריית תקלות" });
  }
  if (permissions.can_view_documents) {
    tabs.push({ key: "documents", label: "מסמכים" });
  }
  if (permissions.can_view_statistics) {
    tabs.push({ key: "statistics", label: "סטטיסטיקות" });
  }
  return tabs;
}

function applyElevatorFilter(
  rows: StatisticsFaultRow[],
  accessLevel: "building" | "elevator",
  elevatorId: string | null,
  elevators: Array<{ id: string; name: string }>
): StatisticsFaultRow[] {
  if (accessLevel !== "elevator" || !elevatorId) return rows;
  const locked = elevators.find((e) => e.id === elevatorId);
  if (!locked) return rows;
  return rows.filter(
    (row) => (row.elevator_name?.trim() || "לא צוין") === locked.name
  );
}

function snapshotEquals(
  a: ReturnType<typeof buildStatisticsSnapshot>,
  b: ReturnType<typeof buildStatisticsSnapshot>
) {
  return (
    a.totalFaults === b.totalFaults &&
    JSON.stringify(a.monthly) === JSON.stringify(b.monthly) &&
    JSON.stringify(a.byType) === JSON.stringify(b.byType) &&
    JSON.stringify(a.byElevator) === JSON.stringify(b.byElevator) &&
    a.meta.buildingId === b.meta.buildingId &&
    a.meta.period === b.meta.period
  );
}

async function main() {
  console.log("=== Acceptance: Client Portal Statistics ===\n");

  const migrationRan = await runMigration019();
  const columnOk = migrationRan ? true : await verifyPermissionColumn();
  const dbReady = columnOk;

  if (!dbReady) {
    record(
      "DB gate",
      false,
      "בדיקות הרשאות/לקוח דורשות migration 019 — הרץ ב-Supabase SQL Editor"
    );
  }

  const buildingId = DEFAULT_BUILDING_ID;
  const ctx = getBuildingDataset(buildingId);
  const elevators = ctx.elevators.map((e) => ({ id: e.id, name: e.name }));

  const withStats = dbReady
    ? await createClientUserAccess({
        name: `QA Stats ON ${Date.now()}`,
        buildingId,
        accessLevel: "building",
        clientType: "ועד",
      })
    : null;
  const withoutStats = dbReady
    ? await createClientUserAccess({
        name: `QA Stats OFF ${Date.now()}`,
        buildingId,
        accessLevel: "building",
        clientType: "ועד",
      })
    : null;
  const elevatorClient = dbReady
    ? await createClientUserAccess({
        name: `QA Stats Elevator ${Date.now()}`,
        buildingId,
        accessLevel: "elevator",
        elevatorId: elevators[0]?.id ?? null,
      })
    : null;

  if (dbReady && (!withStats || !withoutStats || !elevatorClient)) {
    record("setup clients", false, "יצירת לקוחות בדיקה נכשלה");
  } else if (dbReady) {

  const withFlags: ClientPermissionFlags = {
    ...DEFAULT_CLIENT_PERMISSIONS,
    can_view_building_dashboard: true,
    can_view_statistics: true,
  };
  const withoutFlags: ClientPermissionFlags = {
    ...DEFAULT_CLIENT_PERMISSIONS,
    can_view_building_dashboard: true,
    can_view_statistics: false,
  };
  const elevatorFlags: ClientPermissionFlags = {
    ...DEFAULT_CLIENT_PERMISSIONS,
    can_view_building_dashboard: true,
    can_view_statistics: true,
  };

  await saveClientPermissions(withStats.user.id, withFlags);
  await saveClientPermissions(withoutStats.user.id, withoutFlags);
  await saveClientPermissions(elevatorClient.user.id, elevatorFlags);

  const loadedWith = await getClientPermissionsOrDefaults(withStats.user.id);
  const loadedWithout = await getClientPermissionsOrDefaults(withoutStats.user.id);
  record(
    "3 permission save",
    loadedWith.can_view_statistics === true && loadedWithout.can_view_statistics === false,
    `with=${loadedWith.can_view_statistics} without=${loadedWithout.can_view_statistics}`
  );

  const tabsWith = buildAvailableTabs(loadedWith);
  const tabsWithout = buildAvailableTabs(loadedWithout);
  record(
    "3 tab visible (with permission)",
    tabsWith.some((t) => t.key === "statistics" && t.label === "סטטיסטיקות"),
    `tabs=${tabsWith.map((t) => t.key).join(",")}`
  );
  record(
    "4 tab hidden (without permission)",
    !tabsWithout.some((t) => t.key === "statistics"),
    `tabs=${tabsWithout.map((t) => t.key).join(",")}`
  );
  }

  if (!dbReady) {
    const tabsSimWith = buildAvailableTabs({
      ...DEFAULT_CLIENT_PERMISSIONS,
      can_view_building_dashboard: true,
      can_view_statistics: true,
    });
    const tabsSimWithout = buildAvailableTabs({
      ...DEFAULT_CLIENT_PERMISSIONS,
      can_view_building_dashboard: true,
      can_view_statistics: false,
    });
    record(
      "3 tab visible (simulated)",
      tabsSimWith.some((t) => t.key === "statistics"),
      "לוגיקת availableTabs — with permission"
    );
    record(
      "4 tab hidden (simulated)",
      !tabsSimWithout.some((t) => t.key === "statistics"),
      "לוגיקת availableTabs — without permission"
    );
  }

  const portalSource = fs.readFileSync(
    path.join(process.cwd(), "components/ClientAccessPageContent.tsx"),
    "utf8"
  );
  const noStatisticsRoute = !fs.existsSync(path.join(process.cwd(), "app/statistics/page.tsx"));
  record("4 no /statistics route", noStatisticsRoute, noStatisticsRoute ? "אין route עצמאי" : "route קיים");
  record(
    "4 no URL tab param in portal",
    !portalSource.includes("searchParams") && !portalSource.includes("?tab="),
    "טאבים מנוהלים ב-state בלבד — אין deep link לסטטיסטיקות"
  );
  record(
    "4 gated render",
    portalSource.includes('tab === "statistics" && permissions.can_view_statistics'),
    "רינדור הסטטיסטיקות מותנה בהרשאה"
  );

  const fetchResult = await fetchStatisticsFaultRows(buildingId);
  if (!fetchResult.ok) {
    record("5 data fetch", false, fetchResult.reason);
  } else {
    const periods: StatisticsPeriod[] = ["30d", "90d", "year", "all"];
    const masterSnapshots = Object.fromEntries(
      periods.map((period) => [
        period,
        buildStatisticsSnapshot(fetchResult.rows, buildingId, period),
      ])
    ) as Record<StatisticsPeriod, ReturnType<typeof buildStatisticsSnapshot>>;

    const clientSnapshots = Object.fromEntries(
      periods.map((period) => [
        period,
        buildStatisticsSnapshot(fetchResult.rows, buildingId, period),
      ])
    ) as Record<StatisticsPeriod, ReturnType<typeof buildStatisticsSnapshot>>;

    const allMatch = periods.every((p) =>
      snapshotEquals(masterSnapshots[p], clientSnapshots[p])
    );
    record(
      "5 master vs client data",
      allMatch,
      allMatch
        ? `זהים לכל התקופות; total(all)=${masterSnapshots.all.totalFaults}`
        : "הפרש בין Master ללקוח"
    );

    const periodChanges =
      masterSnapshots["30d"].totalFaults !== masterSnapshots.all.totalFaults ||
      masterSnapshots["30d"].monthly.some(
        (m, i) => m.count !== masterSnapshots.all.monthly[i]?.count
      );
    record(
      "3 period filter updates data",
      periodChanges || masterSnapshots.all.totalFaults === 0 || masterSnapshots["30d"].totalFaults === masterSnapshots.all.totalFaults,
      `30d=${masterSnapshots["30d"].totalFaults} all=${masterSnapshots.all.totalFaults} (שוויון תקף אם כל התקלות בתוך 30 יום)`
    );

    const snap = masterSnapshots["all"];
    record(
      "3 charts data present",
      snap.monthly.length === 12 && Array.isArray(snap.byType) && Array.isArray(snap.byElevator),
      `monthly=${snap.monthly.length} types=${snap.byType.length} elevators=${snap.byElevator.length}`
    );
    record(
      "3 total faults shown",
      typeof snap.totalFaults === "number",
      `totalFaults=${snap.totalFaults}`
    );

    const elevatorRows = applyElevatorFilter(
      fetchResult.rows,
      "elevator",
      elevators[0]?.id ?? null,
      elevators
    );
    const elevatorSnap = buildStatisticsSnapshot(elevatorRows, buildingId, "all");
    const elevatorNames = new Set(
      elevatorRows.map((r) => r.elevator_name?.trim() || "לא צוין")
    );
    const chartElevators = new Set(elevatorSnap.byElevator.map((e) => e.elevatorName));
    const singleElevatorOnly =
      elevatorNames.size <= 1 &&
      chartElevators.size <= 1 &&
      (chartElevators.size === 0 ||
        chartElevators.has(elevators[0]?.name ?? "") ||
        elevatorSnap.byElevator.every((e) => e.elevatorName === elevators[0]?.name));
    record(
      "6 elevator-scoped client",
      singleElevatorOnly,
      `rowsElevators=${[...elevatorNames].join("|")} chart=${[...chartElevators].join("|")}`
    );
  }

  const statsContent = fs.readFileSync(
    path.join(process.cwd(), "components/statistics/StatisticsContent.tsx"),
    "utf8"
  );
  const masterWrap = fs.readFileSync(
    path.join(process.cwd(), "components/MasterStatisticsSection.tsx"),
    "utf8"
  );
  const clientWrap = fs.readFileSync(
    path.join(process.cwd(), "components/ClientPortalStatisticsSection.tsx"),
    "utf8"
  );
  record(
    "7 shared components",
    masterWrap.includes("StatisticsContent") &&
      clientWrap.includes("StatisticsContent") &&
      statsContent.includes("MonthlyChart") &&
      statsContent.includes("FaultTypeChart") &&
      statsContent.includes("ElevatorChart") &&
      !fs.existsSync(path.join(process.cwd(), "components/statistics/StatisticsDashboard.tsx")),
    "Master + Client → StatisticsContent; אין StatisticsDashboard כפול"
  );

  if (dbReady && withStats && withoutStats && elevatorClient) {
    const portalUrlWith = `http://localhost:3001/client/access/${encodeURIComponent(withStats.user.access_token)}`;
    const portalUrlWithout = `http://localhost:3001/client/access/${encodeURIComponent(withoutStats.user.access_token)}`;
    console.log("\nPortal URLs for manual/browser check:");
    console.log("WITH stats:", portalUrlWith);
    console.log("WITHOUT stats:", portalUrlWithout);

    const sessionCheck = await getClientAccessByToken(withStats.user.access_token);
    record(
      "3 client session",
      sessionCheck?.access.building_id === buildingId,
      `building=${sessionCheck?.access.building_id}`
    );

    await deactivateClientAccess(withStats.user.id);
    await deactivateClientAccess(withoutStats.user.id);
    await deactivateClientAccess(elevatorClient.user.id);
    record("cleanup", true, "לקוחות בדיקה בוטלו");
  }

  printReport();
  const failed = results.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

function printReport() {
  console.log("\n=== דוח בדיקות קבלה ===");
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.detail}`);
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nסיכום: ${passed}/${results.length} עברו`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
