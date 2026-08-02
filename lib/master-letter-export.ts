import { Packer } from "docx";
import { buildMasterLetterDocxDocument } from "./master-letter-docx/build-document";
import { MASTER_LETTER_DOCX_MIME } from "./master-letter-docx/theme";

export { MASTER_LETTER_DOCX_MIME };

export function buildMasterLetterFileName(params: {
  buildingId: string;
  title: string;
  date?: Date;
}): string {
  const date = params.date ?? new Date();
  const datePart = date.toISOString().slice(0, 10);
  const slug = params.title
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0590-\u05FF-]/g, "")
    .slice(0, 40);
  const building = params.buildingId.trim().toLowerCase().slice(0, 20);
  return `forte-letter_${building}_${slug || "letter"}_${datePart}.docx`;
}

export async function createMasterLetterDocFile(params: {
  subject: string;
  bodyText: string;
  buildingId: string;
  title: string;
  letterDate?: string;
}): Promise<File> {
  const document = await buildMasterLetterDocxDocument({
    subject: params.subject,
    bodyText: params.bodyText,
    letterDate: params.letterDate,
  });

  const fileName = buildMasterLetterFileName({
    buildingId: params.buildingId,
    title: params.title,
  });

  if (typeof window !== "undefined") {
    const blob = await Packer.toBlob(document);
    return new File([blob], fileName, { type: MASTER_LETTER_DOCX_MIME });
  }

  const buffer = await Packer.toBuffer(document);
  return new File([new Uint8Array(buffer)], fileName, {
    type: MASTER_LETTER_DOCX_MIME,
  });
}
