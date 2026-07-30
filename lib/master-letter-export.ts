import { BRAND_EDITOR_FULL, BRAND_SIGNATURE } from "./brand";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => escapeHtml(line.trim()));
      return `<p style="margin:0 0 10pt 0;line-height:1.5;">${lines.join("<br/>")}</p>`;
    })
    .join("\n");
}

export function buildMasterLetterDocHtml(params: {
  subject: string;
  bodyText: string;
}): string {
  const subject = escapeHtml(params.subject.trim());
  const bodyHtml = textToHtmlParagraphs(params.bodyText);

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
      lang="he" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${subject}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; direction: rtl; text-align: right; }
  h1 { font-size: 14pt; margin: 0 0 16pt 0; }
</style>
</head>
<body>
  <h1>${subject}</h1>
  ${bodyHtml}
  <p style="margin:16pt 0 4pt 0;">${escapeHtml(BRAND_SIGNATURE.greeting)}</p>
  <p style="margin:0;">${escapeHtml(BRAND_SIGNATURE.name)}</p>
  <p style="margin:0;">${escapeHtml(BRAND_EDITOR_FULL)}</p>
</body>
</html>`;
}

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
  return `forte-letter_${building}_${slug || "letter"}_${datePart}.doc`;
}

export function createMasterLetterDocFile(params: {
  subject: string;
  bodyText: string;
  buildingId: string;
  title: string;
}): File {
  const html = buildMasterLetterDocHtml({
    subject: params.subject,
    bodyText: params.bodyText,
  });
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const fileName = buildMasterLetterFileName({
    buildingId: params.buildingId,
    title: params.title,
  });
  return new File([blob], fileName, { type: "application/msword" });
}
