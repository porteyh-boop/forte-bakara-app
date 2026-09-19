import { buildClientAccessUrl } from "@/lib/client-access";
import { BRAND_EDITOR_NAME } from "@/lib/brand";

export interface ClientUpdateShareMessageInput {
  recipientName: string;
  buildingLabel: string;
  updateTitle: string;
  portalUrl: string;
}

/** Digits-only international number suitable for wa.me (e.g. 972501234567). */
export function normalizeIsraeliPhoneForWhatsApp(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("972")) {
    return digits.length >= 11 && digits.length <= 13 ? digits : null;
  }

  if (digits.startsWith("0")) {
    if (digits.length < 9 || digits.length > 10) return null;
    return `972${digits.slice(1)}`;
  }

  if (digits.startsWith("5") && digits.length === 9) {
    return `972${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function buildClientUpdatePortalUrl(
  accessToken: string,
  siteOrigin = ""
): string {
  const base = buildClientAccessUrl(accessToken.trim(), siteOrigin);
  return `${base}#updates`;
}

export function buildClientUpdateShareMessage(
  input: ClientUpdateShareMessageInput
): string {
  const name = input.recipientName.trim() || "שלום";
  const greeting = name.startsWith("שלום") ? name : `שלום ${name}`;

  return [
    `${greeting},`,
    "",
    `קיים עדכון חדש בפורטל FORTE עבור ${input.buildingLabel.trim() || "הבניין"}.`,
    "",
    input.updateTitle.trim(),
    "",
    "לצפייה בעדכון ובמסמכים:",
    input.portalUrl.trim(),
    "",
    "בברכה,",
    BRAND_EDITOR_NAME,
  ].join("\n");
}

export function buildWhatsAppMeUrl(phoneDigits: string, message: string): string {
  const phone = phoneDigits.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildClientUpdateWhatsAppUrl(
  phoneRaw: string,
  message: string
): string | null {
  const digits = normalizeIsraeliPhoneForWhatsApp(phoneRaw);
  if (!digits) return null;
  return buildWhatsAppMeUrl(digits, message);
}
