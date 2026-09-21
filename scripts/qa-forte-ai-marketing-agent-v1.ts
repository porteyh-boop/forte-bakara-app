/**
 * Marketing agent v1 QA (static + server guards)
 * Run: npx tsx scripts/qa-forte-ai-marketing-agent-v1.ts
 */
import fs from "fs";
import path from "path";
import {
  isApprovedRow,
  requireApproval,
  socialPostHasApproval,
} from "../lib/social-marketing/social-marketing-server";
import { SOCIAL_MARKETING_APPROVER } from "../lib/social-marketing/social-marketing-types";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

const migration = read("supabase/migrations/051_social_marketing_posts.sql");
const server = read("lib/social-marketing/social-marketing-server.ts");
const view = read("components/master-v2/MasterForteAiMarketingSection.tsx");
const display = read("lib/forte-ai-display-he.ts");

assert(migration.includes("social_marketing_posts"), "migration creates posts table");
assert(migration.includes("'marketing'"), "migration adds marketing agent");
assert(migration.includes("approved_at"), "migration has approval columns");
assert(server.includes("approval_required"), "server approval_required error");
assert(server.includes("requireApproval"), "schedule uses requireApproval");
assert(server.includes("pending_approval"), "edit resets to pending_approval");
assert(display.includes('marketing: "שיווק"'), "display name שיווק");
assert(display.includes("marketing: true"), "marketing capability active");
assert(view.includes("שיווק — רשתות חברתיות"), "Hebrew section title");
assert(view.includes("פוסט חדש"), "new post button");
assert(!view.includes("DISTRIBUTION"), "no DISTRIBUTION in UI");
assert(view.includes("bodyFacebook"), "facebook body field");
assert(view.includes("bodyInstagram"), "instagram body field");
assert(view.includes("תצוגה מקדימה"), "preview for pending posts");
assert(view.includes("צור פוסטים עם AI"), "AI generate button");
assert(!view.includes('runAction(previewPost, "approve")'), "approve only via Judah dashboard");

assert(!isApprovedRow({ approved_at: "", approved_by: "יהודה" }), "empty approved_at blocked");
assert(isApprovedRow({ approved_at: new Date().toISOString(), approved_by: SOCIAL_MARKETING_APPROVER }), "full approval ok");
assert(requireApproval({ approved_at: null, approved_by: null }) === "approval_required", "requireApproval blocks");

assert(
  socialPostHasApproval({
    approvedAt: "2026-01-01T00:00:00Z",
    approvedBy: SOCIAL_MARKETING_APPROVER,
  }),
  "dto approval helper"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
