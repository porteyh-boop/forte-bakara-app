import {
  buildMasterLetterPreview,
  MASTER_LETTER_TEMPLATE_BUILDING_FOLLOW_UP,
} from "../lib/master-letters";
import { createMasterLetterDocFile } from "../lib/master-letter-export";

async function main() {
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
    elevatorId: "right",
    elevatorName: "מעלית ימין",
    customNote: "נא לתאם ביקור.",
  });

  const file = await createMasterLetterDocFile({
    subject: preview.subject,
    bodyText: preview.bodyText,
    buildingId: "md25",
    title: "מכתב מעקב — ישורון 34",
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  process.stdout.write(
    JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      magic: [bytes[0], bytes[1]],
    })
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
