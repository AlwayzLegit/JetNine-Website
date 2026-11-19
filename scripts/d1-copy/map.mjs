// Pure helpers for the Postgres to D1 copy (OPS-105). No imports, so `node --test`
// can load this file. The copy itself is scripts/d1-copy/copy.mjs.
//
// The mapping follows DEPLOY.md "D1 tables (OPS-100)": uuid as text, timestamp as
// integer UTC milliseconds, date and time as text, numeric as the exact text,
// boolean as 0 or 1, jsonb and text[] as JSON text. The D1 column type decides:
// it is read from the Drizzle D1 schema (`columnType`), not guessed from the value.

/** The staging database and environment: the default target, and what the tool has always written to. */
export const STAGING_DB = "jetnine-staging";
export const STAGING_ENV = "staging";

/**
 * The production database (OPS-183): wrangler.jsonc's top-level DB binding, so wrangler
 * gets no --env for it. Written only by a load with the typed confirm (OPS-197).
 */
export const PRODUCTION_DB = "jetnine-production";

/** The two targets this tool may name, each with the database and wrangler env that belong to it. */
export const TARGETS = {
  staging: { database: STAGING_DB, env: STAGING_ENV },
  production: { database: PRODUCTION_DB, env: undefined },
};

/** The word a production load needs in CONFIRM, and the word it needs in REPLACE to wipe a D1 that holds rows. */
export const CONFIRM_PRODUCTION = "copy-to-production";
export const REPLACE_PRODUCTION = "replace-production-d1";

/**
 * Refuse everything but the two known pairs: (staging, jetnine-staging, env staging) and
 * (production, jetnine-production, no env). Called with the values the script is about to
 * hand to wrangler, before any call.
 */
export function assertTarget({ target, database, env }) {
  if (target !== "staging" && target !== "production") {
    throw new Error(`refused: target must be "staging" or "production", got ${JSON.stringify(target)}`);
  }
  const want = TARGETS[target];
  if (database !== want.database) throw new Error(`refused: database must be ${want.database}`);
  if (env !== want.env) throw new Error(want.env ? `refused: wrangler env must be ${want.env}` : "refused: wrangler env must not be set for production");
}

/**
 * Refuse everything but staging's own D1 database. Kept for callers that only ever mean staging.
 */
export function assertStaging({ target, database, env }) {
  if (target !== "staging") throw new Error(`refused: target must be "staging", got ${JSON.stringify(target)}`);
  assertTarget({ target, database, env });
}

/**
 * The two keys of a production load (OPS-197): the typed confirm, and, when production D1 already
 * holds rows, the typed replace as well. After the cutover production D1 holds the only new writes,
 * so a load must never wipe it by accident. Pure; `d1RowsBefore` is the number of rows counted.
 */
export function assertProductionLoad({ confirm, replace, d1RowsBefore }) {
  if (confirm !== CONFIRM_PRODUCTION) {
    throw new Error(`refused: a load into production needs CONFIRM set to exactly ${CONFIRM_PRODUCTION}`);
  }
  if (d1RowsBefore > 0 && replace !== REPLACE_PRODUCTION) {
    throw new Error(`refused: production D1 holds ${d1RowsBefore} rows; to wipe and replace them REPLACE must be exactly ${REPLACE_PRODUCTION}`);
  }
}

const INT_RE = /^-?\d+$/;

/**
 * One Postgres value (as postgres.js returns it) to the value D1 stores.
 * Returns null, a number, or a string. Throws on a value it cannot map, naming the
 * column type and the JS type, never the value.
 * @param {string} columnType  Drizzle's `columnType` of the D1 column.
 * @param {unknown} value
 */
export function mapValue(columnType, value) {
  if (value === null || value === undefined) return null;
  switch (columnType) {
    case "SQLiteTimestamp": {
      if (value instanceof Date) {
        const ms = value.getTime();
        if (Number.isNaN(ms)) throw new Error("timestamp: invalid date");
        return ms;
      }
      if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
      if (typeof value === "string") {
        const ms = Date.parse(value);
        if (Number.isNaN(ms)) throw new Error("timestamp: unparsable string");
        return ms;
      }
      throw new Error(`timestamp: cannot map ${typeof value}`);
    }
    case "SQLiteBoolean": {
      if (typeof value === "boolean") return value ? 1 : 0;
      if (value === "t" || value === "true" || value === 1) return 1;
      if (value === "f" || value === "false" || value === 0) return 0;
      throw new Error(`boolean: cannot map ${typeof value}`);
    }
    case "SQLiteInteger": {
      if (typeof value === "boolean") return value ? 1 : 0;
      if (typeof value === "number" && Number.isInteger(value)) return value;
      // int8 comes back from postgres.js as a string of digits; keep it exact.
      if (typeof value === "string" && INT_RE.test(value)) return value;
      if (typeof value === "bigint") return value.toString();
      throw new Error(`integer: cannot map ${typeof value}`);
    }
    case "SQLiteTextJson": {
      // jsonb and json arrive parsed; text[] arrives as an array. All become JSON text.
      return JSON.stringify(value);
    }
    case "SQLiteText": {
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "bigint") return String(value);
      if (typeof value === "boolean") return value ? "true" : "false";
      if (value instanceof Date) return value.toISOString();
      if (typeof value === "object") return JSON.stringify(value);
      throw new Error(`text: cannot map ${typeof value}`);
    }
    default:
      throw new Error(`unknown D1 column type ${columnType}`);
  }
}

/** One mapped value as a SQLite literal. */
export function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("number: not finite");
    return String(v);
  }
  if (typeof v === "string") {
    // An int8 kept as digits is still a string here; the caller marks it by column type.
    return `'${v.replace(/'/g, "''")}'`;
  }
  throw new Error(`literal: cannot render ${typeof v}`);
}

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

/**
 * INSERT for one row. `columns` is [{ name, columnType }] in D1 order, `row` the
 * Postgres row by column name. An int8 string of digits is written as a bare number.
 */
export function insertStatement(table, columns, row, nullRefs = []) {
  const names = columns.map((c) => q(c.name)).join(", ");
  const values = columns
    .map((c) => {
      // A reference into a held-back table (api_keys, ai_providers) points at nothing: NULL (OPS-115).
      if (nullRefs.includes(c.name)) return "NULL";
      const m = mapValue(c.columnType, row[c.name]);
      if (c.columnType === "SQLiteInteger" && typeof m === "string") return m;
      return sqlLiteral(m);
    })
    .join(", ");
  return `INSERT INTO ${q(table)} (${names}) VALUES (${values});`;
}

/** D1's longest statement, in bytes (100,000 per the D1 limits page when OPS-115 was planned). */
export const STATEMENT_LIMIT = 100000;

/** True when one statement is longer than D1 accepts. */
export function statementTooLong(sql, limit = STATEMENT_LIMIT) {
  return Buffer.byteLength(sql, "utf8") > limit;
}

/**
 * What a SQLite constraint error says, reduced to the kind and the schema names it
 * carries ("UNIQUE users.email", "CHECK agent_memory_kind_check"). Only strict patterns
 * of word characters and dots are returned, so a value that a message might quote never
 * gets through. Anything else is "no detail".
 */
export function constraintDetail(text) {
  const s = String(text);
  let m = s.match(/UNIQUE constraint failed: ([\w.]+(?:, [\w.]+)*)(?![\w.])/);
  if (m) return `UNIQUE ${m[1]}`;
  m = s.match(/NOT NULL constraint failed: ([\w.]+)(?![\w.])/);
  if (m) return `NOT NULL ${m[1]}`;
  m = s.match(/CHECK constraint failed: ([\w.]+)(?![\w.])/);
  if (m) return `CHECK ${m[1]}`;
  if (/FOREIGN KEY constraint failed/.test(s)) return "FOREIGN KEY";
  return "no detail";
}

export const deleteStatement = (table) => `DELETE FROM ${q(table)};`;

/**
 * One canonical line for the checksum: the key values joined by a unit separator.
 * Numbers and digit strings both print as digits, so Postgres (mapped) and D1
 * (read back as JSON) give the same line for the same row.
 */
export function canonicalLine(values) {
  return values.map((v) => (v === null || v === undefined ? "\u0000null" : String(v))).join("\u001f");
}

/** Order-independent checksum of a table's key lines (sorted here, so DB collation does not matter). */
export async function checksumLines(lines) {
  const { createHash } = await import("node:crypto");
  const h = createHash("sha256");
  for (const l of [...lines].sort()) {
    h.update(l);
    h.update("\n");
  }
  return h.digest("hex");
}

/** Wrangler prints JSON for --json, possibly after a banner line. Returns the parsed value. */
export function parseWranglerJson(text) {
  const start = text.search(/[[{]/);
  if (start < 0) throw new Error("wrangler: no JSON in the output");
  return JSON.parse(text.slice(start));
}

/** The rows of the first statement in `wrangler d1 execute --json` output. */
export function resultRows(parsed) {
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || first.success === false) throw new Error("wrangler: the statement did not succeed");
  return first.results ?? [];
}

/** The line a held-back table prints: it must be empty in D1. */
export function heldLine({ table, reason, d1Count }) {
  return `${d1Count === 0 ? "held" : "FAIL"} ${table.padEnd(30)} not copied (${reason}); d1=${String(d1Count).padStart(7)}`;
}

/** The line one table prints. No row values, only names and numbers. */
export function reportLine({ table, pgCount, d1Count, checksumEqual }) {
  const equal = pgCount === d1Count && checksumEqual;
  return `${equal ? "ok  " : "FAIL"} ${table.padEnd(30)} postgres=${String(pgCount).padStart(7)} d1=${String(d1Count).padStart(7)} checksum equal ${checksumEqual ? "yes" : "no"}`;
}
