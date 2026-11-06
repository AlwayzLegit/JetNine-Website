import { describe, expect, it } from "vitest";
import { twilioSignature, validateTwilioRequest } from "../src/twilio.js";

// Twilio's documented example: https://www.twilio.com/docs/usage/security
// (auth token 12345, a <Gather> POST to a URL with a query string).
const AUTH_TOKEN = "12345";
const URL = "https://example.com/myapp.php?foo=1&bar=2";
const PARAMS = {
  Digits: "1234",
  To: "+18005551212",
  From: "+14158675310",
  Caller: "+14158675310",
  CallSid: "CA1234567890ABCDE",
};
const DOCUMENTED = "L/OH5YylLD5NRKLltdqwSvS0BnU=";

describe("Twilio signature (WebCrypto HMAC-SHA1)", () => {
  it("matches Twilio's documented example", async () => {
    expect(await twilioSignature(AUTH_TOKEN, URL, PARAMS)).toBe(DOCUMENTED);
  });

  it("accepts the documented request", async () => {
    expect(await validateTwilioRequest(AUTH_TOKEN, DOCUMENTED, URL, PARAMS)).toBe(true);
  });

  it("rejects a changed param, URL, token or a missing header", async () => {
    expect(await validateTwilioRequest(AUTH_TOKEN, DOCUMENTED, URL, { ...PARAMS, Digits: "1235" })).toBe(false);
    expect(await validateTwilioRequest(AUTH_TOKEN, DOCUMENTED, "https://example.com/myapp.php?foo=1&bar=3", PARAMS)).toBe(false);
    expect(await validateTwilioRequest("54321", DOCUMENTED, URL, PARAMS)).toBe(false);
    expect(await validateTwilioRequest(AUTH_TOKEN, null, URL, PARAMS)).toBe(false);
    expect(await validateTwilioRequest("", DOCUMENTED, URL, PARAMS)).toBe(false);
  });
});
