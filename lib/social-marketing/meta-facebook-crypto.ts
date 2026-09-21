import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const dedicated = process.env.META_TOKEN_ENCRYPTION_KEY?.trim();
  if (dedicated) {
    const buf = Buffer.from(dedicated, "base64");
    if (buf.length === 32) return buf;
    return createHash("sha256").update(dedicated).digest();
  }
  const fallback = process.env.FORTE_SESSION_SECRET?.trim();
  if (!fallback) throw new Error("encryption_key_missing");
  return createHash("sha256").update(`forte-meta-fb:${fallback}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("invalid_ciphertext");
  const decipher = createDecipheriv(
    ALGO,
    encryptionKey(),
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function hashOpaque(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
