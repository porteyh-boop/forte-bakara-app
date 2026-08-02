import {
  AlignmentType,
  convertInchesToTwip,
  Document,
  ImageRun,
  Paragraph,
} from "docx";
import { loadMasterLetterLogo } from "./logo";
import { bodyTextToParagraphs, createRtlParagraph } from "./rtl-paragraphs";
import {
  MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
} from "./theme";

function formatLetterDate(isoDate?: string): string {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function createLogoParagraph(logo: Awaited<ReturnType<typeof loadMasterLetterLogo>>): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: MASTER_LETTER_DOCX_PARAGRAPH_AFTER },
    children: [
      new ImageRun({
        type: logo!.type,
        data: logo!.data,
        transformation: {
          width: 150,
          height: 50,
        },
      }),
    ],
  });
}

export async function buildMasterLetterDocxDocument(params: {
  subject: string;
  bodyText: string;
  letterDate?: string;
}): Promise<Document> {
  const children: Paragraph[] = [];

  const logo = await loadMasterLetterLogo();
  if (logo) {
    children.push(createLogoParagraph(logo));
  }

  children.push(createRtlParagraph(formatLetterDate(params.letterDate)));
  children.push(createRtlParagraph(`הנדון: ${params.subject.trim()}`, true));
  children.push(...bodyTextToParagraphs(params.bodyText));

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });
}
