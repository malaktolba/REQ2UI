/**
 * Symmetric encryption for user-supplied provider API keys.
 *
 * BYOK keys are secrets the user trusts us with — they must never be stored in
 * plaintext, returned to the client, or written to logs. We encrypt them at rest
 * with AES-256-GCM (authenticated: tampering is detected on decrypt).
 *
 * The 32-byte key is derived (scrypt) from a server secret: a dedicated
 * ENCRYPTION_KEY when set, otherwise JWT_SECRET so the feature works without
 * extra env configuration in dev. Set a distinct ENCRYPTION_KEY in production so
 * rotating the JWT secret doesn't invalidate every stored provider key.
 */
import crypto from "crypto";
import { env } from "../../config/env";

const secret = process.env.ENCRYPTION_KEY || env.JWT_SECRET;
// Fixed salt: we need the derived key to be stable across restarts so previously
// encrypted blobs stay decryptable. The salt isn't a secret — the entropy is in
// `secret` — it just domain-separates this key from any other scrypt use.
const KEY = crypto.scryptSync(secret, "req2ui-byok-key-v1", 32);

/** Encrypt a plaintext secret → "iv:tag:ciphertext" (all base64). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** Decrypt a blob produced by `encryptSecret`. Throws if tampered/corrupt. */
export function decryptSecret(blob: string): string {
  const [ivB, tagB, dataB] = blob.split(":");
  if (!ivB || !tagB || !dataB) throw new Error("Malformed encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
}

/** Show only the first/last few chars so the user can recognise the key. */
export function maskKey(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 10) return "••••••";
  return `${plain.slice(0, 4)}••••••${plain.slice(-4)}`;
}
