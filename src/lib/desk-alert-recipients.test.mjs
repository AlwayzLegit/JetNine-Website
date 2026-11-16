import test from "node:test";
import assert from "node:assert/strict";
import { DESK_ALERT_KIND, mergeDeskRecipients } from "./desk-alert-recipients.mjs";

const INBOX = "Dispatch@Example.com";

test("nobody extra gives the inbox alone, as a string", () => {
  assert.equal(mergeDeskRecipients(INBOX, []), INBOX);
  assert.equal(mergeDeskRecipients(INBOX, undefined), INBOX);
});

test("staff are added after the inbox, in order, lower case", () => {
  assert.deepEqual(mergeDeskRecipients(INBOX, ["Ann@Example.com", "bob@example.com"]), [
    INBOX,
    "ann@example.com",
    "bob@example.com",
  ]);
});

test("the inbox given again in another case is not repeated", () => {
  assert.equal(mergeDeskRecipients(INBOX, ["dispatch@example.com"]), INBOX);
  assert.deepEqual(mergeDeskRecipients(INBOX, ["DISPATCH@EXAMPLE.COM", "ann@example.com"]), [INBOX, "ann@example.com"]);
});

test("duplicates, blanks and entries without @ are dropped", () => {
  assert.deepEqual(
    mergeDeskRecipients(INBOX, ["ann@example.com", " ANN@example.com ", "", "   ", "not-an-address"]),
    [INBOX, "ann@example.com"],
  );
  assert.equal(mergeDeskRecipients(INBOX, ["", "x"]), INBOX);
});

test("the inbox stays first even when it comes back from the database list", () => {
  const r = mergeDeskRecipients(INBOX, ["ann@example.com", "dispatch@example.com"]);
  assert.equal(r[0], INBOX);
  assert.equal(r.length, 2);
});

test("the alert kind is the new-request toggle", () => {
  assert.equal(DESK_ALERT_KIND, "newRequest");
});
