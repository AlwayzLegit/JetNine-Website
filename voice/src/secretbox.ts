import { createDecipheriv } from "node:crypto";

// Decrypt-only twin of the site's src/lib/secretbox.ts. The site seals AI
// provider keys with AES-256-GCM under AI_KEYS_ENCRYPTION_KEY; this service
// only ever opens them. Format: `v1.<iv>.<tag>.<data>`, base64url parts.

const ENV = "AI_KEYS_ENCRYPTION_KEY";

export function secretboxConfigured(): boolean {
  return loadKey() !== null;
}

function loadKey(): Buffer | null {
  const raw = process.env[ENV];
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

export function openSealed(sealed: string): string {
  const key = loadKey();
  if (!key) throw new Error(`${ENV} is not set`);
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("secretbox: unrecognised ciphertext");
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
