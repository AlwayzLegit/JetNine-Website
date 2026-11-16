import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { LOOK_BACK, resolveBaseline } from "./baseline.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const keeps = [{ name: "speed-check-latest", expired: false }];

function run(runIds, artifactsByRun, { failDownload = [] } = {}) {
  const lines = [];
  const downloaded = [];
  const result = resolveBaseline({
    runIds,
    log: (l) => lines.push(l),
    listArtifacts: async (id) => artifactsByRun[id] ?? [],
    download: async (id) => {
      downloaded.push(id);
      if (failDownload.includes(id)) throw Object.assign(new Error("x"), { stderr: "HTTP 404: Not Found" });
    },
  });
  return result.then((id) => ({ id, lines, downloaded }));
}

test("the look back is the last 10 runs", () => {
  assert.equal(LOOK_BACK, 10);
});

test("the newest run kept no numbers (a hand-started base_url run), the second did: the second is the baseline", async () => {
  const r = await run([30, 20, 10], { 30: [], 20: keeps, 10: keeps });
  assert.equal(r.id, 20);
  assert.deepEqual(r.downloaded, [20]);
  assert.deepEqual(r.lines, ["Run 30 kept no numbers, looking further back", "Compared with run 20"]);
  assert.ok(!r.lines.some((l) => /first run/.test(l)), "never the silent first run line");
});

test("the newest run kept its numbers: it is the baseline and nothing else is read", async () => {
  const r = await run([30, 20], { 30: keeps, 20: keeps });
  assert.equal(r.id, 30);
  assert.deepEqual(r.downloaded, [30]);
  assert.deepEqual(r.lines, ["Compared with run 30"]);
});

test("none of 10 runs has numbers: one warning, no baseline, no download", async () => {
  const ids = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = await run(ids, {});
  assert.equal(r.id, null);
  assert.deepEqual(r.downloaded, []);
  assert.equal(r.lines.length, 11);
  assert.equal(
    r.lines.at(-1),
    "::warning::no stored numbers in the last 10 successful runs on main, the score alarm is off for this run",
  );
});

test("an expired artifact is passed over", async () => {
  const r = await run([30, 20], { 30: [{ name: "speed-check-latest", expired: true }], 20: keeps });
  assert.equal(r.id, 20);
  assert.deepEqual(r.downloaded, [20]);
  assert.equal(r.lines[0], "Run 30 kept no numbers, looking further back");
});

test("an artifact with another name does not count", async () => {
  const r = await run([30], { 30: [{ name: "search-report-latest", expired: false }] });
  assert.equal(r.id, null);
});

test("a failed download goes on to the next run and warns with the error text shown", async () => {
  const r = await run([30, 20], { 30: keeps, 20: keeps }, { failDownload: [30] });
  assert.equal(r.id, 20);
  assert.deepEqual(r.downloaded, [30, 20]);
  assert.equal(r.lines[0], "::warning::run 30 lists speed-check-latest but the download failed: HTTP 404: Not Found");
  assert.equal(r.lines[1], "Compared with run 20");
});

test("only a workflow with no successful run on main at all says first run", async () => {
  const r = await run([], {});
  assert.equal(r.id, null);
  assert.deepEqual(r.lines, ["No earlier result: first run"]);
});

test("a listing that fails for one run goes on to the next, with a warning", async () => {
  const lines = [];
  const id = await resolveBaseline({
    runIds: [2, 1],
    log: (l) => lines.push(l),
    listArtifacts: async (n) => {
      if (n === 2) throw new Error("boom");
      return keeps;
    },
    download: async () => {},
  });
  assert.equal(id, 1);
  assert.equal(lines[0], "::warning::run 2: could not list its artifacts: boom");
});

test("as a command with no repository it makes the folder, warns and exits 0", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "baseline-"));
  const env = { PATH: process.env.PATH };
  const out = spawnSync(process.execPath, [path.join(here, "baseline.mjs")], { cwd, env, encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /^::warning::GITHUB_REPOSITORY is not set/);
  assert.ok(existsSync(path.join(cwd, "previous")));
});
