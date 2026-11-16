// Pure helpers for the Postgres to D1 copy (OPS-105). No imports, so `node --test`
// can load this file. The copy itself is scripts/d1-copy/copy.mjs.
//
// The mapping follows DEPLOY.md "D1 tables (OPS-100)": uuid as text, timestamp as
// integer UTC milliseconds, date and time as text, numeric as the exact text,
// boolean as 0 or 1, jsonb and text[] as JSON text. The D1 column type decides:
// it is read from the Drizzle D1 schema (`columnType`), not guessed from the value.

/** The only database this tool may write to, and the only environment it may name. */
export const STAGING_DB = "jetnine-staging";
export const STAGING_ENV = "staging";

/**
 * Refuse everything but staging's own D1 database. Called with the values the
 * script is about to hand to wrangler, before any call.
 */
export function assertStaging({ target, database, env }) {
  if (target !== "staging") throw new Error(`refused: target must be "staging", got ${JSON.stringify(target)}`);
  if (database !== STAGING_DB) throw new Error(`refused: database must be ${STAGING_DB}`);
  if (env !== STAGING_ENV) throw new Error(`refused: wrangler env must be ${STAGING_ENV}`);
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
export function insertStatement(table, columns, row) {
  const names = columns.map((c) => q(c.name)).join(", ");
  const values = columns
    .map((c) => {
      const m = mapValue(c.columnType, row[c.name]);
      if (c.columnType === "SQLiteInteger" && typeof m === "string") return m;
      return sqlLiteral(m);
    })
    .join(", ");
  return `INSERT INTO ${q(table)} (${names}) VALUES (${values});`;
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
