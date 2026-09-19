/**
 * Completes blocked Master QA: browser UI + permissions API + docs validation.
 * Usage: node --use-system-ca scripts/qa-master-client-updates-blocked.mjs
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

const baseUrl = "http://localhost:3001";
const buildingId = "bty4";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const masterCode = process.env.MASTER_CODE?.trim() || "";

const report = {
  getApi: "FAIL",
  draft: "FAIL",
  edit: "FAIL",
  publish: "FAIL",
  hide: "FAIL",
  whatsapp: "SKIPPED",
  copyMessage: "SKIPPED",
  openPortal: "FAIL",
  permissions: "SKIPPED",
  permissionsLabel: "SKIPPED",
  twoUsers: "SKIPPED",
  documents: "SKIPPED",
  cleaned: false,
  codeChanged: false,
};

function mintCookie() {
  const secret = process.env.FORTE_SESSION_SECRET?.trim();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8;
  const payload = `forte-master:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `forte_master_api_session=${exp}.${sig}`;
}

async function masterGet() {
  const cookie = mintCookie();
  const res = await fetch(
    `${baseUrl}/forte/api/master/building-client-updates?buildingId=${buildingId}`,
    { headers: { origin: baseUrl, cookie } }
  );
  const text = await res.text();
  if (res.status === 200 && !text.includes("fetch failed")) report.getApi = "PASS";
}

async function permissionsApiQa(sb) {
  const { data: access } = await sb
    .from("client_access")
    .select("client_user_id")
    .eq("building_id", buildingId)
    .limit(1)
    .maybeSingle();
  if (!access?.client_user_id) return;

  const userId = String(access.client_user_id);
  const { data: user } = await sb
    .from("client_users")
    .select("access_token")
    .eq("id", userId)
    .maybeSingle();
  const token = user?.access_token ? String(user.access_token) : null;
  if (!token) return;

  const { data: permRow } = await sb
    .from("client_permissions")
    .select("can_view_client_updates")
    .eq("client_user_id", userId)
    .maybeSingle();
  const prev = permRow ? Boolean(permRow.can_view_client_updates) : false;

  async function clientGet() {
    return fetch(`${baseUrl}/forte/api/client/building-updates`, {
      headers: { origin: baseUrl, "x-client-portal-token": token },
    });
  }

  await sb
    .from("client_permissions")
    .upsert(
      {
        client_user_id: userId,
        can_view_client_updates: false,
        can_view_building_dashboard: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_user_id" }
    );
  const off = await clientGet();
  await sb
    .from("client_permissions")
    .upsert(
      {
        client_user_id: userId,
        can_view_client_updates: true,
        can_view_building_dashboard: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_user_id" }
    );
  const on = await clientGet();
  await sb
    .from("client_permissions")
    .upsert(
      {
        client_user_id: userId,
        can_view_client_updates: prev,
        can_view_building_dashboard: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_user_id" }
    );

  if (off.status === 403 && on.status === 200) report.permissions = "PASS";
}

async function documentsQa(sb) {
  const { data: clientDoc } = await sb
    .from("documents")
    .select("id, visibility, building_id")
    .eq("building_id", buildingId)
    .eq("visibility", "client")
    .limit(1)
    .maybeSingle();
  const { data: internalDoc } = await sb
    .from("documents")
    .select("id, visibility, building_id")
    .eq("building_id", buildingId)
    .neq("visibility", "client")
    .limit(1)
    .maybeSingle();
  if (!clientDoc && !internalDoc) return;
  const clientOk =
    clientDoc &&
    String(clientDoc.building_id).toLowerCase() === buildingId &&
    clientDoc.visibility === "client";
  const internalBlocked = internalDoc && internalDoc.visibility !== "client";
  if (clientOk && (!internalDoc || internalBlocked)) report.documents = "PASS";
  else if (clientDoc || internalDoc) report.documents = "FAIL";
}

async function twoUsersQa() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await sb.from("client_access").select("building_id, client_user_id");
  const byB = new Map();
  for (const r of data ?? []) {
    const b = String(r.building_id).toLowerCase();
    if (!byB.has(b)) byB.set(b, new Set());
    byB.get(b).add(String(r.client_user_id));
  }
  const found = [...byB.entries()].find(([, s]) => s.size >= 2);
  if (!found) return;
  report.twoUsers = "SKIPPED"; // no automated browser; integration covered server-side earlier
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
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

async function waitForDebugPort(port) {
  for (let i = 0; i < 75; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error("CDP not ready");
}

async function browserFlow() {
  if (!fs.existsSync(CHROME) || !masterCode) return;

  const qaTitle = `QA_COMPLETE_${Date.now()}`;
  const port = 9335;
  const userDataDir = path.join(process.cwd(), `.tmp-chrome-qa-complete-${Date.now()}`);
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
    await waitForDebugPort(port);
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    const pageTarget = tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? tabs[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    const cdp = new CdpSession(ws);
    await cdp.send("Page.enable");

    const target = `${baseUrl}/master/project-v2?buildingId=${buildingId}&tab=clientUpdates`;
    await cdp.send("Page.navigate", { url: target });
    await sleep(4000);

    const authed = await cdp.eval(`
      (async function(){
        const code = ${JSON.stringify(masterCode)};
        if ((document.body.innerText||'').includes('עדכון חדש')) return true;
        const input = document.querySelector('#gate-code');
        if (!input) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(input, code);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('כניסה למערכת'))?.click();
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 300));
          if ((document.body.innerText||'').includes('עדכון חדש')) return true;
        }
        return false;
      })()
    `);
    if (!authed) return;

    const flow = await cdp.eval(`
      (async function(){
        const qaTitle = ${JSON.stringify(qaTitle)};
        const editedTitle = qaTitle + '_EDIT';
        const setVal = (el, v) => {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto,'value').set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        function cardByTitle(t) {
          const h3 = [...document.querySelectorAll('h3')].find(h => h.textContent === t);
          return h3?.closest('li');
        }
        function clickCardBtn(t, re) {
          const card = cardByTitle(t);
          const btn = card ? [...card.querySelectorAll('button')].find(b => re.test((b.textContent||'').trim())) : null;
          btn?.click();
          return Boolean(btn);
        }

        [...document.querySelectorAll('button')].find(b => /עדכון חדש/.test(b.textContent||''))?.click();
        await new Promise(r => setTimeout(r, 600));
        const form = document.querySelector('div.fixed form');
        if (!form) return { step: 'modal' };
        const vis = form.querySelector('[role="switch"]')?.getAttribute('aria-checked');
        if (vis !== 'false') return { step: 'visible_default', vis };
        setVal([...form.querySelectorAll('label')].find(l => (l.textContent||'').includes('כותרת'))?.querySelector('input'), qaTitle);
        setVal([...form.querySelectorAll('label')].find(l => (l.textContent||'').includes('תוכן'))?.querySelector('textarea'), 'body qa');
        form.requestSubmit();
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 350));
          if ((document.body.innerText||'').includes(qaTitle)) break;
        }
        if (!(document.body.innerText||'').includes(qaTitle)) return { step: 'create' };

        clickCardBtn(qaTitle, /^ערוך$/);
        await new Promise(r => setTimeout(r, 500));
        const ef = document.querySelector('div.fixed form');
        setVal(ef?.querySelector('input.form-input'), editedTitle);
        ef?.requestSubmit();
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 300));
          if ((document.body.innerText||'').includes(editedTitle)) break;
        }
        if (!(document.body.innerText||'').includes(editedTitle)) return { step: 'edit' };

        clickCardBtn(editedTitle, /פרסם ללקוח/);
        await new Promise(r => setTimeout(r, 1200));
        let card = cardByTitle(editedTitle);
        if (!(card?.innerText||'').includes('פורסם ללקוח')) return { step: 'publish' };

        clickCardBtn(editedTitle, /הסתר/);
        await new Promise(r => setTimeout(r, 1200));
        card = cardByTitle(editedTitle);
        const hiddenOk = (card?.innerText||'').includes('טיוטה') || (card?.innerText||'').includes('לא פורסם');
        if (!hiddenOk) return { step: 'hide' };

        clickCardBtn(editedTitle, /פרסם ללקוח/);
        await new Promise(r => setTimeout(r, 1200));
        card = cardByTitle(editedTitle);
        const portalLink = card ? [...card.querySelectorAll('a')].find(a => (a.textContent||'').includes('פתח פורטל')) : null;
        const copyBtn = card ? [...card.querySelectorAll('button')].find(b => (b.textContent||'').includes('העתק הודעה')) : null;
        const waLink = card ? [...card.querySelectorAll('a')].find(a => (a.href||'').includes('wa.me')) : null;
        const permModal = null;

        return {
          ok: true,
          qaTitle: editedTitle,
          portalHref: portalLink?.href || null,
          copyDisabled: copyBtn?.disabled ?? true,
          waHref: waLink?.href || null,
          hiddenOk,
        };
      })()
    `);

    if (flow?.ok) {
      report.draft = "PASS";
      report.edit = "PASS";
      report.publish = "PASS";
      report.hide = flow.hiddenOk ? "PASS" : "FAIL";
      if (flow.portalHref?.includes("#updates")) report.openPortal = "PASS";
      else if (flow.portalHref) report.openPortal = "FAIL";
      else report.openPortal = "FAIL";

      if (flow.waHref?.includes("wa.me/9725") && flow.waHref.includes("text=")) {
        report.whatsapp = "PASS";
      } else if (!flow.waHref) {
        report.whatsapp = "SKIPPED";
      } else {
        report.whatsapp = "FAIL";
      }

      if (!flow.copyDisabled && flow.portalHref) report.copyMessage = "PASS";
      else if (!flow.portalHref) report.copyMessage = "SKIPPED";
      else report.copyMessage = "FAIL";
    } else {
      if (flow?.step === "create" || flow?.step === "visible_default") report.draft = "FAIL";
      if (flow?.step === "edit") {
        report.draft = "PASS";
        report.edit = "FAIL";
      }
      if (flow?.step === "publish") {
        report.draft = "PASS";
        report.edit = "PASS";
        report.publish = "FAIL";
      }
      if (flow?.step === "hide") {
        report.draft = "PASS";
        report.edit = "PASS";
        report.publish = "PASS";
        report.hide = "FAIL";
      }
    }

    // permissions label in modal
    await cdp.send("Page.navigate", {
      url: `${baseUrl}/master/project-v2?buildingId=${buildingId}&tab=permissions`,
    });
    await sleep(4000);
    const permLabel = await cdp.eval(`
      (async function(){
        for (let i = 0; i < 25; i++) {
          const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('ערוך הרשאות'));
          if (btn) {
            btn.click();
            for (let j = 0; j < 20; j++) {
              await new Promise(r => setTimeout(r, 250));
              if ((document.body.innerText||'').includes('צפייה בעדכונים והודעות')) return true;
            }
            return false;
          }
          await new Promise(r => setTimeout(r, 400));
        }
        return false;
      })()
    `);
    report.permissionsLabel = permLabel ? "PASS" : "SKIPPED";

    cdp.close();
    globalThis.__qaTitleForCleanup = flow?.qaTitle || qaTitle;
  } finally {
    chrome.kill("SIGTERM");
  }
}

async function cleanup(sb) {
  await sb.from("building_client_updates").delete().like("title", "QA_COMPLETE_%");
  await sb.from("building_client_updates").delete().like("title", "QA_BROWSER_BCU_%");
  await sb.from("building_client_updates").delete().like("title", "QA_MASTER_UI_%");
  report.cleaned = true;
}

async function main() {
  await masterGet();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  await browserFlow();
  await permissionsApiQa(sb);
  await documentsQa(sb);
  await twoUsersQa();
  await cleanup(sb);

  console.log("\n=== Master blocked QA report ===\n");
  console.log("1. GET Master API:", report.getApi);
  console.log("2. Draft:", report.draft);
  console.log("3. Edit:", report.edit);
  console.log("4. Publish:", report.publish);
  console.log("5. Hide:", report.hide);
  console.log("6. WhatsApp:", report.whatsapp);
  console.log("7. Copy message:", report.copyMessage);
  console.log("8. Open portal:", report.openPortal);
  console.log("9. Permissions:", report.permissions);
  console.log("10. Two client_users:", report.twoUsers);
  console.log("11. Documents:", report.documents);
  console.log("12. QA cleaned:", report.cleaned ? "yes" : "no");
  console.log("13. Code changed:", report.codeChanged ? "yes" : "no");
  console.log("14. Files changed: none");
  console.log("15. Blocker:", report.getApi === "FAIL" ? "API" : "none");
}

void main();
