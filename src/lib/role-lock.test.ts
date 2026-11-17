import test from "node:test";
import assert from "node:assert/strict";
import { RoleChangeRefused, roleChangeAllowed } from "./role-lock";

test("an admin or an owner may change a role", () => {
  assert.equal(roleChangeAllowed({ actorRole: "admin", currentRole: "member", nextRole: "dispatcher" }), true);
  assert.equal(roleChangeAllowed({ actorRole: "superadmin", currentRole: "dispatcher", nextRole: "admin" }), true);
});

test("nobody else may, whatever the change", () => {
  for (const actorRole of ["member", "dispatcher", "operator_contact", "legacy", "", null, undefined]) {
    assert.equal(roleChangeAllowed({ actorRole, currentRole: "member", nextRole: "admin" }), false, String(actorRole));
  }
});

test("leaving the role as it is is always allowed", () => {
  assert.equal(roleChangeAllowed({ actorRole: "member", currentRole: "member", nextRole: "member" }), true);
  assert.equal(roleChangeAllowed({ actorRole: null, currentRole: "admin", nextRole: "admin" }), true);
});

test("the refusal carries the trigger's message", () => {
  const e = new RoleChangeRefused();
  assert.equal(e.message, "role can only be changed by admins");
  assert.equal(e.name, "RoleChangeRefused");
});
