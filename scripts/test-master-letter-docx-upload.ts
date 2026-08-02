/**
 * בדיקת העלאת DOCX מכתב ל-document-center
 * הרצה: npx tsx scripts/test-master-letter-docx-upload.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  buildMasterLetterFileName,
  createMasterLetterDocFile,
} from "../lib/master-letter-export";
import {
  buildMasterLetterPreview,
  MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
} from "../lib/master-letters";

const BUCKET = "document-center";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

async function main() {
  loadEnv();
  await ensureProductionEnv();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("FAIL: Supabase env missing");
    process.exit(1);
  }

  const preview = buildMasterLetterPreview({
    templateId: MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
    subject: "מכתב מעקב — בקרת שירות מעליות",
    building: {
      buildingId: "md25",
      buildingName: "ישורון 34",
      address: "ישורון 34",
      city: "תל אביב",
      managementCompany: "ועד הבית",
    },
    elevatorName: "מעלית ימין",
  });

  const file = await createMasterLetterDocFile({
    subject: preview.subject,
    bodyText: preview.bodyText,
    buildingId: "md25",
    title: "מכתב מעקב QA",
    letterDate: "2026-06-05",
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  let failed = false;

  function pass(label: string) {
    console.log("PASS:", label);
  }
  function fail(label: string, detail?: string) {
    failed = true;
    console.error("FAIL:", label, detail ?? "");
  }

  console.log("\n=== Master Letter DOCX upload test ===");
  console.log("Supabase:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("File:", file.name, file.type, file.size, "bytes");

  if (!file.name.endsWith(".docx")) fail("extension", file.name);
  else pass("extension is .docx");

  if (file.type !== DOCX_MIME) fail("mime", file.type);
  else pass("MIME is DOCX OOXML");

  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail("zip magic", "not PK");
  else pass("ZIP/OOXML magic bytes (PK)");

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const storagePath = `md25/2026-06-05/${buildMasterLetterFileName({
    buildingId: "md25",
    title: "qa-docx-test",
    date: new Date("2026-06-05T10:00:00.000Z"),
  })}`;

  const upload = await client.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: DOCX_MIME,
    upsert: false,
  });

  if (upload.error) {
    fail("storage upload", upload.error.message);
  } else {
    pass(`uploaded to ${BUCKET}/${storagePath}`);
    const removed = await client.storage.from(BUCKET).remove([storagePath]);
    if (removed.error) {
      fail("cleanup", removed.error.message);
    } else {
      pass("cleanup removed test file");
    }
  }

  console.log(failed ? "\nRESULT: FAILED" : "\nRESULT: ALL PASSED");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
