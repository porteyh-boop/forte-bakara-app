import { AlignmentType, LineRuleType } from "docx";
import { BRAND_EDITOR_NAME, BRAND_FORTE } from "../brand";

export const MASTER_LETTER_LOGO_PUBLIC_PATH = "/forte-logo.png";

export const MASTER_LETTER_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const MASTER_LETTER_DOCX_FONT = "Arial";

/** docx font size is half-points — 24 = 12pt */
export const MASTER_LETTER_DOCX_FONT_SIZE = 24;
/** 26 half-points = 13pt */
export const MASTER_LETTER_DOCX_SUBJECT_FONT_SIZE = 26;

export const MASTER_LETTER_DOCX_LINE = 360;
export const MASTER_LETTER_DOCX_PARAGRAPH_AFTER = 200;
export const MASTER_LETTER_DOCX_LOGO_AFTER = 360;
export const MASTER_LETTER_DOCX_DATE_AFTER = 280;
export const MASTER_LETTER_DOCX_SUBJECT_AFTER = 240;
export const MASTER_LETTER_DOCX_SIGNATURE_BEFORE = 360;

export const MASTER_LETTER_DOCX_LOGO_MAX_WIDTH = 112;

/** Signature title in exported DOCX only (formal letter wording). */
export const MASTER_LETTER_DOCX_SIGNATURE_TITLE = [
  "שמאי ו",
  "יוע",
  "ץ",
  " מעליות",
].join("");

export const MASTER_LETTER_DOCX_SIGNATURE_LINES = [
  "בברכה,",
  BRAND_EDITOR_NAME,
  MASTER_LETTER_DOCX_SIGNATURE_TITLE,
  BRAND_FORTE,
] as const;

/**
 * In Word, jc is mirrored for bidi paragraphs — START anchors content to the physical right edge.
 */
export const masterLetterParagraphAlignment = AlignmentType.START;

export const masterLetterParagraphStyle = {
  bidirectional: true,
  alignment: masterLetterParagraphAlignment,
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

export const masterLetterSubjectRunStyle = {
  ...masterLetterRunStyle,
  size: MASTER_LETTER_DOCX_SUBJECT_FONT_SIZE,
  bold: true,
} as const;
