import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets we store in Postgres (AI provider API keys).
 *
 * The key is AI_KEYS_ENCRYPTION_KEY: 32 bytes as 64 hex chars, shared by
 * the site (which writes) and the Render voice service (which reads).
 * Ciphertext format is `v1.<iv>.<tag>.<data>`, each part base64url, so a
 * future key rotation can add a version prefix without a migration.
 *
 * The same code lives in voice/src/secretbox.ts; keep the two in step.
 */

const ENV = "AI_KEYS_ENCRYPTION_KEY";

export function isSecretboxConfigured(): boolean {
  return loadKey() !== null;
}

function loadKey(): Buffer | null {
  const raw = process.env[ENV];
  if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) return null;
  return Buffer.from(raw, "hex");
}

function requireKey(): Buffer {
  const key = loadKey();
  if (!key) throw new Error(`${ENV} is not set (need 64 hex chars — openssl rand -hex 32)`);
  return key;
}

export function seal(plaintext: string): string {
  const key = requireKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", b64(iv), b64(tag), b64(data)].join(".");
}

export function open(sealed: string): string {
  const key = requireKey();
  const parts = sealed.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("secretbox: unrecognised ciphertext");
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, unb64(iv));
  decipher.setAuthTag(unb64(tag));
  return Buffer.concat([decipher.update(unb64(data)), decipher.final()]).toString("utf8");
}

const b64 = (b: Buffer) => b.toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url");
