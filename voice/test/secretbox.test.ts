import { createCipheriv, randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

const KEY = randomBytes(32).toString("hex");

// Mirror of the site's seal(): the service only opens, so the test seals.
function seal(plaintext: string, keyHex = KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const b64 = (b: Buffer) => b.toString("base64url");
  return ["v1", b64(iv), b64(cipher.getAuthTag()), b64(data)].join(".");
}

const { openSealed, secretboxConfigured } = await import("../src/secretbox.js");

describe("secretbox", () => {
  afterEach(() => {
    delete process.env.AI_KEYS_ENCRYPTION_KEY;
  });

  it("opens what the site sealed", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = KEY;
    expect(secretboxConfigured()).toBe(true);
    expect(openSealed(seal("sk-ant-example-key-1234"))).toBe("sk-ant-example-key-1234");
  });

  it("rejects a tampered ciphertext", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = KEY;
    const s = seal("secret");
    const parts = s.split(".");
    parts[3] = parts[3].replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(() => openSealed(parts.join("."))).toThrow();
  });

  it("rejects the wrong key and reports unconfigured without one", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    expect(() => openSealed(seal("secret"))).toThrow();
    delete process.env.AI_KEYS_ENCRYPTION_KEY;
    expect(secretboxConfigured()).toBe(false);
    process.env.AI_KEYS_ENCRYPTION_KEY = "not-hex";
    expect(secretboxConfigured()).toBe(false);
  });
});
