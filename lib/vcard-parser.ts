import { type ContactInput } from "./contacts";

export interface ParsedVCard {
  fullName: string;
  firstName: string;
  lastName: string;
  company: string;
  roleTitle: string;
  phones: Array<{ value: string; types: string[] }>;
  emails: Array<{ value: string; types: string[] }>;
  addresses: string[];
  notes: string[];
}

const PHONE_TYPE_PRIORITY = [
  "CELL",
  "MOBILE",
  "IPHONE",
  "MAIN",
  "VOICE",
  "HOME",
  "WORK",
];

const EMAIL_TYPE_PRIORITY = ["INTERNET", "HOME", "WORK"];

function unfoldVCardLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: string[] = [];

  for (const line of rawLines) {
    if (lines.length > 0 && (line.startsWith(" ") || line.startsWith("\t"))) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function decodeQuotedPrintable(value: string): string {
  const withoutSoftBreaks = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < withoutSoftBreaks.length; i++) {
    if (withoutSoftBreaks[i] === "=" && i + 2 < withoutSoftBreaks.length) {
      const hex = withoutSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(withoutSoftBreaks.charCodeAt(i));
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function getParamValues(
  params: Record<string, string[]>,
  key: string
): string[] {
  return (params[key] ?? []).map((value) => value.toUpperCase());
}

function decodeVCardValue(
  value: string,
  params: Record<string, string[]>
): string {
  const encoding = getParamValues(params, "ENCODING")[0];
  const charset = getParamValues(params, "CHARSET")[0];

  let decoded = value;
  if (encoding === "QUOTED-PRINTABLE") {
    decoded = decodeQuotedPrintable(value);
  }

  decoded = decoded.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";");

  if (charset === "UTF-8" || charset === "UTF8") {
    return decoded;
  }

  return decoded;
}

function parsePropertyLine(line: string): {
  name: string;
  params: Record<string, string[]>;
  value: string;
} | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx < 0) return null;

  const left = line.slice(0, colonIdx);
  const rawValue = line.slice(colonIdx + 1);
  const segments = left.split(";");
  const name = segments[0]?.trim().toUpperCase();
  if (!name) return null;

  const params: Record<string, string[]> = {};
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i]?.trim();
    if (!segment) continue;
    const eqIdx = segment.indexOf("=");
    if (eqIdx >= 0) {
      const key = segment.slice(0, eqIdx).toUpperCase();
      const val = segment.slice(eqIdx + 1);
      if (!params[key]) params[key] = [];
      params[key].push(val);
    } else {
      if (!params.TYPE) params.TYPE = [];
      params.TYPE.push(segment.toUpperCase());
    }
  }

  return {
    name,
    params,
    value: decodeVCardValue(rawValue, params),
  };
}

function extractFirstVCardBlock(text: string): string | null {
  const match = text.match(/BEGIN:VCARD[\s\S]*?END:VCARD/i);
  return match?.[0] ?? null;
}

function nameFromNField(value: string): {
  fullName: string;
  firstName: string;
  lastName: string;
} {
  const parts = value.split(";");
  const lastName = (parts[0] ?? "").trim();
  const firstName = (parts[1] ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return { fullName, firstName, lastName };
}

function formatAddress(value: string): string {
  const parts = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(", ");
}

function pickPreferredValue(
  items: Array<{ value: string; types: string[] }>,
  priority: string[]
): string {
  if (items.length === 0) return "";
  for (const preferred of priority) {
    const match = items.find((item) =>
      item.types.some((type) => type.includes(preferred))
    );
    if (match?.value.trim()) return match.value.trim();
  }
  return items.find((item) => item.value.trim())?.value.trim() ?? "";
}

function collectRemainingLines(
  items: string[],
  primary: string,
  label: string
): string[] {
  const extras = items
    .map((item) => item.trim())
    .filter((item) => item && item !== primary);
  if (extras.length === 0) return [];
  return [`${label}: ${extras.join(" | ")}`];
}

export function parseVCardContent(text: string): ParsedVCard | null {
  const block = extractFirstVCardBlock(text);
  if (!block) return null;

  const lines = unfoldVCardLines(block);
  let fullName = "";
  let firstName = "";
  let lastName = "";
  let company = "";
  let roleTitle = "";
  const phones: Array<{ value: string; types: string[] }> = [];
  const emails: Array<{ value: string; types: string[] }> = [];
  const addresses: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("BEGIN:") || trimmed.startsWith("END:")) {
      continue;
    }

    const property = parsePropertyLine(trimmed);
    if (!property) continue;

    const types = [
      ...getParamValues(property.params, "TYPE"),
      ...getParamValues(property.params, "TEL"),
    ];
    const value = property.value.trim();
    if (!value) continue;

    switch (property.name) {
      case "FN":
        fullName = value;
        break;
      case "N": {
        const parsedName = nameFromNField(value);
        if (!fullName) fullName = parsedName.fullName;
        if (!firstName) firstName = parsedName.firstName;
        if (!lastName) lastName = parsedName.lastName;
        break;
      }
      case "ORG":
        company = value.split(";")[0]?.trim() ?? value;
        break;
      case "TITLE":
        roleTitle = value;
        break;
      case "TEL":
        phones.push({ value, types });
        break;
      case "EMAIL":
        emails.push({ value, types });
        break;
      case "ADR": {
        const formatted = formatAddress(value);
        if (formatted) addresses.push(formatted);
        break;
      }
      case "NOTE":
        notes.push(value);
        break;
      default:
        break;
    }
  }

  const hasContactData =
    fullName ||
    firstName ||
    lastName ||
    phones.length > 0 ||
    emails.length > 0 ||
    company ||
    roleTitle ||
    addresses.length > 0 ||
    notes.length > 0;

  if (!hasContactData) return null;

  if (!fullName) {
    fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  }

  return {
    fullName,
    firstName,
    lastName,
    company,
    roleTitle,
    phones,
    emails,
    addresses,
    notes,
  };
}

export function vCardToContactInput(parsed: ParsedVCard): ContactInput {
  const primaryPhone = pickPreferredValue(parsed.phones, PHONE_TYPE_PRIORITY);
  const primaryEmail = pickPreferredValue(parsed.emails, EMAIL_TYPE_PRIORITY);

  const noteLines = [
    ...parsed.notes,
    ...collectRemainingLines(
      parsed.phones.map((item) => item.value),
      primaryPhone,
      "טלפונים נוספים"
    ),
    ...collectRemainingLines(
      parsed.emails.map((item) => item.value),
      primaryEmail,
      'דוא"ל נוסף'
    ),
    ...parsed.addresses.map((address) => `כתובת: ${address}`),
  ].filter(Boolean);

  return {
    fullName: parsed.fullName,
    company: parsed.company,
    roleTitle: parsed.roleTitle,
    phone: primaryPhone,
    email: primaryEmail,
    notes: noteLines.join("\n"),
  };
}

export function isSupportedVCardFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return lower.endsWith(".vcf") || lower.endsWith(".vcard");
}
