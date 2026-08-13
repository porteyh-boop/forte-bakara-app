import {
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ImageRun,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import { loadMasterLetterLogo, scaleLogoTransformation } from "./logo";
import { parseMasterLetterBodyText } from "./parse-body-text";
import {
  bodyBlocksToParagraphs,
  createAddresseeParagraphs,
  createLetterCcParagraphs,
  createLetterRecipientsParagraphs,
  createRtlParagraph,
  createSignatureParagraph,
} from "./rtl-paragraphs";
import type { MasterLetterRecipientSnapshot } from "../master-letter-metadata";
import {
  MASTER_LETTER_DOCX_DATE_AFTER,
  MASTER_LETTER_DOCX_LOGO_AFTER,
  MASTER_LETTER_DOCX_SUBJECT_AFTER,
  masterLetterParagraphAlignment,
  masterLetterParagraphStyle,
  masterLetterRunStyle,
  masterLetterSubjectRunStyle,
} from "./theme";

function formatLetterDateDdMmYyyy(isoDate?: string): string {
  const date = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function createLogoParagraph(
  logo: NonNullable<Awaited<ReturnType<typeof loadMasterLetterLogo>>>
): Paragraph {
  const transformation = scaleLogoTransformation(logo);
  return new Paragraph({
    bidirectional: true,
    alignment: masterLetterParagraphAlignment,
    spacing: { after: MASTER_LETTER_DOCX_LOGO_AFTER },
    children: [
      new ImageRun({
        type: logo.type,
        data: logo.data,
        transformation,
      }),
    ],
  });
}

function createDateParagraph(isoDate?: string): Paragraph {
  return createRtlParagraph(formatLetterDateDdMmYyyy(isoDate), {
    spacingAfter: MASTER_LETTER_DOCX_DATE_AFTER,
  });
}

function createSubjectParagraph(subject: string): Paragraph {
  const text = `הנדון: ${subject.trim()}`;
  return new Paragraph({
    ...masterLetterParagraphStyle,
    spacing: {
      ...masterLetterParagraphStyle.spacing,
      after: MASTER_LETTER_DOCX_SUBJECT_AFTER,
    },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: "999999",
        space: 4,
      },
    },
    children: [
      new TextRun({
        ...masterLetterSubjectRunStyle,
        text,
      }),
    ],
  });
}

export async function buildMasterLetterDocxDocument(params: {
  subject: string;
  bodyText: string;
  letterDate?: string;
  recipients?: MasterLetterRecipientSnapshot[];
  cc?: MasterLetterRecipientSnapshot[];
}): Promise<Document> {
  const children: Paragraph[] = [];

  const logo = await loadMasterLetterLogo();
  if (logo) {
    children.push(createLogoParagraph(logo));
  }

  children.push(createDateParagraph(params.letterDate));

  const parsed = parseMasterLetterBodyText(params.bodyText);
  const explicitRecipients = params.recipients ?? [];

  if (explicitRecipients.length > 0) {
    children.push(...createLetterRecipientsParagraphs(explicitRecipients));
    if (params.cc && params.cc.length > 0) {
      children.push(...createLetterCcParagraphs(params.cc));
    }
  } else if (parsed.addresseeBlocks.length > 0) {
    children.push(...createAddresseeParagraphs(parsed.addresseeBlocks));
  }

  children.push(createSubjectParagraph(params.subject));

  if (parsed.salutation) {
    children.push(createRtlParagraph(parsed.salutation));
  }

  children.push(...bodyBlocksToParagraphs(parsed.bodyBlocks));

  if (parsed.hasRecognizedSignature) {
    children.push(createSignatureParagraph());
  }

  return new Document({
    features: {
      updateFields: true,
    },
    styles: {
      default: {
        document: {
          run: {
            font: masterLetterRunStyle.font,
            size: masterLetterRunStyle.size,
            rightToLeft: true,
          },
          paragraph: {
            alignment: masterLetterParagraphAlignment,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
            },
          },
        },
        children,
      },
    ],
  });
}
