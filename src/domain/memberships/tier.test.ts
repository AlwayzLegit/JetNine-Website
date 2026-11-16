import test from "node:test";
import assert from "node:assert/strict";
import { membershipProgramEnum } from "@/db/schema/memberships";
import { memberTierEnum } from "@/db/schema/enums";
import { PROGRAM_TO_TIER, syncMemberTier, tierPatch, type TierExecutor } from "./tier";

const base = { program: "card_250", activatedOn: "2026-11-01", hasOtherActive: false } as const;

test("every program maps to the tier of the same name", () => {
  for (const program of membershipProgramEnum.enumValues) {
    assert.ok((memberTierEnum.enumValues as readonly string[]).includes(PROGRAM_TO_TIER[program]), program);
    assert.equal(PROGRAM_TO_TIER[program], program);
  }
});

test("activating sets the tier from the program and tier_since from activated_on", () => {
  assert.deepEqual(tierPatch({ ...base, status: "active", previousStatus: null }), { tier: "card_250", tierSince: "2026-11-01" });
  assert.deepEqual(tierPatch({ ...base, status: "active", previousStatus: "paused" }), { tier: "card_250", tierSince: "2026-11-01" });
});

test("changing the program of an active membership moves the tier", () => {
  assert.deepEqual(
    tierPatch({ ...base, program: "card_500", status: "active", previousStatus: "active" }),
    { tier: "card_500", tierSince: "2026-11-01" },
  );
});

test("losing the last active membership resets the tier and leaves tier_since alone", () => {
  const patch = tierPatch({ ...base, status: "cancelled", previousStatus: "active" });
  assert.deepEqual(patch, { tier: "on_demand" });
  assert.ok(patch && !("tierSince" in patch));
});

test("losing one while another is active changes nothing", () => {
  assert.equal(tierPatch({ ...base, status: "expired", previousStatus: "active", hasOtherActive: true }), null);
});

test("a row that was never active changes nothing", () => {
  assert.equal(tierPatch({ ...base, status: "paused", previousStatus: null }), null);
  assert.equal(tierPatch({ ...base, status: "cancelled", previousStatus: "paused" }), null);
});

// A stand-in for the database handle: each select resolves to the next queued result.
function fakeExecutor(selects: unknown[][]) {
  const updates: { table: unknown; set: unknown }[] = [];
  let i = 0;
  const select = () => {
    const result = selects[i++] ?? [];
    const chain: Record<string, unknown> = {};
    for (const m of ["from", "where", "limit"]) chain[m] = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return chain;
  };
  const update = (table: unknown) => ({
    set: (set: unknown) => ({
      where: async () => {
        updates.push({ table, set });
      },
    }),
  });
  return { executor: { select, update } as unknown as TierExecutor, updates, selectsUsed: () => i };
}

const row = (status: string) => ({ id: "m1", memberId: "mem1", program: "card_100", status, activatedOn: "2026-11-02" });

test("syncMemberTier writes the tier of an active membership", async () => {
  const { executor, updates, selectsUsed } = fakeExecutor([[row("active")]]);
  await syncMemberTier(executor, "m1", "paused");
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].set, { tier: "card_100", tierSince: "2026-11-02" });
  assert.equal(selectsUsed(), 1);
});

test("syncMemberTier resets only when no other membership is active", async () => {
  const none = fakeExecutor([[row("cancelled")], []]);
  await syncMemberTier(none.executor, "m1", "active");
  assert.deepEqual(none.updates.map((u) => u.set), [{ tier: "on_demand" }]);

  const other = fakeExecutor([[row("cancelled")], [{ id: "m2" }]]);
  await syncMemberTier(other.executor, "m1", "active");
  assert.equal(other.updates.length, 0);
});

test("syncMemberTier does nothing for a paused row and asks nothing more", async () => {
  const { executor, updates, selectsUsed } = fakeExecutor([[row("paused")]]);
  await syncMemberTier(executor, "m1", null);
  assert.equal(updates.length, 0);
  assert.equal(selectsUsed(), 1);
});

test("syncMemberTier does nothing for a missing membership", async () => {
  const { executor, updates } = fakeExecutor([[]]);
  await syncMemberTier(executor, "gone", "active");
  assert.equal(updates.length, 0);
});
