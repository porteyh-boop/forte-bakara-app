import { Paragraph, TextRun } from "docx";
import { masterLetterParagraphStyle, masterLetterRunStyle } from "./theme";

function textBlockToParagraph(block: string, bold = false): Paragraph {
  const lines = block.split("\n").map((line) => line.trim());

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
          ...masterLetterRunStyle,
          text: line,
          bold,
        })
      );
    }
  });

  return new Paragraph({
    ...masterLetterParagraphStyle,
    children: children.length > 0 ? children : [new TextRun({ ...masterLetterRunStyle, text: "" })],
  });
}

export function bodyTextToParagraphs(bodyText: string): Paragraph[] {
  return bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => textBlockToParagraph(block));
}

export function createRtlParagraph(text: string, bold = false): Paragraph {
  return textBlockToParagraph(text, bold);
}
