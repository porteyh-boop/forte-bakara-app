/**
 * Phase 2 QA — Master "עדכונים ללקוח" (API parity + helpers + DB fixtures).
 * Run: npx tsx scripts/qa-master-client-updates-phase2.ts
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(rel: string): void {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
import { GET as masterListGET, POST as masterCreatePOST } from "../app/forte/api/master/building-client-updates/route";
import { PATCH as masterPatchPATCH } from "../app/forte/api/master/building-client-updates/[updateId]/route";
import { GET as clientListGET } from "../app/forte/api/client/building-updates/route";
import {
  buildClientUpdateShareMessage,
  buildClientUpdateWhatsAppUrl,
  normalizeIsraeliPhoneForWhatsApp,
} from "../lib/client-portal-update-share";
import { CLIENT_PERMISSION_LABELS } from "../lib/client-permissions";
import { CLIENT_PORTAL_TOKEN_HEADER } from "../lib/client-portal-api-auth";
import {
  markClientBuildingUpdateReadServer,
  validateUpdateDocumentLinkServer,
} from "../lib/building-client-updates-server";
import { DEFAULT_CLIENT_PERMISSIONS } from "../lib/client-permissions";

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

function masterReq(
  urlPath: string,
  init?: { method?: string; body?: unknown }
): NextRequest {
  const token = createMasterSessionToken();
  const headers: Record<string, string> = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.cookie = `${FORTE_MASTER_SESSION_COOKIE}=${token}`;
  }
  return new NextRequest(`http://localhost:3000${urlPath}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function clientReq(path: string, token: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "GET",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      [CLIENT_PORTAL_TOKEN_HEADER]: token,
    },
  });
}

const QA_PREFIX = "QA_MASTER_UI_";
const qaIds: string[] = [];

async function main(): Promise<void> {
  console.log("\n=== Master client updates — Phase 2 QA ===\n");

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/master-v2/project-v2/MasterProjectV2ClientUpdatesTab.tsx"),
    "utf8"
  );
  if (uiSource.includes("visibleToClient: false")) ok("UI default: visibleToClient false in emptyDraft");
  else bad("UI default", "missing visibleToClient: false");
  if (uiSource.includes("!update.visibleToClient") && uiSource.includes("renderShareActions"))
    ok("UI: share actions gated on visibleToClient");
  else bad("UI share gate", "check renderShareActions");
  if (
    uiSource.includes("getMasterClientPermissionsOrDefaults") &&
    uiSource.includes("can_view_client_updates") &&
    uiSource.includes("runGatedShareAction") &&
    uiSource.includes('buildMasterProjectV2Path(buildingId, "permissions")') &&
    uiSource.includes("shareBlockDialog") &&
    !uiSource.includes('href={waUrl}')
  ) {
    ok("UI: share actions gate can_view_client_updates before WhatsApp/copy/portal");
  } else {
    bad("UI share permission gate", "expected gated share + permissions tab navigation");
  }

  const tabConfig = fs.readFileSync(path.join(process.cwd(), "lib/project-type-config.ts"), "utf8");
  if (tabConfig.includes('clientUpdates: "עדכונים ללקוח"'))
    ok('UI tab label "עדכונים ללקוח" in config');
  else bad("UI tab label");

  if (
    CLIENT_PERMISSION_LABELS.can_view_client_updates === "צפייה בעדכונים והודעות"
  ) {
    ok("Permissions label connected to can_view_client_updates");
  } else {
    bad("Permissions label", CLIENT_PERMISSION_LABELS.can_view_client_updates);
  }

  const phone = "0501234567";
  if (normalizeIsraeliPhoneForWhatsApp(phone) === "972501234567") {
    ok("WhatsApp normalize 05… → 9725…");
  } else bad("WhatsApp normalize");
  const wa = buildClientUpdateWhatsAppUrl(phone, "שלום");
  if (wa?.includes("wa.me/972501234567") && wa.includes(encodeURIComponent("שלום"))) {
    ok("WhatsApp URL encoding");
  } else bad("WhatsApp URL", wa ?? "null");
  if (buildClientUpdateWhatsAppUrl("", "x") === null) ok("WhatsApp: empty phone → no URL");

  const msg = buildClientUpdateShareMessage({
    recipientName: "ישראל",
    buildingLabel: "בניין QA",
    updateTitle: "כותרת QA",
    portalUrl: "https://example.com/client/access/tok#updates",
  });
  if (
    msg.includes("שלום ישראל") &&
    msg.includes("בניין QA") &&
    msg.includes("כותרת QA") &&
    msg.includes("#updates") &&
    msg.includes("יהודה פורטה")
  ) {
    ok("WhatsApp message template");
  } else bad("WhatsApp message template");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    bad("env", "Supabase missing");
    console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: accessRows } = await sb.from("client_access").select("building_id, client_user_id");
  const buildingIds = [
    ...new Set(
      (accessRows ?? []).map((r) =>
        String((r as Record<string, unknown>).building_id).trim().toLowerCase()
      )
    ),
  ].filter(Boolean);
  if (!buildingIds[0]) {
    bad("fixture", "no building with client_access");
    process.exit(1);
  }
  const buildingId = buildingIds[0];
  ok(`fixture building ${buildingId}`);

  const permSnapshots = new Map<string, boolean | null>();

  async function snapshotPerm(userId: string): Promise<void> {
    const { data } = await sb
      .from("client_permissions")
      .select("can_view_client_updates")
      .eq("client_user_id", userId)
      .maybeSingle();
    permSnapshots.set(
      userId,
      data ? Boolean((data as Record<string, unknown>).can_view_client_updates) : null
    );
  }

  async function setPerm(userId: string, value: boolean): Promise<void> {
    const { data } = await sb
      .from("client_permissions")
      .select("id")
      .eq("client_user_id", userId)
      .maybeSingle();
    const now = new Date().toISOString();
    if (data) {
      await sb
        .from("client_permissions")
        .update({ can_view_client_updates: value, updated_at: now })
        .eq("client_user_id", userId);
    } else {
      await sb.from("client_permissions").insert({
        client_user_id: userId,
        can_view_building_dashboard: true,
        can_view_client_updates: value,
        created_at: now,
        updated_at: now,
      });
    }
  }

  async function restorePerms(): Promise<void> {
    for (const [userId, prev] of permSnapshots) {
      if (prev === null) await setPerm(userId, false);
      else await setPerm(userId, prev);
    }
  }

  async function clientTokenForBuilding(bid: string): Promise<string | null> {
    const userIds = (accessRows ?? [])
      .filter(
        (r) =>
          String((r as Record<string, unknown>).building_id).trim().toLowerCase() ===
          bid
      )
      .map((r) => String((r as Record<string, unknown>).client_user_id));
    if (!userIds[0]) return null;
    const { data: user } = await sb
      .from("client_users")
      .select("access_token")
      .eq("id", userIds[0])
      .maybeSingle();
    return user ? String((user as Record<string, unknown>).access_token) : null;
  }

  const clientToken = await clientTokenForBuilding(buildingId);
  if (!clientToken) bad("client token", "missing");
  else ok("client portal token for building");

  try {
    const title = `${QA_PREFIX}${Date.now()}`;
    const createRes = await masterCreatePOST(
      masterReq("/forte/api/master/building-client-updates", {
        method: "POST",
        body: {
          input: {
            buildingId,
            title,
            body: "טיוטת QA",
            updateType: "general",
            status: "for_information",
            visibleToClient: false,
          },
        },
      })
    );
    const createJson = (await createRes.json()) as {
      update?: { id: string; visibleToClient: boolean };
      error?: string;
    };
    if (createRes.status === 200 && createJson.update && !createJson.update.visibleToClient) {
      qaIds.push(createJson.update.id);
      ok("Master API: create draft (visible false)");
    } else {
      bad("Master API create draft", `${createRes.status} ${createJson.error ?? ""}`);
    }

    const updateId = createJson.update?.id;
    const fixtureUserId = String(
      (accessRows ?? []).find(
        (r) =>
          String((r as Record<string, unknown>).building_id).trim().toLowerCase() ===
          buildingId
      )?.client_user_id ?? ""
    );
    if (updateId && clientToken && fixtureUserId) {
      await snapshotPerm(fixtureUserId);
      await setPerm(fixtureUserId, true);
      const hiddenClient = await clientListGET(clientReq("/forte/api/client/building-updates", clientToken));
      const hiddenJson = (await hiddenClient.json()) as { updates?: { id: string }[] };
      if (!hiddenJson.updates?.some((u) => u.id === updateId)) {
        ok("Draft hidden from client list");
      } else bad("Draft visibility", "client saw draft");

      const patchEdit = await masterPatchPATCH(
        masterReq(
          `/forte/api/master/building-client-updates/${updateId}?buildingId=${encodeURIComponent(buildingId)}`,
          {
            method: "PATCH",
            body: {
              patch: {
                title: `${title}_edited`,
                body: "עריכה",
                updateType: "letter",
                status: "awaiting_response",
              },
            },
          }
        ),
        { params: Promise.resolve({ updateId }) }
      );
      const editJson = (await patchEdit.json()) as {
        update?: { title: string; updateType: string; status: string };
      };
      if (
        patchEdit.status === 200 &&
        editJson.update?.title === `${title}_edited` &&
        editJson.update.updateType === "letter"
      ) {
        ok("Master API: edit title/type/status/body");
      } else bad("Master API edit");

      const patchPub = await masterPatchPATCH(
        masterReq(
          `/forte/api/master/building-client-updates/${updateId}?buildingId=${encodeURIComponent(buildingId)}`,
          {
            method: "PATCH",
            body: { patch: { visibleToClient: true } },
          }
        ),
        { params: Promise.resolve({ updateId }) }
      );
      const pubJson = (await patchPub.json()) as { update?: { visibleToClient: boolean } };
      if (pubJson.update?.visibleToClient) ok("Master API: publish visibleToClient=true");
      else bad("Master API publish");

      const visClient = await clientListGET(clientReq("/forte/api/client/building-updates", clientToken));
      const visJson = (await visClient.json()) as { updates?: { id: string }[] };
      if (visJson.updates?.some((u) => u.id === updateId)) ok("Published visible on client API");
      else bad("Published client list");

      const patchHide = await masterPatchPATCH(
        masterReq(
          `/forte/api/master/building-client-updates/${updateId}?buildingId=${encodeURIComponent(buildingId)}`,
          {
            method: "PATCH",
            body: { patch: { visibleToClient: false } },
          }
        ),
        { params: Promise.resolve({ updateId }) }
      );
      const hideJson = (await patchHide.json()) as { update?: { visibleToClient: boolean } };
      if (hideJson.update?.visibleToClient === false) ok("Master API: hide from client");
      else bad("Master API hide");

      const listMaster = await masterListGET(
        masterReq(
          `/forte/api/master/building-client-updates?buildingId=${encodeURIComponent(buildingId)}`
        )
      );
      const listJson = (await listMaster.json()) as {
        updates?: { id: string; readBy?: { clientUserId: string; readAt: string | null }[] }[];
      };
      const row = listJson.updates?.find((u) => u.id === updateId);
      if (row && Array.isArray(row.readBy)) ok("Master list includes readBy per client rep");
      else bad("Master readBy");
    }

    if (clientToken && fixtureUserId) {
      await setPerm(fixtureUserId, false);
      const denied = await clientListGET(clientReq("/forte/api/client/building-updates", clientToken));
      if (denied.status === 403) ok("Permissions OFF → client API 403");
      else bad("Permissions OFF", String(denied.status));
      await setPerm(fixtureUserId, true);
      const allowed = await clientListGET(clientReq("/forte/api/client/building-updates", clientToken));
      if (allowed.status === 200) ok("Permissions ON → client API 200");
      else bad("Permissions ON", String(allowed.status));
    }

    const { data: clientDoc } = await sb
      .from("documents")
      .select("id")
      .eq("building_id", buildingId)
      .eq("visibility", "client")
      .limit(1)
      .maybeSingle();
    if (clientDoc) {
      const docId = String((clientDoc as Record<string, unknown>).id);
      const link = await validateUpdateDocumentLinkServer(docId, buildingId);
      if (link.ok) ok("Document client same building link OK");
      else bad("Document client link", link.error ?? "");
    } else ok("Document client link skipped (no client doc on building)");

    const { data: internalDoc } = await sb
      .from("documents")
      .select("id")
      .eq("building_id", buildingId)
      .neq("visibility", "client")
      .limit(1)
      .maybeSingle();
    if (internalDoc) {
      const docId = String((internalDoc as Record<string, unknown>).id);
      const link = await validateUpdateDocumentLinkServer(docId, buildingId);
      if (!link.ok) ok("Document internal/non-client blocked");
      else bad("Document internal", "allowed");
    } else ok("Document internal check skipped (no internal doc on building)");

    const usersByBuilding = new Map<string, string[]>();
    for (const r of accessRows ?? []) {
      const bid = String((r as Record<string, unknown>).building_id).trim().toLowerCase();
      const uid = String((r as Record<string, unknown>).client_user_id);
      if (!usersByBuilding.has(bid)) usersByBuilding.set(bid, []);
      const arr = usersByBuilding.get(bid)!;
      if (!arr.includes(uid)) arr.push(uid);
    }
    const twoUserBuilding = [...usersByBuilding.entries()].find(([, u]) => u.length >= 2);
    if (twoUserBuilding && updateId && twoUserBuilding[0] === buildingId) {
      const [bid, users] = twoUserBuilding;
      await masterPatchPATCH(
        masterReq(
          `/forte/api/master/building-client-updates/${updateId}?buildingId=${encodeURIComponent(bid)}`,
          { method: "PATCH", body: { patch: { visibleToClient: true } } }
        ),
        { params: Promise.resolve({ updateId }) }
      );
      const authA = {
        buildingId: bid,
        permissions: { ...DEFAULT_CLIENT_PERMISSIONS, can_view_client_updates: true, can_view_building_dashboard: true },
        session: {
          user: { id: users[0], name: "A", phone: null, email: null, client_type: null, welcome_message: null, access_token: "q", is_active: true, expires_at: null, created_at: "" },
          access: { id: "q", client_user_id: users[0], building_id: bid, elevator_id: null, access_level: "building" as const, created_at: "" },
        },
      };
      const authB = { ...authA, session: { ...authA.session, user: { ...authA.session.user, id: users[1] }, access: { ...authA.session.access, client_user_id: users[1] } } };
      await markClientBuildingUpdateReadServer(authA, updateId);
      const listM = await masterListGET(
        masterReq(`/forte/api/master/building-client-updates?buildingId=${encodeURIComponent(bid)}`)
      );
      const lj = (await listM.json()) as {
        updates?: { id: string; readBy: { clientUserId: string; readAt: string | null }[] }[];
      };
      const u = lj.updates?.find((x) => x.id === updateId);
      const aRead = u?.readBy.find((r) => r.clientUserId === users[0])?.readAt;
      const bRead = u?.readBy.find((r) => r.clientUserId === users[1])?.readAt;
      if (aRead && !bRead) ok("Two reps: A read, B unread in Master readBy");
      else bad("Two reps read state", `A=${Boolean(aRead)} B=${Boolean(bRead)}`);
    } else {
      ok("Two client_users read-status skipped (no building with 2 users)");
    }

    if (
      uiSource.includes("sm:flex-row") &&
      uiSource.includes("items-end sm:items-center") &&
      uiSource.includes("max-h-[92dvh]")
    ) {
      ok("Responsive: modal/layout classes present in Master tab");
    } else {
      bad("Responsive static", "missing expected responsive classes");
    }
  } finally {
    if (qaIds.length) {
      await sb.from("building_client_updates").delete().in("id", qaIds);
      ok("Cleaned QA_MASTER_UI updates");
    }
    await restorePerms();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
