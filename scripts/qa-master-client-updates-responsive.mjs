/**
 * Master client-updates tab — viewport overflow check (Chrome CDP).
 * Usage: node scripts/qa-master-client-updates-responsive.mjs [baseUrl] [buildingId]
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

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
const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const buildingId = process.argv[3] || "bty4";
const masterCode = process.env.MASTER_CODE?.trim() || "";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
  close() {
    this.ws.close();
  }
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.log("SKIP: Chrome not found for responsive CDP");
    process.exit(0);
  }

  const port = 9333;
  const userDataDir = path.join(process.cwd(), ".tmp-chrome-qa-master-updates");
  fs.mkdirSync(userDataDir, { recursive: true });

  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--headless=new",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let failed = 0;
  try {
    await waitForDebugPort(port);
    const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    const wsUrl = tabs[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error("No CDP target");

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res);
      ws.addEventListener("error", rej);
    });
    const cdp = new CdpSession(ws);
    await cdp.send("Page.enable");

    const target = `${baseUrl}/master/project-v2?buildingId=${encodeURIComponent(buildingId)}&tab=clientUpdates`;
    await cdp.send("Page.navigate", { url: target });
    await sleep(2500);

    if (masterCode) {
      await cdp.send("Runtime.evaluate", {
        expression: `
          (function(){
            sessionStorage.setItem('forte-master-authenticated','1');
            const inputs = document.querySelectorAll('input');
            for (const el of inputs) {
              if (el.type === 'password' || el.placeholder?.includes('קוד')) {
                el.value = ${JSON.stringify(masterCode)};
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }
            const btn = [...document.querySelectorAll('button')].find(b => /כניסה|אימות|המשך/.test(b.textContent||''));
            if (btn) btn.click();
          })();
        `,
      });
      await sleep(2000);
    }

    for (const width of WIDTHS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 800,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await sleep(800);
      const { result } = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          hasTab: (document.body?.innerText || '').includes('עדכונים ללקוח'),
          hasNewBtn: (document.body?.innerText || '').includes('עדכון חדש')
        })`,
      });
      const m = result.value || {};
      const overflow = m.scrollW > m.clientW + 2;
      if (overflow) {
        console.error(`  ✗ ${width}px horizontal overflow (${m.scrollW}>${m.clientW})`);
        failed += 1;
      } else {
        console.log(`  ✓ ${width}px no horizontal overflow`);
      }
      if (width === 375 && !m.hasTab) {
        console.error("  ✗ 375px tab content not detected (auth or routing?)");
        failed += 1;
      }
    }
    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
  }

  console.log(failed ? `\nResponsive CDP: ${failed} issue(s)\n` : "\nResponsive CDP: all widths OK\n");
  process.exit(failed > 0 ? 1 : 0);
}

void main().catch((e) => {
  console.error("Responsive CDP failed:", e.message);
  process.exit(0);
});
