/**
 * Responsive QA for /client/access/[token] using local Chrome (CDP).
 * Usage: node scripts/qa-client-portal-responsive.mjs [baseUrl]
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env.local", ".env.verify.local"]) {
  const envPath = path.join(process.cwd(), file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const WIDTHS = [375, 768, 1024, 1366, 1920];
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = (process.argv[2] || "http://localhost:3001").replace(/\/$/, "");

async function resolveToken(origin) {
  const fromEnv = process.env.CLIENT_PORTAL_QA_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env for QA token");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: users, error } = await sb
    .from("client_users")
    .select("access_token, client_access(id)")
    .eq("is_active", true)
    .not("access_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  for (const u of users ?? []) {
    if (!Array.isArray(u.client_access) || u.client_access.length === 0) continue;
    const probe = await fetch(`${origin}/forte/api/client/bootstrap`, {
      headers: {
        "x-client-portal-token": u.access_token,
        origin,
      },
    });
    if (probe.status === 200) return u.access_token;
  }
  throw new Error("No bootstrap-valid client portal token");
}

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

async function withChrome(fn) {
  const port = 9333 + Math.floor(Math.random() * 200);
  const userDataDir = path.join(process.cwd(), ".tmp-chrome-qa");
  fs.mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(
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
  try {
    await waitForDebugPort(port);
    return await fn(port);
  } finally {
    proc.kill("SIGTERM");
  }
}

async function measureAt(port, url, width, mobileUa) {
  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const pageTarget =
    targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("No CDP page target");
  }
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const cdp = new CdpSession(ws);
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width <= 768 ? 812 : 900,
    deviceScaleFactor: 1,
    mobile: width < 1024,
  });
  if (mobileUa) {
    await cdp.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
  } else {
    await cdp.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
  }
  await cdp.send("Page.navigate", { url });
  await sleep(5000);
  for (let i = 0; i < 60; i++) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: "Boolean(document.querySelector('.client-portal-shell'))",
      returnByValue: true,
    });
    if (result.value) break;
    await sleep(500);
  }

  const { result } = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const doc = document.documentElement;
      const body = document.body;
      const main = document.querySelector('.client-portal-main');
      const faultsGrid = document.querySelector('.client-portal-main .order-2');
      const kpiGrid = document.querySelector('.client-portal-main .order-4');
      const elevatorWrap = document.querySelector('.client-portal-main .animation-delay-100');
      const mainStyle = main ? getComputedStyle(main) : null;
      const overflowX = Math.max(doc.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
      const clipped = Array.from(document.querySelectorAll('.client-portal-shell button, .client-portal-shell h1, .client-portal-shell h2'))
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2);
        }).length;
      const reportBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('דווח'));
      const reportRect = reportBtn ? reportBtn.getBoundingClientRect() : null;
      return {
        hasShell: Boolean(document.querySelector('.client-portal-shell')),
        mainMaxWidth: mainStyle?.maxWidth ?? null,
        mainWidthPx: main?.getBoundingClientRect().width ?? null,
        viewportWidth: window.innerWidth,
        horizontalOverflow: overflowX,
        clippedControls: clipped,
        faultsDisplay: faultsGrid ? getComputedStyle(faultsGrid).display : null,
        faultsCols: faultsGrid ? getComputedStyle(faultsGrid).gridTemplateColumns : null,
        kpiCols: kpiGrid ? getComputedStyle(kpiGrid).gridTemplateColumns : null,
        elevatorDisplay: elevatorWrap ? getComputedStyle(elevatorWrap).display : null,
        elevatorCols: elevatorWrap ? getComputedStyle(elevatorWrap).gridTemplateColumns : null,
        elevatorCardCount: elevatorWrap ? elevatorWrap.children.length : 0,
        reportBtnWidth: reportRect?.width ?? null,
        titleText: document.querySelector('header h1')?.textContent?.trim() ?? null,
      };
    })()`,
    returnByValue: true,
  });

  cdp.close();
  return result.value;
}

function assertViewport(width, m) {
  const issues = [];
  if (!m.hasShell) issues.push("missing .client-portal-shell");
  if (m.horizontalOverflow) issues.push("horizontal overflow");
  if (m.clippedControls > 0) issues.push(`clipped controls: ${m.clippedControls}`);

  const mainMaxPx = m.mainMaxWidth ? parseFloat(m.mainMaxWidth) : null;
  if (width < 768) {
    if (mainMaxPx && mainMaxPx > 520) issues.push(`main max-width too wide: ${mainMaxPx}`);
    if (m.kpiCols && !m.kpiCols.includes("px") && width === 375) {
      /* single column KPI expected — grid may still be 1fr */
    }
  } else if (width < 1024) {
    if (mainMaxPx && (mainMaxPx < 760 || mainMaxPx > 780))
      issues.push(`tablet main max-width expected ~768px, got ${mainMaxPx}`);
    if (m.faultsDisplay !== "grid")
      issues.push(`tablet faults layout expected grid, got ${m.faultsDisplay}`);
  } else {
    if (mainMaxPx && (mainMaxPx < 1080 || mainMaxPx > 1120))
      issues.push(`desktop main max-width expected ~1100px, got ${mainMaxPx}`);
    if (m.faultsDisplay !== "grid" || !m.faultsCols?.includes(" "))
      issues.push(`desktop faults expected 2-col grid, got ${m.faultsCols}`);
    if (m.elevatorDisplay !== "grid" || !m.elevatorCols?.includes(" "))
      issues.push(`desktop elevators expected grid, got ${m.elevatorCols}`);
    if (m.elevatorCardCount >= 2 && m.elevatorCols) {
      const colCount = m.elevatorCols.split(" ").filter(Boolean).length;
      if (colCount < 2) issues.push("elevator cards too cramped (need 2+ cols)");
    }
  }
  if (!m.titleText) issues.push("missing header title");
  return issues;
}

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error("Chrome not found at", CHROME);
    process.exit(1);
  }
  const token = await resolveToken(baseUrl);
  const portalUrl = `${baseUrl}/client/access/${encodeURIComponent(token)}`;
  const results = [];

  await withChrome(async (port) => {
    for (const width of WIDTHS) {
      const metrics = await measureAt(port, portalUrl, width, width < 768);
      const issues = assertViewport(width, metrics);
      results.push({ width, ok: issues.length === 0, issues, metrics });
    }
  });

  console.log(JSON.stringify({ baseUrl, results }, null, 2));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error("FAIL", failed.map((f) => `${f.width}px: ${f.issues.join("; ")}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS: responsive QA at 375, 768, 1024, 1366, 1920");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
