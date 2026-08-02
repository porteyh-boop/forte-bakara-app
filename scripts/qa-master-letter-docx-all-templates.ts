/**
 * QA: branded RTL DOCX for all 6 master letter templates.
 * Run: npx tsx scripts/qa-master-letter-docx-all-templates.ts
 */
import fs from "fs";
import path from "path";
import {
  buildMasterLetterPreview,
  MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
  MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
  MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
  MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
  MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
  MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
} from "../lib/master-letters";
import { createMasterLetterDocFile } from "../lib/master-letter-export";
import { parseMasterLetterBodyText } from "../lib/master-letter-docx/parse-body-text";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const BUILDING = {
  buildingId: "md25",
  buildingName: "ישורון 34",
  address: "ישורון 34",
  city: "תל אביב",
  managementCompany: "ועד הבית",
};

const TEMPLATES = [
  {
    id: MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
    label: "inspector_findings",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_INSPECTOR_FINDINGS,
      subject: "",
      building: BUILDING,
      templateFields: {
        defect_count: 2,
        elevator_company: "שינדלר",
        recipient_type: "ועד בית",
        inspection_date: "2026-05-01",
        has_45_day_items: true,
        report_attached: true,
      },
    },
  },
  {
    id: MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
    label: "elevator_company_response",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_ELEVATOR_COMPANY_RESPONSE,
      subject: "",
      building: BUILDING,
      elevatorName: "מעלית ימין",
      templateFields: {
        elevator_company: "שינדלר",
        issue_topic: "תקלה חוזרת",
        response_deadline: "2026-06-15",
        issue_details: "נדרש טיפול דחוף.",
      },
    },
  },
  {
    id: MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
    label: "visit_summary",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_VISIT_SUMMARY,
      subject: "",
      building: BUILDING,
      elevatorName: "מעלית ימין",
      templateFields: {
        visit_date: "2026-06-01",
        findings: "ממצאים לדוגמה.",
        conclusions: "מסקנות לדוגמה.",
        recommendations: "המלצות לדוגמה.",
      },
    },
  },
  {
    id: MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
    label: "price_proposal_review",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_PRICE_PROPOSAL_REVIEW,
      subject: "",
      building: BUILDING,
      templateFields: {
        vendor_name: "שינדלר",
        proposal_date: "2026-06-01",
        proposal_amount: "12,000",
        assessment: "הצעה סבירה.",
        recommendation: "לאשר",
      },
    },
  },
  {
    id: MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
    label: "recurring_faults",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_RECURRING_FAULTS,
      subject: "",
      building: BUILDING,
      elevatorName: "מעלית ימין",
      templateFields: {
        elevator_company: "שינדלר",
        fault_description: "תקלה בדלת.",
        recurrence_count: 3,
        action_requested: "תיקון מיידי.",
      },
    },
  },
  {
    id: MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
    label: "building_follow_up",
    input: {
      templateId: MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
      subject: "מכתב מעקב — בקרת שירות מעליות",
      building: BUILDING,
      elevatorName: "מעלית ימין",
      customNote: "נא לתאם ביקור.",
      letterDate: "2026-08-02",
    },
  },
] as const;

async function main() {
  const outDir = path.join(process.cwd(), ".qa-docx-output");
  fs.mkdirSync(outDir, { recursive: true });

  let failed = 0;
  const results: Record<string, unknown>[] = [];

  for (const template of TEMPLATES) {
    const preview = buildMasterLetterPreview({
      ...template.input,
      letterDate: template.input.letterDate ?? "2026-08-02",
    });
    const parsed = parseMasterLetterBodyText(preview.bodyText);

    const file = await createMasterLetterDocFile({
      subject: preview.subject,
      bodyText: preview.bodyText,
      buildingId: BUILDING.buildingId,
      title: template.label,
      letterDate: template.input.letterDate ?? "2026-08-02",
    });

    const bytes = Buffer.from(await file.arrayBuffer());
    const outPath = path.join(outDir, `${template.label}.docx`);
    fs.writeFileSync(outPath, bytes);

    const checks = {
      extension: file.name.endsWith(".docx"),
      mime: file.type === DOCX_MIME,
      zipMagic: bytes[0] === 0x50 && bytes[1] === 0x4b,
      addresseeParsed: parsed.addresseeBlocks.length > 0,
      salutationParsed: parsed.salutation === "שלום רב,",
      signatureRecognized: parsed.hasRecognizedSignature,
      noDuplicateSalutationInBody: !parsed.bodyBlocks.some((b) =>
        /^שלום רב,?\s*$/.test(b.trim())
      ),
      noDuplicateSignatureInBody: !parsed.bodyBlocks.some((b) =>
        /^בברכה,?\s*$/m.test(b)
      ),
    };

    const ok = Object.values(checks).every(Boolean);
    if (!ok) failed++;

    results.push({
      template: template.label,
      file: file.name,
      size: file.size,
      outPath,
      checks,
      ok,
    });

    console.log(
      `${ok ? "PASS" : "FAIL"}: ${template.label}`,
      JSON.stringify(checks)
    );
  }

  const logoExists = fs.existsSync(path.join(process.cwd(), "public", "forte-logo.png"));
  console.log("\nLogo at public/forte-logo.png:", logoExists ? "YES" : "NO");
  console.log("\nSummary:", JSON.stringify({ failed, total: TEMPLATES.length, results }, null, 2));
  process.exit(failed > 0 || !logoExists ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
