/**
 * Prints non-secret Supabase env classification only (for dev vs prod gate).
 * Reads path from FORTE_ENV_FILE or ../forte-bakara-app/.env.local
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(here, "../../forte-bakara-app/.env.local");
const envPath = process.env.FORTE_ENV_FILE?.trim() || defaultPath;

if (!fs.existsSync(envPath)) {
  console.log(JSON.stringify({ ok: false, reason: "env_file_missing", path: envPath }));
  process.exit(0);
}

const text = fs.readFileSync(envPath, "utf8");
const urlLine = text.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
const rawUrl = urlLine?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
let hostname = "";
try {
  hostname = new URL(rawUrl).hostname;
} catch {
  hostname = "";
}
const projectRef = hostname.endsWith(".supabase.co")
  ? hostname.slice(0, -".supabase.co".length)
  : "";

const hasService = /^SUPABASE_SERVICE_ROLE_KEY=\S+/m.test(text);
const hasAnon = /^NEXT_PUBLIC_SUPABASE_ANON_KEY=\S+/m.test(text);
const hasTelegram = /^TELEGRAM_BOT_TOKEN=\S+/m.test(text);

console.log(
  JSON.stringify({
    ok: Boolean(projectRef && hasService && hasAnon),
    envFile: envPath,
    projectRef: projectRef || null,
    hasServiceRole: hasService,
    hasAnonKey: hasAnon,
    telegramConfigured: hasTelegram,
    note:
      "Repository has no second env template; treat projectRef as the active Supabase target until a dedicated dev project is documented.",
  })
);
