/**
 * FORTE AI Hebrew UI — no English agent jargon in user-facing strings.
 */
import fs from "fs";
import path from "path";
import { formatRecentActionDisplay } from "../lib/forte-ai-display-he";
import { FORTE_AI_AGENT_DISPLAY_NAMES } from "../lib/forte-ai-display-he";
import type { AiActionDto } from "../lib/forte-ai-marketing";

let failed = 0;

function assert(cond: boolean, label: string) {
  if (!cond) {
    console.error("  ✗", label);
    failed += 1;
  } else {
    console.log("  ✓", label);
  }
}

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** Strip imports/code — rough check for quoted UI strings in TSX. */
function userVisibleBlob(rel: string): string {
  const src = read(rel);
  const chunks: string[] = [];
  const re = /(?:title=|description=|subtitle=|label=|setMessage\(|setError\(|\>)([^<{]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    chunks.push(m[1]);
  }
  return chunks.join("\n");
}

console.log("\n=== FORTE AI Hebrew UI QA ===\n");

const view = read("components/master-v2/MasterForteAiView.tsx");
const scout = read("components/master-v2/MasterForteAiScoutSection.tsx");
const display = read("lib/forte-ai-display-he.ts");

assert(display.includes("מאתר"), "display module has מאתר");
assert(display.includes("מסנן"), "display module has מסנן");
assert(display.includes("כותב"), "display module has כותב");
assert(display.includes('active: "פעיל"'), "agent capability active label");
assert(display.includes("FORTE_AI_AGENT_CAPABILITY_ACTIVE"), "capability map");

for (const key of Object.keys(FORTE_AI_AGENT_DISPLAY_NAMES)) {
  assert(
    !FORTE_AI_AGENT_DISPLAY_NAMES[key as keyof typeof FORTE_AI_AGENT_DISPLAY_NAMES]
      .toUpperCase()
      .includes("SCOUT"),
    `agent label ${key} not SCOUT`
  );
}

const visible = userVisibleBlob("components/master-v2/MasterForteAiScoutSection.tsx");
for (const term of ["SCOUT", "QUALIFIER", "CONTENT", "DISTRIBUTION"]) {
  assert(!visible.includes(term), `Scout section visible text has no ${term}`);
}

assert(scout.includes("כותב — הכנת פנייה"), "content section Hebrew title");
assert(scout.includes("מסנן — בדיקת התאמה"), "qualifier section Hebrew title");
assert(scout.includes("מאתר — איתור"), "scout section Hebrew title");
assert(view.includes("formatRecentActionDisplay"), "recent actions localized");

const sampleAction: AiActionDto = {
  id: "1",
  agentId: "a",
  agentKey: "qualifier",
  taskId: null,
  actionType: "qualifier_completed",
  riskLevel: "internal",
  requiresApproval: false,
  summary: "QUALIFIER: suitable — ועד בית",
  createdAt: new Date().toISOString(),
};
const line = formatRecentActionDisplay(sampleAction);
assert(line.includes("מסנן"), "action display uses מסנן");
assert(!line.includes("QUALIFIER"), "action display hides QUALIFIER");
assert(line.includes("מתאים"), "action display Hebrew verdict");

console.log("\n--- Summary ---");
if (failed > 0) {
  console.error(`FAILED: ${failed}\n`);
  process.exit(1);
}
console.log("PASS: Hebrew UI QA\n");
