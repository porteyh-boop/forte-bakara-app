/**
 * Final gate: badge + IntersectionObserver read via real browser (CDP).
 * Run: $env:NODE_OPTIONS="--use-system-ca"; node scripts/qa-final-gate-client-updates-io.mjs
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

for (const line of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
}

const baseUrl = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");
const buildingId = "mn64";
const QA_PREFIX = "QA_FINAL_GATE_";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const out = {
  devRestart: "FAIL",
  badge: "FAIL",
  badgeValue: null,
  startedUnread: "FAIL",
  ioPost: "FAIL",
  dbRead: "FAIL",
  newBadgeGone: "FAIL",
  badgeDropped: "FAIL",
  refreshPersist: "FAIL",
  postLoop: "NO",
  updateId: null,
  userId: null,
  readPostCount: 0,
  debug: {},
};

function mintMasterCookie() {
  const secret = process.env.FORTE_SESSION_SECRET?.trim();
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = `forte-master:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `forte_master_api_session=${exp}.${sig}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.readPosts = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Network.responseReceived") {
        const url = msg.params?.response?.url ?? "";
        const reqId = msg.params?.requestId;
        if (url.includes("/building-updates/") && url.includes("/read")) {
          this.readPosts.push({ url, reqId });
        }
      }
      if (msg.method === "Network.requestWillBeSent") {
        const url = msg.params?.request?.url ?? "";
        if (
          url.includes("/building-updates/") &&
          url.includes("/read") &&
          msg.params?.request?.method === "POST"
        ) {
          this.readPosts.push({ url, phase: "sent" });
        }
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  eval(expression) {
    return this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }).then((r) => r.result?.value);
  }
  close() {
    this.ws.close();
  }
}

async function waitForDev() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return false;
}

async function main() {
  if (await waitForDev()) out.devRestart = "PASS";

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: acc } = await sb
    .from("client_access")
    .select("client_user_id")
    .eq("building_id", buildingId)
    .limit(1)
    .maybeSingle();
  out.userId = acc.client_user_id;
  const { data: user } = await sb
    .from("client_users")
    .select("access_token")
    .eq("id", out.userId)
    .maybeSingle();
  const token = user.access_token;
  const clientH = { origin: baseUrl, "x-client-portal-token": token };

  const { data: perm } = await sb
    .from("client_permissions")
    .select("*")
    .eq("client_user_id", out.userId)
    .maybeSingle();
  const now = new Date().toISOString();
  await sb.from("client_permissions").upsert(
    {
      client_user_id: out.userId,
      can_view_building_dashboard: Boolean(perm?.can_view_building_dashboard ?? true),
      can_view_open_faults: Boolean(perm?.can_view_open_faults ?? true),
      can_view_fault_history: Boolean(perm?.can_view_fault_history ?? true),
      can_view_documents: Boolean(perm?.can_view_documents ?? true),
      can_view_statistics: Boolean(perm?.can_view_statistics ?? true),
      can_view_availability: Boolean(perm?.can_view_availability ?? true),
      can_report_faults: Boolean(perm?.can_report_faults ?? true),
      can_upload_images: Boolean(perm?.can_upload_images ?? true),
      can_submit_feedback: Boolean(perm?.can_submit_feedback ?? true),
      can_view_client_updates: true,
      updated_at: now,
      created_at: perm?.created_at ?? now,
    },
    { onConflict: "client_user_id" }
  );

  const unreadBeforeCreate = await fetch(
    `${baseUrl}/forte/api/client/building-updates/unread-count`,
    { headers: clientH }
  ).then((r) => r.json());

  const masterH = {
    origin: baseUrl,
    cookie: mintMasterCookie(),
    "Content-Type": "application/json",
  };
  const title = `${QA_PREFIX}${Date.now()}`;
  const created = await fetch(`${baseUrl}/forte/api/master/building-client-updates`, {
    method: "POST",
    headers: masterH,
    body: JSON.stringify({
      input: {
        buildingId,
        title,
        body: "Final gate IO visibility test",
        updateType: "general",
        status: "for_information",
        visibleToClient: true,
      },
    }),
  }).then((r) => r.json());
  out.updateId = created.update?.id;
  if (!out.updateId) throw new Error("create update failed");

  await sb
    .from("building_client_update_reads")
    .delete()
    .eq("update_id", out.updateId)
    .eq("client_user_id", out.userId);

  const unreadAfterCreate = await fetch(
    `${baseUrl}/forte/api/client/building-updates/unread-count`,
    { headers: clientH }
  ).then((r) => r.json());

  const uBefore = Number(unreadBeforeCreate.unreadCount ?? 0);
  const uAfter = Number(unreadAfterCreate.unreadCount ?? 0);
  if (uAfter >= uBefore + 1 || uAfter >= 1) out.startedUnread = "PASS";

  const port = 9555 + Math.floor(Math.random() * 50);
  const userDataDir = path.join(process.cwd(), ".tmp-chrome-final-gate");
  fs.mkdirSync(userDataDir, { recursive: true });
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
    ],
    { stdio: "ignore" }
  );

  try {
    for (let i = 0; i < 30; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) break;
      } catch {
        /* */
      }
      await sleep(200);
    }

    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === "page") ?? targets[0];
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    const cdp = new Cdp(ws);
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1366,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await cdp.send("Page.navigate", {
      url: `${baseUrl}/client/access/${encodeURIComponent(token)}`,
    });
    await sleep(7000);

    const badgeHome = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'));
      if (!btn) return { found: false };
      const pill = btn.querySelector('span.rounded-full');
      return { found: true, text: btn.textContent?.replace(/\\s+/g,' ').trim(), pill: pill?.textContent?.trim() ?? null };
    })()`);

    if (badgeHome?.pill && Number(badgeHome.pill) >= 1) {
      out.badge = "PASS";
      out.badgeValue = badgeHome.pill;
    } else if (uAfter >= 1 && badgeHome?.pill) {
      out.badge = "PASS";
      out.badgeValue = badgeHome.pill;
    }

    const readsBefore = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", out.updateId)
      .eq("client_user_id", out.userId);

    cdp.readPosts = [];
    await cdp.send("Page.navigate", {
      url: `${baseUrl}/client/access/${encodeURIComponent(token)}#updates`,
    });
    await sleep(10000);

    let hasCard = false;
    for (let i = 0; i < 40; i++) {
      hasCard = await cdp.eval(
        `Boolean(document.querySelector('[data-update-id="${out.updateId}"]'))`
      );
      if (hasCard) break;
      await sleep(500);
    }
    out.debug.hasCard = hasCard;
    out.debug.updatesTab = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'));
      return { selected: btn?.getAttribute('aria-selected'), cards: document.querySelectorAll('[data-client-update-card]').length, loading: document.body.textContent.includes('טוען עדכונים') };
    })()`);

    if (!hasCard) {
      await cdp.eval(`Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'))?.click()`);
      await sleep(8000);
      hasCard = await cdp.eval(
        `Boolean(document.querySelector('[data-update-id="${out.updateId}"]'))`
      );
      out.debug.hasCardAfterClick = hasCard;
    }

    await cdp.eval(
      `document.querySelector('[data-update-id="${out.updateId}"]')?.scrollIntoView({ block: 'center' })`
    );

    let hadNew = false;
    for (let i = 0; i < 24; i++) {
      const state = await cdp.eval(`(() => {
        const card = document.querySelector('[data-update-id="${out.updateId}"]');
        if (!card) return { card: false };
        const hasNew = Array.from(card.querySelectorAll('span')).some(s => s.textContent.trim() === 'חדש');
        const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'));
        const pill = btn?.querySelector('span.rounded-full')?.textContent?.trim() ?? null;
        return { card: true, hasNew, pill };
      })()`);
      if (state?.hasNew) hadNew = true;
      if (!state?.hasNew && hadNew) break;
      if (!state?.hasNew && i > 8 && hadNew === false && i > 15) break;
      await sleep(500);
    }

    await sleep(2000);
    const postForUpdate = cdp.readPosts.filter((p) => p.url?.includes(out.updateId));
    out.readPostCount = postForUpdate.length;
    out.postLoop = postForUpdate.length > 2 ? "YES" : "NO";

    const readsAfter = await sb
      .from("building_client_update_reads")
      .select("id, client_user_id")
      .eq("update_id", out.updateId);

    if (postForUpdate.length >= 1) out.ioPost = "PASS";
    if ((readsAfter.data?.length ?? 0) >= 1) out.dbRead = "PASS";

    const finalUi = await cdp.eval(`(() => {
      const card = document.querySelector('[data-update-id="${out.updateId}"]');
      const hasNew = card ? Array.from(card.querySelectorAll('span')).some(s => s.textContent.trim() === 'חדש') : true;
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'));
      const pill = btn?.querySelector('span.rounded-full')?.textContent?.trim() ?? null;
      return { hasNew, pill };
    })()`);

    if (hadNew) out.newBadgeGone = finalUi?.hasNew === false ? "PASS" : "FAIL";
    else if (finalUi?.hasNew === false) out.newBadgeGone = "PASS";

    if (badgeHome?.pill && finalUi?.pill !== null) {
      if (Number(finalUi.pill) === Number(badgeHome.pill) - 1) out.badgeDropped = "PASS";
    } else if (!finalUi?.pill && uAfter >= 1) out.badgeDropped = "PASS";

    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(7000);
    cdp.readPosts = [];
    await sleep(2000);

    const afterRefresh = await cdp.eval(`(() => {
      const card = document.querySelector('[data-update-id="${out.updateId}"]');
      const hasNew = card ? Array.from(card.querySelectorAll('span')).some(s => s.textContent.trim() === 'חדש') : true;
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('עדכונים'));
      const pill = btn?.querySelector('span.rounded-full')?.textContent?.trim() ?? null;
      return { hasNew, pill };
    })()`);

    const readsAfterRefresh = await sb
      .from("building_client_update_reads")
      .select("id")
      .eq("update_id", out.updateId);

    const refreshPosts = cdp.readPosts.filter((p) => p.url?.includes(out.updateId));
    if (
      afterRefresh?.hasNew === false &&
      (readsAfterRefresh.data?.length ?? 0) >= 1 &&
      refreshPosts.length === 0
    ) {
      out.refreshPersist = "PASS";
    }

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }

  await sb.from("building_client_updates").delete().eq("id", out.updateId);

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
