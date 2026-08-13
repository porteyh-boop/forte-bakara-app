import { Paragraph, TextRun } from "docx";
import { formatAddresseeBlock } from "./parse-body-text";
import {
  formatCcSnapshotLine,
  formatRecipientSnapshotLines,
} from "./format-parties";
import type { MasterLetterRecipientSnapshot } from "../master-letter-metadata";
import {
  MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
  MASTER_LETTER_DOCX_SIGNATURE_BEFORE,
  MASTER_LETTER_DOCX_SIGNATURE_LINES,
  masterLetterParagraphStyle,
  masterLetterRunStyle,
  masterLetterSubjectRunStyle,
} from "./theme";

const MASTER_LETTER_DOCX_ADDRESSEE_BLOCK_AFTER = 120;

function textBlockToParagraph(
  block: string,
  options?: {
    bold?: boolean;
    spacingBefore?: number;
    spacingAfter?: number;
  }
): Paragraph {
  const lines = block.split("\n").map((line) => line.trim());
  const runStyle = options?.bold ? masterLetterSubjectRunStyle : masterLetterRunStyle;

  const children: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      children.push(
        new TextRun({
          ...masterLetterRunStyle,
          break: 1,
        })
      );
    }
    if (line) {
      children.push(
        new TextRun({
          ...runStyle,
          text: line,
          bold: options?.bold ?? ("bold" in runStyle ? runStyle.bold : false),
        })
      );
    }
  });

  return new Paragraph({
    ...masterLetterParagraphStyle,
    spacing: {
      ...masterLetterParagraphStyle.spacing,
      before: options?.spacingBefore,
      after: options?.spacingAfter ?? masterLetterParagraphStyle.spacing.after,
    },
    children:
      children.length > 0
        ? children
        : [new TextRun({ ...masterLetterRunStyle, text: "" })],
  });
}

export function bodyBlocksToParagraphs(blocks: string[]): Paragraph[] {
  return blocks.map((block) => textBlockToParagraph(block));
}

export function createRtlParagraph(
  text: string,
  options?: {
    bold?: boolean;
    spacingBefore?: number;
    spacingAfter?: number;
  }
): Paragraph {
  return textBlockToParagraph(text, options);
}

export function createAddresseeParagraphs(blocks: string[]): Paragraph[] {
  return blocks.map((block, index) =>
    textBlockToParagraph(index === 0 ? formatAddresseeBlock(block) : block, {
      spacingAfter:
        index < blocks.length - 1
          ? MASTER_LETTER_DOCX_ADDRESSEE_BLOCK_AFTER
          : MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
    })
  );
}

export function createLetterRecipientsParagraphs(
  recipients: MasterLetterRecipientSnapshot[]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  recipients.forEach((recipient, index) => {
    const lines = formatRecipientSnapshotLines(recipient, {
      includeLekavodLabel: index === 0,
    });
    if (lines.length === 0) return;

    paragraphs.push(
      textBlockToParagraph(lines.join("\n"), {
        spacingAfter:
          index < recipients.length - 1
            ? MASTER_LETTER_DOCX_ADDRESSEE_BLOCK_AFTER
            : MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
      })
    );
  });

  return paragraphs;
}

export function createLetterCcParagraphs(
  cc: MasterLetterRecipientSnapshot[]
): Paragraph[] {
  if (cc.length === 0) return [];

  const lines = ["עותק:", ...cc.map((entry) => formatCcSnapshotLine(entry))];
  return [
    textBlockToParagraph(lines.join("\n"), {
      spacingAfter: MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
    }),
  ];
}

export function createSignatureParagraph(): Paragraph {
  const lines = [...MASTER_LETTER_DOCX_SIGNATURE_LINES];
  const children: TextRun[] = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      children.push(
        new TextRun({
          ...masterLetterRunStyle,
          break: 1,
        })
      );
    }
    children.push(
      new TextRun({
        ...masterLetterRunStyle,
        text: line,
        bold: line === MASTER_LETTER_DOCX_SIGNATURE_LINES[3],
      })
    );
  });

  return new Paragraph({
    ...masterLetterParagraphStyle,
    spacing: {
      ...masterLetterParagraphStyle.spacing,
      before: MASTER_LETTER_DOCX_SIGNATURE_BEFORE,
    },
    children,
  });
}

/** @deprecated Use bodyBlocksToParagraphs after parseMasterLetterBodyText */
export function bodyTextToParagraphs(bodyText: string): Paragraph[] {
  return bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => textBlockToParagraph(block));
}
