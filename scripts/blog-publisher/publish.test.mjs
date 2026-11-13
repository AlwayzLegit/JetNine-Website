import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CAP, WINDOW_DAYS, capCheck, capLine, siteLinks, validate } from "./publish.mjs";

const NOW = new Date("2026-11-13T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo, extra = {}) => ({ status: "published", publishedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(), ...extra });
const sample = () => JSON.parse(readFileSync(new URL("./sample-post.json", import.meta.url), "utf8"));

test("the cap constants are fixed", () => {
  assert.equal(CAP, 3);
  assert.equal(WINDOW_DAYS, 7);
});

test("cap: 2 posts in the window is allowed", () => {
  const r = capCheck([at(1), at(2)], NOW);
  assert.deepEqual([r.count, r.allowed, r.nextSlotAt], [2, true, null]);
});

test("cap: 3 posts in the window is refused and names the next slot", () => {
  const r = capCheck([at(1), at(3), at(6)], NOW);
  assert.equal(r.allowed, false);
  assert.equal(r.nextSlotAt.getTime(), NOW.getTime() - 6 * DAY + 7 * DAY);
  assert.match(capLine(r, "api"), /cap: 3 of 3 posts in the last 7 days \(source: api\), next slot opens/);
});

test("cap: the 7-day edge is outside the window", () => {
  assert.equal(capCheck([at(7), at(1), at(2)], NOW).count, 2);
  assert.equal(capCheck([at(6.99), at(1), at(2)], NOW).count, 3);
});

test("cap: future dates count, drafts and undated rows do not", () => {
  const r = capCheck([at(-2), at(1), { status: "draft", publishedAt: at(1).publishedAt }, { status: "published", publishedAt: null }], NOW);
  assert.equal(r.count, 2);
});

test("the sample passes validate", () => {
  assert.deepEqual(validate(sample(), []), []);
});

const bad = (change, pattern, existing = []) => {
  const post = { ...sample(), ...change };
  const problems = validate(post, existing);
  assert.ok(problems.some((p) => pattern.test(p)), `expected ${pattern}, got ${JSON.stringify(problems)}`);
};

test("validate: one failing case per rule", () => {
  bad({ title: "x".repeat(61) }, /title must be/);
  bad({ title: "" }, /title must be/);
  bad({ description: "x".repeat(161) }, /description must be/);
  bad({ slug: "Not Kebab" }, /kebab-case/);
  bad({}, /slug already used/, [{ slug: "sample-dry-run-post" }]);
  bad({}, /title already exists/, [{ slug: "other", title: "SAMPLE POST FOR THE PUBLISHER DRY RUN" }]);
  bad({ bodyMd: "## A\n\nshort\n\n## B\n\nshort\n\n## C\n\nshort" }, /minimum 900/);
  bad({ bodyMd: Array(950).fill("word").join(" ") }, /three ## sections/);
  bad({ tags: ["one"] }, /tags: 2 to 4/);
  bad({ tags: ["a", "b", "c", "d", "e"] }, /tags: 2 to 4/);
  bad({ faq: [{ q: "a", a: "b" }] }, /faq: 3 to 5/);
  bad({ heroImageUrl: "http://example.com/x.png" }, /heroImageUrl/);
  bad({ heroImageAlt: "" }, /heroImageAlt/);
  bad({ author: "Someone" }, /author must not be set/);
  bad({ publishedAt: "2026-01-01T00:00:00Z" }, /publishedAt must not be set/);
  bad({ status: "draft" }, /status must be/);
  bad({ description: "A long — dash" }, /dashes/);
  bad({ title: "A – dash" }, /dashes/);
  bad({ description: "Flights from $5 per seat" }, /dollar amounts/);
});

test("siteLinks finds site-relative links only", () => {
  assert.deepEqual(siteLinks("[a](/guides) [b](https://x.com) [c](/cost-calculator#top) [d](/guides)"), ["/guides", "/cost-calculator"]);
});
