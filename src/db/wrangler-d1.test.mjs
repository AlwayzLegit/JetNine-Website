// OPS-183: production binds its own D1 database (jetnine-production), staging keeps
// jetnine-staging. OPS-213 (the cutover flip): wrangler.jsonc turns D1 on for production
// with DB_TARGET "d1" and DB_CUTOVER "production-d1" and no write pause.
// OPS-196: the voice Worker's production binding names the same database as the site's.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// wrangler.jsonc: strip // and /* */ comments outside strings, then drop trailing commas.
function parseJsonc(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const config = parseJsonc(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"));
const dbOf = (list) => (list ?? []).filter((d) => d.binding === "DB");

test("production has one DB binding: jetnine-production, with the shared migrations folder", () => {
  const dbs = dbOf(config.d1_databases);
  assert.equal(dbs.length, 1);
  assert.equal(dbs[0].database_name, "jetnine-production");
  assert.equal(dbs[0].migrations_dir, "src/db/d1/migrations");
  assert.match(dbs[0].database_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test("staging still binds jetnine-staging, a different database from production", () => {
  const staging = dbOf(config.env.staging.d1_databases);
  assert.equal(staging.length, 1);
  assert.equal(staging[0].database_name, "jetnine-staging");
  assert.equal(staging[0].migrations_dir, "src/db/d1/migrations");
  assert.notEqual(staging[0].database_id, dbOf(config.d1_databases)[0].database_id);
});

test("production sets DB_TARGET d1 and DB_CUTOVER exactly production-d1, with no write pause (OPS-213)", () => {
  assert.equal(config.vars?.DB_TARGET, "d1");
  assert.equal(config.vars?.DB_CUTOVER, "production-d1");
  assert.equal(config.vars?.DEPLOY_ENV, "production");
  assert.equal(config.vars?.WRITES_PAUSED, undefined);
});

test("staging sets DB_TARGET d1, no DB_CUTOVER and no write pause (OPS-213)", () => {
  assert.equal(config.env.staging.vars.DB_TARGET, "d1");
  assert.equal(config.env.staging.vars.DB_CUTOVER, undefined);
  assert.equal(config.env.staging.vars.WRITES_PAUSED, undefined);
});

const voice = parseJsonc(readFileSync(new URL("../../voice/wrangler.jsonc", import.meta.url), "utf8"));

test("voice production binds the same D1 database as the site (jetnine-production)", () => {
  const dbs = dbOf(voice.d1_databases);
  assert.equal(dbs.length, 1);
  assert.equal(dbs[0].database_name, "jetnine-production");
  assert.equal(dbs[0].database_id, dbOf(config.d1_databases)[0].database_id);
});

test("voice staging still binds jetnine-staging with the site's staging id, a different database", () => {
  const staging = dbOf(voice.env.staging.d1_databases);
  assert.equal(staging.length, 1);
  assert.equal(staging[0].database_name, "jetnine-staging");
  assert.equal(staging[0].database_id, dbOf(config.env.staging.d1_databases)[0].database_id);
  assert.notEqual(staging[0].database_id, dbOf(voice.d1_databases)[0].database_id);
});

test("voice production sets DB_TARGET d1 and DB_CUTOVER exactly production-d1 and stays production; voice staging sets no DB_CUTOVER (OPS-213)", () => {
  assert.equal(voice.vars?.DB_TARGET, "d1");
  assert.equal(voice.vars?.DB_CUTOVER, "production-d1");
  assert.equal(voice.vars?.DEPLOY_ENV, "production");
  assert.equal(voice.env.staging.vars.DB_CUTOVER, undefined);
});
