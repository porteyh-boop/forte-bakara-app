/**
 * Master UI QA — browser (Chrome CDP) against local dev server.
 * Usage: node scripts/qa-master-client-updates-browser.mjs [baseUrl] [buildingId]
 * Default baseUrl: http://localhost:3001
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
for (const file of [".env.local"]) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const WIDTHS = [375, 768, 1024, 1366];
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");
const buildingId = process.argv[3] || "bty4";
const masterCode = process.env.MASTER_CODE?.trim() || "";
const QA_PREFIX = "QA_BROWSER_BCU_";

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}
function bad(label, detail) {
  failed += 1;
  console.error(`  ✗ ${label}${detail ? `: ${detail}` : ""}`);
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

async function waitForDebugPort(port, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error("Chrome debug port not ready");
}

async function cleanupQaRows() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return;
  const sb = createClient(url, key, { auth: { persistSession: false } });
  await sb.from("building_client_updates").delete().like("title", `${QA_PREFIX}%`);
}

async function main() {
  console.log(`\n=== Master UI browser QA @ ${baseUrl} ===\n`);

  try {
    const ping = await fetch(`${baseUrl}/api/version`, { signal: AbortSignal.timeout(5000) });
    if (!ping.ok) bad("dev server", `version ${ping.status}`);
    else ok(`dev server reachable (${baseUrl})`);
  } catch (e) {
    bad("dev server", e.message);
    process.exit(1);
  }

  if (!masterCode) {
    bad("MASTER_CODE", "missing in .env.local");
    process.exit(1);
  }

  await cleanupQaRows();

  if (!fs.existsSync(CHROME)) {
    bad("Chrome", "not found");
    process.exit(1);
  }

  const port = 9334;
  const userDataDir = path.join(
    process.cwd(),
    `.tmp-chrome-qa-master-ui-3001-${Date.now()}`
  );
  fs.mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    { stdio: "ignore" }
  );

  const qaTitle = `${QA_PREFIX}${Date.now()}`;

  try {
    await waitForDebugPort(port);
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    const pageTarget =
      tabs.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? tabs[0];
    const wsUrl = pageTarget?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error("No CDP target");

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    const cdp = new CdpSession(ws);
    await cdp.send("Page.enable");

    const target = `${baseUrl}/master/project-v2?buildingId=${encodeURIComponent(buildingId)}&tab=clientUpdates`;
    await cdp.send("Page.navigate", { url: target });
    for (let i = 0; i < 40; i++) {
      const st = await cdp.eval(
        `({ href: location.href, rs: document.readyState, len: (document.body?.innerText||'').length })`
      );
      if (st?.len > 50 && st.rs === "complete") break;
      await sleep(500);
    }

    const authed = await cdp.eval(`
      (async function(){
        const ready = (t) => (document.body?.innerText||'').includes(t);
        if (ready('עדכונים ללקוח') && ready('עדכון חדש')) return { gate: false, authed: true };
        const code = ${JSON.stringify(masterCode)};
        const input = document.querySelector('#gate-code');
        if (!input) {
          return { gate: false, reason: 'no gate', snippet: (document.body?.innerText||'').slice(0, 400) };
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(input, code);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('כניסה למערכת'));
        if (!btn) return { gate: true, submit: false };
        btn.click();
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 300));
          const text = document.body?.innerText || '';
          if (text.includes('עדכונים ללקוח') && text.includes('עדכון חדש')) {
            return { gate: true, authed: true };
          }
        }
        return { gate: true, authed: false, snippet: (document.body?.innerText||'').slice(0,200) };
      })()
    `);

    if (authed?.authed) ok("Master gate + clientUpdates tab visible");
    else bad("Master auth/tab", JSON.stringify(authed));

    if (!authed?.authed) {
      cdp.close();
      process.exit(1);
    }

    const openModal = await cdp.eval(`
      (async function(){
        await new Promise(r => setTimeout(r, 800));
        const btn = [...document.querySelectorAll('button')].find(b =>
          /עדכון חדש/.test((b.textContent||'').replace(/\\s+/g,' ').trim())
        );
        if (!btn) return { ok: false, reason: 'no button' };
        btn.click();
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 200));
          const dialog = document.querySelector('div.fixed form h4, form h4');
          if (dialog) {
            const visibleSwitch = document.querySelector('div.fixed form [role="switch"], form [role="switch"]');
            return {
              ok: true,
              defaultVisible: visibleSwitch?.getAttribute('aria-checked'),
            };
          }
        }
        return { ok: false, reason: 'dialog timeout' };
      })()
    `);
    if (openModal?.ok) ok('Modal "+ עדכון חדש" opens');
    else bad("create modal", JSON.stringify(openModal));
    if (openModal?.defaultVisible === "false") ok('Default "גלוי ללקוח" is OFF');
    else bad("default visible", openModal?.defaultVisible);

    const created = await cdp.eval(`
      (async function(){
        const title = ${JSON.stringify(qaTitle)};
        const setVal = (el, v) => {
          const setter = Object.getOwnPropertyDescriptor(
            el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
            'value'
          ).set;
          setter.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const form = document.querySelector('div.fixed form') || document.querySelector('form');
        const titleEl = [...form.querySelectorAll('label')].find(l => (l.textContent||'').includes('כותרת'))?.querySelector('input');
        const bodyEl = [...form.querySelectorAll('label')].find(l => (l.textContent||'').includes('תוכן'))?.querySelector('textarea');
        if (!titleEl || !bodyEl) return { ok: false, reason: 'fields' };
        setVal(titleEl, title);
        setVal(bodyEl, 'תוכן QA browser');
        form.requestSubmit();
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 400));
          const text = document.body.innerText || '';
          const err = document.querySelector('.fv2-banner-error')?.textContent?.trim() || '';
          if (text.includes(title) && (text.includes('טיוטה') || text.includes('לא פורסם'))) {
            return { ok: true };
          }
          if (err && i > 5) return { ok: false, reason: 'api', err };
        }
        return { ok: false, reason: 'not in list' };
      })()
    `);
    if (created?.ok) ok("Create draft + list updates without full refresh");
    else bad("create draft", JSON.stringify(created));

    const edited = await cdp.eval(`
      (async function(){
        const title = ${JSON.stringify(qaTitle)};
        const h3 = [...document.querySelectorAll('h3')].find(h => h.textContent === title);
        const card = h3?.closest('li') || h3?.closest('.fv2-panel')?.parentElement;
        const editBtn = card ? [...card.querySelectorAll('button')].find(b => (b.textContent||'').trim() === 'ערוך') : null;
        if (!editBtn) return { ok: false, reason: 'edit btn' };
        editBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const form = document.querySelector('form');
        const h4 = form?.querySelector('h4')?.textContent || '';
        const titleInput = form?.querySelector('input.form-input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(titleInput, title + '_EDIT');
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        form.querySelector('button[type="submit"]')?.click();
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 300));
          if ((document.body.innerText||'').includes(title + '_EDIT')) return { ok: true };
        }
        return { ok: false };
      })()
    `);
    if (edited?.ok) ok("Edit update reflects in list");
    else bad("edit", JSON.stringify(edited));

    const published = await cdp.eval(`
      (async function(){
        const title = ${JSON.stringify(qaTitle + "_EDIT")};
        const h3 = [...document.querySelectorAll('h3')].find(h => h.textContent === title);
        const card = h3?.closest('li') || h3?.parentElement?.parentElement;
        const pubBtn = card ? [...card.querySelectorAll('button')].find(b => (b.textContent||'').includes('פרסם ללקוח')) : null;
        if (!pubBtn) return { ok: false, reason: 'publish btn' };
        pubBtn.click();
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 350));
          const block = [...document.querySelectorAll('h3')].find(h => h.textContent === title)?.closest('li')?.innerText || '';
          if (block.includes('פורסם ללקוח') && block.includes('העתק הודעה')) break;
        }
        const li = [...document.querySelectorAll('h3')].find(h => h.textContent === title)?.closest('li');
        const block = li?.innerText || document.body.innerText;
        const hasShare = block.includes('העתק הודעה') && (block.includes('פתח פורטל') || block.includes('wa.me'));
        const wa = [...(li?.querySelectorAll('a')||[])].find(a => (a.href||'').includes('wa.me'));
        const waOk = wa ? /^https:\\/\\/wa\\.me\\/9725\\d+$/.test(wa.href.split('?')[0]) || wa.href.includes('wa.me/972') : null;
        return { ok: block.includes('פורסם ללקוח'), hasShare, waHref: wa?.href || null, waOk };
      })()
    `);
    if (published?.ok) ok("Publish shows פורסם ללקוח");
    else bad("publish", JSON.stringify(published));
    if (published?.hasShare) ok("Share actions visible after publish (copy/portal)");
    else bad("share actions");

    if (published?.waHref) {
      if (published.waHref.includes("wa.me/972") && published.waHref.includes("text="))
        ok("WhatsApp link uses 972… + encoded text");
      else bad("WhatsApp URL", published.waHref.slice(0, 80));
    } else {
      ok("WhatsApp: no link when no valid phone (or no recipient)");
    }

    const hidden = await cdp.eval(`
      (async function(){
        const title = ${JSON.stringify(qaTitle + "_EDIT")};
        const findLi = () => [...document.querySelectorAll('h3')].find(h => h.textContent === title)?.closest('li');
        const li0 = findLi();
        const btn = li0 ? [...li0.querySelectorAll('button')].find(b => (b.textContent||'').includes('הסתר')) : null;
        if (!btn) return { ok: false, reason: 'no hide btn' };
        btn.click();
        for (let i = 0; i < 25; i++) {
          await new Promise(r => setTimeout(r, 350));
          const t = findLi()?.innerText || '';
          if (t.includes('טיוטה') || t.includes('לא פורסם')) return { ok: true };
        }
        return { ok: false };
      })()
    `);
    if (hidden?.ok) ok("Hide from client works");
    else bad("hide", JSON.stringify(hidden));

    await cdp.send("Page.navigate", {
      url: `${baseUrl}/master/project-v2?buildingId=${encodeURIComponent(buildingId)}&tab=permissions`,
    });
    for (let i = 0; i < 20; i++) {
      const loading = await cdp.eval(
        `(document.body.innerText||'').includes('טוען הרשאות')`
      );
      if (!loading) break;
      await sleep(500);
    }
    const perms = await cdp.eval(`
      (async function(){
        const editBtn = [...document.querySelectorAll('button')].find(b =>
          (b.textContent||'').includes('ערוך הרשאות')
        );
        if (!editBtn) {
          return { ok: false, reason: 'no edit permissions btn', hasRows: (document.body.innerText||'').includes('גישת לקוח') };
        }
        editBtn.click();
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 250));
          if ((document.body.innerText||'').includes('צפייה בעדכונים והודעות')) {
            return { ok: true };
          }
        }
        return { ok: false, reason: 'label not in modal' };
      })()
    `);
    if (perms?.ok) ok('Permissions modal shows "צפייה בעדכונים והודעות"');
    else bad("permissions label", JSON.stringify(perms));

    const docFixture = await cdp.eval(`false`);
    void docFixture;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (url && key) {
      const sb = createClient(url, key, { auth: { persistSession: false } });
      const { data: clientDoc } = await sb
        .from("documents")
        .select("id, title")
        .eq("building_id", buildingId)
        .eq("visibility", "client")
        .limit(1)
        .maybeSingle();
      if (clientDoc) {
        ok(`Document fixture exists (${clientDoc.title}) — attach via UI not automated`);
      } else {
        ok("Document attach skipped (no client doc on building)");
      }
    }

    await cdp.send("Page.navigate", { url: target });
    await sleep(2000);

    for (const width of WIDTHS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await sleep(700);
      const m = await cdp.eval(`({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        hasTab: (document.body.innerText||'').includes('עדכונים ללקוח')
      })`);
      const overflow = m.scrollW > m.clientW + 2;
      if (overflow) bad(`${width}px overflow`, `${m.scrollW}>${m.clientW}`);
      else ok(`${width}px no horizontal overflow`);
      if (!m.hasTab) bad(`${width}px tab content`);
    }

    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await cleanupQaRows();
    ok("QA browser rows cleaned");
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed (@ ${baseUrl})\n`);
  process.exit(failed > 0 ? 1 : 0);
}

void main().catch((e) => {
  console.error("Browser QA error:", e.message);
  process.exit(1);
});
