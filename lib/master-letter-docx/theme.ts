import { AlignmentType, LineRuleType } from "docx";

export const MASTER_LETTER_LOGO_PUBLIC_PATH = "/forte-logo.png";

export const MASTER_LETTER_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MASTER_LETTER_DOCX_FONT = "Arial";
/** docx font size is half-points — 24 = 12pt */
export const MASTER_LETTER_DOCX_FONT_SIZE = 24;
export const MASTER_LETTER_DOCX_LINE = 360;
export const MASTER_LETTER_DOCX_PARAGRAPH_AFTER = 200;

export const masterLetterParagraphStyle = {
  bidirectional: true,
  alignment: AlignmentType.RIGHT,
  spacing: {
    after: MASTER_LETTER_DOCX_PARAGRAPH_AFTER,
    line: MASTER_LETTER_DOCX_LINE,
    lineRule: LineRuleType.AUTO,
  },
} as const;

export const masterLetterRunStyle = {
  font: MASTER_LETTER_DOCX_FONT,
  size: MASTER_LETTER_DOCX_FONT_SIZE,
  rightToLeft: true,
} as const;
