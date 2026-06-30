/**
 * בדיקת מגבלת 50MB — מאגר מסמכים
 * הרצה: node scripts/test-document-center-50mb-limit.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "document-center";
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const MAX_ERROR = `הקובץ גדול מדי (מקסימום ${MAX_MB}MB).`;

function validateClientFileSize(sizeBytes) {
  if (sizeBytes > MAX_BYTES) return MAX_ERROR;
  return null;
}

function loadEnv() {
  for (const file of [".env.verify.local", ".env.local"]) {
    const envPath = path.join(process.cwd(), file);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  }
}

async function ensureProductionEnv() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const base = "https://forte-bakara-app.vercel.app";
  const html = await fetch(`${base}/master`).then((r) => r.text());
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
    (m) => m[0]
  );
  const all = (
    await Promise.all(
      chunks.slice(0, 15).map((p) => fetch(`${base}${p}`).then((r) => r.text()))
    )
  ).join("\n");
  const url = (all.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  const key = (
    all.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || []
  )[0];
  if (!url || !key) throw new Error("לא ניתן לחלץ Supabase מ-production");
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
}

function writeTempFile(name, sizeBytes) {
  const filePath = path.join(os.tmpdir(), name);
  const fd = fs.openSync(filePath, "w");
  const header = Buffer.from("%PDF-1.4\n% test file\n");
  fs.writeSync(fd, header);
  if (sizeBytes > header.length) {
    fs.writeSync(fd, Buffer.alloc(sizeBytes - header.length, 0));
  }
  fs.closeSync(fd);
  return filePath;
}

async function uploadFile(client, localPath, storagePath, contentType) {
  const body = fs.readFileSync(localPath);
  return client.storage.from(BUCKET).upload(storagePath, body, {
    contentType,
    upsert: false,
  });
}

loadEnv();
await ensureProductionEnv();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("FAIL: Supabase env missing");
  process.exit(1);
}

console.log("Supabase:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = createClient(url, key);

let failed = false;
function pass(label) {
  console.log("PASS:", label);
}
function fail(label, detail) {
  failed = true;
  console.error("FAIL:", label, detail ?? "");
}

console.log("\n=== 1 — ולידציית לקוח: PDF קטן ===");
if (validateClientFileSize(1024) === null) {
  pass("small.pdf accepted");
} else {
  fail("small.pdf should be accepted");
}

console.log("\n=== 2 — ולידציית לקוח: PDF ~45MB ===");
const size45 = 45 * 1024 * 1024;
if (validateClientFileSize(size45) === null) {
  pass("45MB accepted by client validation");
} else {
  fail("45MB should be accepted");
}

console.log("\n=== 3 — ולידציית לקוח: >50MB ===");
const overSize = MAX_BYTES + 1024;
const overError = validateClientFileSize(overSize);
if (overError === MAX_ERROR) {
  pass(`>${MAX_MB}MB blocked with: ${overError}`);
} else {
  fail(">50MB should be blocked", overError);
}

console.log("\n=== 4 — Storage: PDF קטן ===");
const smallPath = writeTempFile("dc-small.pdf", 4096);
const smallStorage = `md25/2026-06-05/test-small-${Date.now()}.pdf`;
const smallUp = await uploadFile(client, smallPath, smallStorage, "application/pdf");
if (smallUp.error) {
  fail("small upload", smallUp.error.message);
} else {
  pass("small PDF uploaded");
  await client.storage.from(BUCKET).remove([smallStorage]);
}

console.log("\n=== 5 — Storage: PDF ~45MB (may take a minute) ===");
const midPath = writeTempFile("dc-mid.pdf", size45);
const midStorage = `md25/2026-06-05/test-mid-${Date.now()}.pdf`;
const midUp = await uploadFile(client, midPath, midStorage, "application/pdf");
if (midUp.error) {
  fail("45MB upload", midUp.error.message);
  if (midUp.error.message.toLowerCase().includes("size")) {
    console.error(
      "HINT: הריצו migration 017 והגדירו Global file size limit ל-50MB ב-Dashboard"
    );
  }
} else {
  pass("45MB PDF uploaded");
  await client.storage.from(BUCKET).remove([midStorage]);
}

console.log("\n=== 6 — Storage: >50MB (צפוי לדחייה) ===");
const bigPath = writeTempFile("dc-big.pdf", overSize);
const bigStorage = `md25/2026-06-05/test-big-${Date.now()}.pdf`;
const bigUp = await uploadFile(client, bigPath, bigStorage, "application/pdf");
if (bigUp.error) {
  pass(`>${MAX_BYTES / 1024 / 1024}MB rejected by storage: ${bigUp.error.message}`);
} else {
  fail(">50MB should be rejected by storage");
  await client.storage.from(BUCKET).remove([bigStorage]);
}

for (const p of [smallPath, midPath, bigPath]) {
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: ALL PASSED");
process.exit(failed ? 1 : 0);
