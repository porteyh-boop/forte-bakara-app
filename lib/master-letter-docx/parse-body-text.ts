import { BRAND_EDITOR_NAME } from "../brand";

export type ParsedMasterLetterBody = {
  addresseeBlocks: string[];
  salutation: string | null;
  bodyBlocks: string[];
  hasRecognizedSignature: boolean;
};

function isSalutationBlock(block: string): boolean {
  return /^שלום רב,?\s*$/.test(block.trim());
}

function isSignatureBlock(block: string): boolean {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  if (!/^בברכה,?\s*$/.test(lines[0])) return false;
  if (lines.length === 1) return false;
  return lines[1] === BRAND_EDITOR_NAME;
}

function normalizeSalutation(block: string): string {
  const trimmed = block.trim();
  return trimmed.endsWith(",") ? trimmed : `${trimmed},`;
}

/** Split "לכבוד …" into two lines for formal letter layout (export layer only). */
export function formatAddresseeBlock(block: string): string {
  const trimmed = block.trim();
  const match = trimmed.match(/^לכבוד\s+(.+)$/);
  if (match) {
    return `לכבוד\n${match[1]}`;
  }
  return trimmed;
}

/**
 * Conservative split of bodyText for DOCX layout only.
 * Does not rewrite letter content — only separates structural blocks when patterns match.
 */
export function parseMasterLetterBodyText(bodyText: string): ParsedMasterLetterBody {
  const blocks = bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return {
      addresseeBlocks: [],
      salutation: null,
      bodyBlocks: [],
      hasRecognizedSignature: false,
    };
  }

  let salutationIndex = -1;
  for (let i = 0; i < blocks.length; i++) {
    if (isSalutationBlock(blocks[i])) {
      salutationIndex = i;
      break;
    }
  }

  let signatureIndex = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (isSignatureBlock(blocks[i])) {
      signatureIndex = i;
      break;
    }
  }

  const bodyEnd =
    signatureIndex >= 0 ? signatureIndex : blocks.length;

  if (salutationIndex >= 0 && blocks[0].startsWith("לכבוד")) {
    return {
      addresseeBlocks: blocks.slice(0, salutationIndex),
      salutation: normalizeSalutation(blocks[salutationIndex]),
      bodyBlocks: blocks.slice(salutationIndex + 1, bodyEnd),
      hasRecognizedSignature: signatureIndex >= 0,
    };
  }

  return {
    addresseeBlocks: [],
    salutation: salutationIndex >= 0 ? normalizeSalutation(blocks[salutationIndex]) : null,
    bodyBlocks:
      salutationIndex >= 0
        ? blocks.slice(salutationIndex + 1, bodyEnd)
        : blocks.slice(0, bodyEnd),
    hasRecognizedSignature: signatureIndex >= 0,
  };
}
