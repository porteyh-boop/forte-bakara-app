/**
 * Integration QA for migration 046 + server logic (Production Supabase via service role).
 * Run: npx tsx scripts/qa-building-client-updates-integration.ts
 */
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnv(): void {
  for (const file of [".env.local"]) {
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

let passed = 0;
let failed = 0;

function ok(label: string): void {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

function bad(label: string, detail?: string): void {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
}

const QA_TITLE_PREFIX = "QA_BCU_";
const qaUpdateIds: string[] = [];

async function tableReady(
  client: SupabaseClient,
  table: string
): Promise<boolean> {
  const { error } = await client.from(table).select("id").limit(1);
  return !error;
}

async function columnReady(
  client: SupabaseClient,
  table: string,
  column: string
): Promise<boolean> {
  const { error } = await client.from(table).select(column).limit(1);
  if (!error) return true;
  return !String(error.message).includes(column);
}

async function findBuildingsWithAccess(client: SupabaseClient): Promise<string[]> {
  const { data } = await client.from("client_access").select("building_id");
  const ids = [
    ...new Set(
      (data ?? []).map((r) =>
        String((r as Record<string, unknown>).building_id).trim().toLowerCase()
      )
    ),
  ].filter(Boolean);
  return ids;
}

async function usersForBuilding(
  client: SupabaseClient,
  buildingId: string
): Promise<string[]> {
  const { data } = await client
    .from("client_access")
    .select("client_user_id")
    .eq("building_id", buildingId);
  return [
    ...new Set(
      (data ?? []).map((r) => String((r as Record<string, unknown>).client_user_id))
    ),
  ];
}

async function getPermissions(
  client: SupabaseClient,
  clientUserId: string
): Promise<Record<string, unknown> | null> {
  const { data } = await client
    .from("client_permissions")
    .select("*")
    .eq("client_user_id", clientUserId)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

async function setCanViewUpdates(
  client: SupabaseClient,
  clientUserId: string,
  value: boolean
): Promise<void> {
  const existing = await getPermissions(client, clientUserId);
  const now = new Date().toISOString();
  if (existing) {
    await client
      .from("client_permissions")
      .update({ can_view_client_updates: value, updated_at: now })
      .eq("client_user_id", clientUserId);
  } else {
    await client.from("client_permissions").insert({
      client_user_id: clientUserId,
      can_view_client_updates: value,
      can_view_building_dashboard: true,
      updated_at: now,
      created_at: now,
    });
  }
}

async function main(): Promise<void> {
  console.log("\n=== Building client updates integration QA ===\n");

  if (!url || !key) {
    bad("env", "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  if (!(await tableReady(sb, "building_client_updates"))) {
    bad(
      "migration 046",
      "building_client_updates missing — run supabase/migrations/046_building_client_updates_SQL_EDITOR.sql"
    );
    process.exit(1);
  }
  ok("table building_client_updates exists");

  if (!(await tableReady(sb, "building_client_update_reads"))) {
    bad("migration 046", "building_client_update_reads missing");
    process.exit(1);
  }
  ok("table building_client_update_reads exists");

  if (!(await columnReady(sb, "client_permissions", "can_view_client_updates"))) {
    bad("migration 046", "client_permissions.can_view_client_updates missing");
    process.exit(1);
  }
  ok("column can_view_client_updates exists");

  const { data: nullPermRows } = await sb
    .from("client_permissions")
    .select("id")
    .is("can_view_client_updates", null)
    .limit(1);
  if ((nullPermRows?.length ?? 0) > 0) {
    bad("default", "can_view_client_updates has NULL rows");
  } else {
    ok("can_view_client_updates is never NULL (default false on column)");
  }

  const {
    createMasterBuildingClientUpdateServer,
    listClientBuildingClientUpdatesServer,
    countUnreadClientBuildingUpdatesServer,
    markClientBuildingUpdateReadServer,
    patchMasterBuildingClientUpdateServer,
    validateUpdateDocumentLinkServer,
    resolveClientBuildingUpdateAttachmentServer,
  } = await import("../lib/building-client-updates-server");
  const { DEFAULT_CLIENT_PERMISSIONS } = await import("../lib/client-permissions");
  type ClientPortalAuthContext = import("../lib/client-portal-dto").ClientPortalAuthContext;

  const buildings = await findBuildingsWithAccess(sb);
  if (buildings.length < 1) {
    bad("fixtures", "no client_access rows");
    process.exit(1);
  }

  const buildingA = buildings[0];
  const buildingB = buildings.find((b) => b !== buildingA) ?? buildingA;
  const usersA = await usersForBuilding(sb, buildingA);
  if (usersA.length < 1) {
    bad("fixtures", `no client users for ${buildingA}`);
    process.exit(1);
  }

  const userA = usersA[0];
  const userA2 = usersA[1] ?? null;

  const permSnapshots = new Map<string, boolean | null>();

  async function snapshotPerm(userId: string): Promise<void> {
    const row = await getPermissions(sb, userId);
    permSnapshots.set(
      userId,
      row ? Boolean(row.can_view_client_updates) : null
    );
  }

  async function restorePerms(): Promise<void> {
    for (const [userId, prev] of permSnapshots) {
      if (prev === null) {
        await sb
          .from("client_permissions")
          .update({ can_view_client_updates: false })
          .eq("client_user_id", userId);
      } else {
        await setCanViewUpdates(sb, userId, prev);
      }
    }
  }

  function authFor(userId: string, buildingId: string, canView: boolean): ClientPortalAuthContext {
    return {
      buildingId,
      permissions: {
        ...DEFAULT_CLIENT_PERMISSIONS,
        can_view_building_dashboard: true,
        can_view_client_updates: canView,
      },
      session: {
        user: {
          id: userId,
          name: "QA",
          phone: null,
          email: null,
          client_type: null,
          welcome_message: null,
          access_token: "qa",
          is_active: true,
          expires_at: null,
          created_at: new Date().toISOString(),
        },
        access: {
          id: "qa",
          client_user_id: userId,
          building_id: buildingId,
          elevator_id: null,
          access_level: "building",
          created_at: new Date().toISOString(),
        },
      },
    };
  }

  await snapshotPerm(userA);
  if (userA2) await snapshotPerm(userA2);

  try {
    const title = `${QA_TITLE_PREFIX}${Date.now()}`;
    const created = await createMasterBuildingClientUpdateServer({
      buildingId: buildingA,
      title,
      body: "תוכן QA",
      updateType: "general",
      status: "for_information",
      visibleToClient: false,
    });
    if (!created.update) {
      bad("create update A", created.error ?? "failed");
      process.exit(1);
    }
    qaUpdateIds.push(created.update.id);
    ok("create hidden update on building A");

    await setCanViewUpdates(sb, userA, true);
    const hiddenList = await listClientBuildingClientUpdatesServer(
      authFor(userA, buildingA, true)
    );
    if (hiddenList.updates.some((u) => u.id === created.update!.id)) {
      bad("visibility", "hidden update returned to client");
    } else {
      ok("hidden update not returned to client");
    }

    const published = await patchMasterBuildingClientUpdateServer(
      created.update.id,
      buildingA,
      { visibleToClient: true }
    );
    if (!published.update?.visibleToClient) {
      bad("publish", published.error ?? "failed");
    } else {
      ok("publish update for building A");
    }

    const visibleList = await listClientBuildingClientUpdatesServer(
      authFor(userA, buildingA, true)
    );
    if (!visibleList.updates.some((u) => u.id === created.update!.id)) {
      bad("visibility", "published update missing for A client");
    } else {
      ok("published update visible to A client");
    }

    if (buildingB !== buildingA) {
      const otherUsers = await usersForBuilding(sb, buildingB);
      if (otherUsers[0]) {
        await setCanViewUpdates(sb, otherUsers[0], true);
        await snapshotPerm(otherUsers[0]);
        const listB = await listClientBuildingClientUpdatesServer(
          authFor(otherUsers[0], buildingB, true)
        );
        if (listB.updates.some((u) => u.id === created.update!.id)) {
          bad("isolation", "building B client saw A update");
        } else {
          ok("building B client cannot see A update");
        }
        const markB = await markClientBuildingUpdateReadServer(
          authFor(otherUsers[0], buildingB, true),
          created.update!.id
        );
        if (markB.ok) {
          bad("isolation", "building B marked read on A update");
        } else {
          ok("building B cannot mark A update read");
        }

        const bTitle = `${QA_TITLE_PREFIX}B_${Date.now()}`;
        const createdB = await createMasterBuildingClientUpdateServer({
          buildingId: buildingB,
          title: bTitle,
          body: "QA B",
          updateType: "general",
          status: "for_information",
          visibleToClient: true,
        });
        if (createdB.update) {
          qaUpdateIds.push(createdB.update.id);
          const listAforB = await listClientBuildingClientUpdatesServer(
            authFor(userA, buildingA, true)
          );
          if (listAforB.updates.some((u) => u.id === createdB.update!.id)) {
            bad("isolation", "building A client saw B update");
          } else {
            ok("building A client cannot see B update");
          }
          const markAonB = await markClientBuildingUpdateReadServer(
            authFor(userA, buildingA, true),
            createdB.update.id
          );
          if (markAonB.ok) {
            bad("isolation", "building A marked read on B update");
          } else {
            ok("building A cannot mark B update read");
          }
        } else {
          bad("create update B", createdB.error ?? "failed");
        }
      }
    } else {
      bad("cross-building", "only one building with client_access — partial isolation only");
    }

    await setCanViewUpdates(sb, userA, false);
    const denied = await listClientBuildingClientUpdatesServer(
      authFor(userA, buildingA, false)
    );
    if (denied.error !== "permission_denied") {
      bad("permission", `expected permission_denied got ${denied.error}`);
    } else {
      ok("403 permission without can_view_client_updates");
    }

    await setCanViewUpdates(sb, userA, true);
    const allowed = await listClientBuildingClientUpdatesServer(
      authFor(userA, buildingA, true)
    );
    if (allowed.error) {
      bad("permission", allowed.error);
    } else {
      ok("list allowed after enabling permission");
    }

    const readsBefore = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", created.update!.id)
      .eq("client_user_id", userA);
    const countBefore = readsBefore.data?.length ?? 0;

    await listClientBuildingClientUpdatesServer(authFor(userA, buildingA, true));
    const readsAfterGet = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", created.update!.id)
      .eq("client_user_id", userA);
    if ((readsAfterGet.data?.length ?? 0) !== countBefore) {
      bad("read side effect", "GET list created read row");
    } else {
      ok("GET list does not create read");
    }

    const readsBeforeUnread = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", created.update!.id);
    const unreadCountBefore = readsBeforeUnread.data?.length ?? 0;

    await countUnreadClientBuildingUpdatesServer(authFor(userA, buildingA, true));
    const readsAfterUnread = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", created.update!.id);
    if ((readsAfterUnread.data?.length ?? 0) !== unreadCountBefore) {
      bad("read side effect", "unread-count created read row");
    } else {
      ok("unread-count does not create read");
    }

    const mark1 = await markClientBuildingUpdateReadServer(
      authFor(userA, buildingA, true),
      created.update!.id
    );
    if (!mark1.ok) bad("mark read", mark1.error ?? "failed");
    else ok("POST read creates read");

    const { data: readOwner } = await sb
      .from("building_client_update_reads")
      .select("client_user_id")
      .eq("update_id", created.update!.id)
      .eq("client_user_id", userA)
      .maybeSingle();
    if (String((readOwner as Record<string, unknown> | null)?.client_user_id) !== userA) {
      bad("mark read", "read row not tied to correct client_user_id");
    } else {
      ok("POST read row scoped to client_user_id");
    }

    const { data: readRow1 } = await sb
      .from("building_client_update_reads")
      .select("read_at")
      .eq("update_id", created.update!.id)
      .eq("client_user_id", userA)
      .maybeSingle();
    const readAt1 = String((readRow1 as Record<string, unknown> | null)?.read_at ?? "");

    const mark2 = await markClientBuildingUpdateReadServer(
      authFor(userA, buildingA, true),
      created.update!.id
    );
    if (!mark2.alreadyRead) bad("idempotent read", "second mark not alreadyRead");
    else ok("second POST read is idempotent");

    const { data: readRow2 } = await sb
      .from("building_client_update_reads")
      .select("read_at")
      .eq("update_id", created.update!.id)
      .eq("client_user_id", userA)
      .maybeSingle();
    const readAt2 = String((readRow2 as Record<string, unknown> | null)?.read_at ?? "");
    if (readAt1 && readAt2 && readAt1 !== readAt2) {
      bad("idempotent read", "read_at changed on second POST");
    } else {
      ok("read_at unchanged on second POST");
    }

    if (userA2) {
      await setCanViewUpdates(sb, userA2, true);
      await snapshotPerm(userA2);
      const markOther = await markClientBuildingUpdateReadServer(
        authFor(userA2, buildingA, true),
        created.update!.id
      );
      if (!markOther.ok) bad("per-user read", markOther.error ?? "failed");
      else ok("second user can mark read independently");

      const { data: rowsBoth } = await sb
        .from("building_client_update_reads")
        .select("client_user_id")
        .eq("update_id", created.update!.id)
        .in("client_user_id", [userA, userA2]);
      const ids = new Set(
        (rowsBoth ?? []).map((r) =>
          String((r as Record<string, unknown>).client_user_id)
        )
      );
      if (ids.has(userA) && ids.has(userA2) && ids.size === 2) {
        ok("separate read state per client_user on same building");
      } else {
        bad("per-user read", `expected 2 read rows, got ${ids.size}`);
      }
    } else {
      ok("two client_users same building skipped (only one user on fixture building)");
    }

    const attachDenied = await resolveClientBuildingUpdateAttachmentServer(
      authFor(userA, buildingA, false),
      created.update!.id
    );
    if (attachDenied.ok || attachDenied.error !== "permission_denied") {
      bad("attachment permission", String(attachDenied.error ?? "unexpected ok"));
    } else {
      ok("attachment 403 without can_view_client_updates");
    }

    const attachNoDoc = await resolveClientBuildingUpdateAttachmentServer(
      authFor(userA, buildingA, true),
      created.update!.id
    );
    if (attachNoDoc.ok || attachNoDoc.error !== "no_attachment") {
      bad("attachment no doc", String(attachNoDoc.error ?? "unexpected ok"));
    } else {
      ok("attachment no_attachment when update has no document");
    }

    if (buildingB !== buildingA) {
      const usersBAttach = await usersForBuilding(sb, buildingB);
      if (usersBAttach[0]) {
        await setCanViewUpdates(sb, usersBAttach[0], true);
        const attachCross = await resolveClientBuildingUpdateAttachmentServer(
          authFor(usersBAttach[0], buildingB, true),
          created.update!.id
        );
        if (attachCross.ok || attachCross.error !== "not_found") {
          bad(
            "attachment cross-building",
            String(attachCross.error ?? "unexpected ok")
          );
        } else {
          ok("attachment cross-building blocked");
        }
      } else {
        ok("attachment cross-building skipped (no user on B)");
      }
    } else {
      ok("attachment cross-building skipped (single building fixture)");
    }

    const { data: foreignDoc } = await sb
      .from("documents")
      .select("id, building_id, visibility")
      .neq("building_id", buildingA)
      .eq("visibility", "client")
      .limit(1)
      .maybeSingle();

    if (foreignDoc) {
      const docId = String((foreignDoc as Record<string, unknown>).id);
      const link = await validateUpdateDocumentLinkServer(docId, buildingA);
      if (link.ok) {
        bad("document guard", "cross-building document allowed");
      } else {
        ok("cross-building client document blocked");
      }
    } else {
      ok("cross-building document check skipped (no foreign client doc)");
    }

    const { data: internalDoc } = await sb
      .from("documents")
      .select("id, building_id, visibility")
      .eq("building_id", buildingA)
      .neq("visibility", "client")
      .limit(1)
      .maybeSingle();

    if (internalDoc) {
      const docId = String((internalDoc as Record<string, unknown>).id);
      const internalLink = await validateUpdateDocumentLinkServer(docId, buildingA);
      if (internalLink.ok) {
        bad("document guard", "non-client visibility document allowed");
      } else {
        ok("internal/non-client visibility document blocked");
      }
    } else {
      ok("internal visibility document check skipped (no internal doc on A)");
    }

    const { count: extraQa } = await sb
      .from("building_client_updates")
      .select("id", { count: "exact", head: true })
      .like("title", `${QA_TITLE_PREFIX}%`);
    if ((extraQa ?? 0) > qaUpdateIds.length) {
      bad("cleanup prep", `unexpected QA rows still present: ${extraQa}`);
    }
  } finally {
    if (qaUpdateIds.length > 0) {
      await sb.from("building_client_updates").delete().in("id", qaUpdateIds);
      ok("cleaned QA updates");
    }
    await restorePerms();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
