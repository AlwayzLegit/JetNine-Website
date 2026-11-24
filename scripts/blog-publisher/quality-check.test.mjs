import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DESK_POINTS, MECHANICAL_POINTS, REQUIRED_POINTS, checkDesk, checkLinks, checkMechanics, formatLine, internalPath, linksOf, runCheck, summaryLine } from "./quality-check.mjs";

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const sample = () => read("./sample-post.json");
const failing = () => read("./fixtures/failing-post.json");
const okFetch = async () => ({ status: 200 });
const byPoint = (checks, point) => checks.find((c) => c.point === point);

test("there are 17 points: six for the desk, eleven measured", () => {
  assert.equal(DESK_POINTS.length, 6);
  assert.equal(MECHANICAL_POINTS.length, 11);
  assert.equal(REQUIRED_POINTS.length, 17);
  assert.equal(new Set(REQUIRED_POINTS).size, 17);
});

test("the sample passes all 17 points", async () => {
  const r = await runCheck(sample(), { fetchFn: okFetch });
  assert.deepEqual(r.checks.filter((c) => !c.pass), []);
  assert.match(summaryLine(r), /^check: 17 of 17 pass, sha256 [0-9a-f]{12}$/);
  assert.deepEqual(r.checks.map((c) => c.point), REQUIRED_POINTS);
});

test("the failing fixture fails exactly voice and internal_links", async () => {
  const r = await runCheck(failing(), { fetchFn: okFetch });
  assert.deepEqual(r.checks.filter((c) => !c.pass).map((c) => c.point), ["voice", "internal_links"]);
  assert.match(formatLine(byPoint(r.checks, "voice")), /^voice: FAIL: /);
});

test("desk: a missing, empty or malformed verdict fails that point", () => {
  assert.equal(checkDesk(undefined).filter((c) => !c.pass).length, 6);
  const d = sample().desk;
  assert.equal(checkDesk({ ...d, need: { pass: true, saw: "  " } }).filter((c) => !c.pass).map((c) => c.point)[0], "need");
  assert.equal(checkDesk({ ...d, new: { pass: "yes", saw: "x" } }).find((c) => c.point === "new").pass, false);
  assert.equal(checkDesk({ ...d, true: { pass: false, saw: "a claim not found" } }).find((c) => c.point === "true").pass, false);
});

const mech = (change, point) => byPoint(checkMechanics({ ...sample(), ...change }, change.target ?? sample().target), point);
const long = "word ".repeat(900);

test("each measured point passes once and fails once", () => {
  assert.equal(mech({}, "title_meta").pass, true);
  assert.equal(mech({ title: "Short" }, "title_meta").pass, false);
  assert.equal(mech({ description: "x".repeat(119) }, "title_meta").pass, false);
  assert.equal(mech({ bodyMd: `# A heading\n\n${sample().bodyMd}` }, "one_h1").pass, false);
  assert.equal(mech({ target: "something else" }, "target_in_title_and_first_100_words").pass, false);
  assert.equal(mech({ target: "" }, "target_in_title_and_first_100_words").pass, false);
  assert.equal(mech({ bodyMd: `## A\n\n${long}\n\n## B\n\nx\n\n## C\n\nx\n\n[a](/guides) [b](/cost-calculator)` }, "internal_links").pass, false);
  assert.equal(mech({ bodyMd: `## A\n\n${long}\n\n## B\n\nx\n\n## C\n\nx\n\n[a](/guides) [b](/cost-calculator) [c](/blog)` }, "quote_link").pass, false);
  assert.equal(mech({ faq: [{ q: "a", a: "b" }] }, "faq").pass, false);
  assert.equal(mech({ heroImageAlt: "short" }, "image_alt").pass, false);
  assert.equal(mech({ title: "Sample – post for the publisher dry run" }, "no_dashes").pass, false);
  assert.equal(mech({ bodyMd: `${sample().bodyMd}\n\n<div>raw</div>` }, "markdown").pass, false);
  assert.equal(mech({ bodyMd: "## A\n\nshort\n\n## B\n\nshort\n\n## C\n\nshort [q](/quote)" }, "markdown").pass, false);
  assert.equal(mech({ bodyMd: `## A\n\n${long}\n\n#### Skipped\n\nx\n\n## B\n\nx\n\n## C\n\nx` }, "markdown").pass, false);
});

test("external links: only https .gov sources pass", () => {
  const withLink = (href) => ({ bodyMd: `${sample().bodyMd}\n\nSee [a source](${href}).` });
  assert.equal(mech(withLink("https://www.faa.gov/some/page"), "no_competitor_links").pass, true);
  assert.equal(mech(withLink("https://www.example-charter.com/"), "no_competitor_links").pass, false);
  assert.equal(mech(withLink("http://www.faa.gov/"), "no_competitor_links").pass, false);
  assert.equal(mech(withLink("https://notgov.com/x.gov"), "no_competitor_links").pass, false);
});

test("linksOf leaves images out", () => {
  assert.deepEqual(linksOf("![x](/img.png) [a](/guides) [b](https://x.gov/y \"t\")"), ["/guides", "https://x.gov/y"]);
});

test("links_200: a 404, a thrown error and a HEAD-only refusal", async () => {
  const text = "[a](/guides) [b](https://www.faa.gov/x)";
  const seen = [];
  const f = async (url, init) => {
    seen.push(`${init.method} ${url}`);
    if (url.endsWith("/guides")) return { status: init.method === "HEAD" ? 405 : 200 };
    return { status: 404 };
  };
  const r = await checkLinks({ text, site: "https://jetnine.com", fetchFn: f });
  assert.equal(r.pass, false);
  assert.match(r.saw, /https:\/\/www\.faa\.gov\/x answered 404/);
  assert.doesNotMatch(r.saw, /\/guides answered/);
  assert.ok(seen.includes("GET https://jetnine.com/guides"));
  const t = await checkLinks({ text: "[a](/guides)", site: "https://jetnine.com", fetchFn: async () => { throw new Error("down"); } });
  assert.match(t.saw, /answered no answer/);
});

test("linksOf reads every link form the renderer makes: reference style, autolink, bare URL", () => {
  const md = [
    "A [reference link][ref] and a [shortcut] and an <https://auto.example.com/a> and bare https://bare.example.com/b, and www.www-bare.example.com/c.",
    "![an image][pic] and ![inline](/img.png).",
    "",
    "[ref]: https://competitor.example/not-found",
    "[shortcut]: /guides \"title\"",
    "[pic]: /images/blog/library/x.webp",
  ].join("\n");
  assert.deepEqual(linksOf(md).sort(), [
    "/guides",
    "https://auto.example.com/a",
    "https://bare.example.com/b",
    "https://competitor.example/not-found",
    "https://www.www-bare.example.com/c",
  ].sort());
});

test("a link hidden in a reference definition or an autolink is checked like any other", async () => {
  const hidden = `${sample().bodyMd}\n\nSee [a broker][b] and <https://broker.example.com/page>.\n\n[b]: https://other-broker.example.com/x\n`;
  const post = { ...sample(), bodyMd: hidden };
  assert.equal(byPoint(checkMechanics(post, post.target), "no_competitor_links").pass, false);
  const seen = [];
  const r = await checkLinks({ text: hidden, site: "https://jetnine.com", fetchFn: async (u) => { seen.push(u); return { status: 404 }; } });
  assert.equal(r.pass, false);
  assert.ok(seen.some((u) => u.startsWith("https://other-broker.example.com/x")));
  assert.ok(seen.some((u) => u.startsWith("https://broker.example.com/page")));
});

test("internalPath: relative and same-host absolute URLs are this site, anything else is not", () => {
  assert.equal(internalPath("/quote"), "/quote");
  assert.equal(internalPath("https://jetnine.com/quote?a=1"), "/quote?a=1");
  assert.equal(internalPath("https://www.jetnine.com/guides#top"), "/guides#top");
  assert.equal(internalPath("https://jetnine.com.evil.example/quote"), null);
  assert.equal(internalPath("//jetnine.com/quote"), null);
  assert.equal(internalPath("https://www.faa.gov/x"), null);
});

test("absolute JetNine URLs count as internal links and are not competitors", async () => {
  const body = sample().bodyMd.replace("](/cost-calculator)", "](https://jetnine.com/cost-calculator)").replace("](/quote)", "](https://www.jetnine.com/quote)");
  const post = { ...sample(), bodyMd: body };
  const m = checkMechanics(post, post.target);
  assert.equal(byPoint(m, "internal_links").pass, true);
  assert.equal(byPoint(m, "quote_link").pass, true);
  assert.equal(byPoint(m, "no_competitor_links").pass, true);
  const seen = [];
  const r = await checkLinks({ text: body, site: "https://jetnine.com", fetchFn: async (u) => { seen.push(u); return { status: 200 }; } });
  assert.equal(r.pass, true);
  assert.ok(seen.every((u) => u.startsWith("https://jetnine.com/")));
});
