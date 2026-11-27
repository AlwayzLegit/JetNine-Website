// Pure helpers for the reverse copy, D1 back into Postgres (OPS-200). No imports, so `node --test`
// can load this file. The tool itself is scripts/d1-copy/reverse.mjs.
//
// The mapping is the inverse of map.mjs mapValue: D1 stores uuid as text, timestamps as integer UTC
// milliseconds, booleans as 0 or 1, jsonb and text[] as JSON text, numeric as exact text. Each D1 value
// becomes the JSON value that `jsonb_populate_recordset` turns back into the Postgres column. The D1
// column type decides, as in the forward copy. Messages here carry names and counts, never a row value.

/** The word a load needs in CONFIRM. Typed by the owner at the way back, never on the command line. */
export const CONFIRM_REVERSE = "copy-d1-to-postgres";

/**
 * Tables the reverse copy never deletes and never writes: short-lived counters with another shape in
 * Postgres (the forward copy holds them back too).
 */
export const REVERSE_SKIP = {
  request_rate_limits: "short-lived rate-limit counters, never copied",
  chat_daily: "D1 only (OPS-242): the site chat's daily counters, no Postgres table",
};

/** Rows per statement: one jsonb parameter holds a batch. */
export const BATCH_ROWS = 500;

/** The typed confirm alone. A wrong or missing word is refused before any call to Cloudflare or Postgres. */
export function assertConfirm(confirm) {
  if (confirm !== CONFIRM_REVERSE) {
    throw new Error(`refused: a load into Postgres needs CONFIRM set to exactly ${CONFIRM_REVERSE}`);
  }
}

/**
 * The refusals of a load, in one place: the typed confirm, a D1 export that holds at least one user
 * (an empty production D1 is the state before the cutover, and loading it would wipe Postgres), and
 * every table of the plan present in the export. Names and counts only.
 * @param {{ confirm?: string, d1Users: number, missingTables: string[] }} a
 */
export function assertReverseLoad({ confirm, d1Users, missingTables }) {
  assertConfirm(confirm);
  if (!(d1Users > 0)) throw new Error("refused: production D1 holds no users, so a load would wipe Postgres for nothing");
  if (missingTables.length > 0) throw new Error(`refused: the D1 export has no table ${missingTables.join(", ")}`);
}

/** The reasons a load would be refused, for the preflight to print. Empty when the D1 side is fine. */
export function reverseRefusals({ d1Users, missingTables }) {
  const out = [];
  if (!(d1Users > 0)) out.push("production D1 holds no users");
  if (missingTables.length > 0) out.push(`the D1 export has no table ${missingTables.join(", ")}`);
  return out;
}

const INT_RE = /^-?\d+$/;

/**
 * One D1 value (read with BigInt integers, so nothing is rounded) to the JSON value of the Postgres column.
 * Throws naming the column type and the JS type, never the value.
 * @param {string} columnType  Drizzle's `columnType` of the D1 column.
 * @param {unknown} value
 */
export function pgJsonValue(columnType, value) {
  if (value === null || value === undefined) return null;
  switch (columnType) {
    case "SQLiteTimestamp": {
      let ms;
      if (typeof value === "bigint") ms = Number(value);
      else if (typeof value === "number" && Number.isFinite(value)) ms = Math.trunc(value);
      else throw new Error(`timestamp: cannot map ${typeof value}`);
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) throw new Error("timestamp: invalid milliseconds");
      // A Postgres timestamp without time zone drops the Z and keeps the UTC reading, as the forward copy wrote it.
      return d.toISOString();
    }
    case "SQLiteBoolean": {
      if (value === 1 || value === 1n || value === "1") return true;
      if (value === 0 || value === 0n || value === "0") return false;
      throw new Error(`boolean: cannot map ${typeof value}`);
    }
    case "SQLiteInteger": {
      if (typeof value === "bigint") {
        return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
      }
      if (typeof value === "number" && Number.isInteger(value)) return value;
      if (typeof value === "string" && INT_RE.test(value)) return value;
      throw new Error(`integer: cannot map ${typeof value}`);
    }
    case "SQLiteTextJson": {
      if (typeof value !== "string") throw new Error(`json: cannot map ${typeof value}`);
      try {
        return JSON.parse(value);
      } catch {
        throw new Error("json: unparsable text");
      }
    }
    case "SQLiteText": {
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "bigint") return String(value);
      throw new Error(`text: cannot map ${typeof value}`);
    }
    default:
      throw new Error(`unknown D1 column type ${columnType}`);
  }
}

const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

/** A quoted identifier. */
export const quoteIdent = q;

/**
 * The INSERT of one batch: typed, parameterised, no value in the text. `$1` is the batch as one jsonb array.
 * Columns not listed take their Postgres default. `identity` adds OVERRIDING SYSTEM VALUE (a generated-always
 * identity column is in the list).
 * @param {string} table
 * @param {string[]} columns
 * @param {{ identity?: boolean }} [opts]
 */
export function insertSql(table, columns, { identity = false } = {}) {
  const cols = columns.map(q).join(", ");
  return `insert into public.${q(table)} (${cols})${identity ? " overriding system value" : ""} select ${cols} from jsonb_populate_recordset(null::public.${q(table)}, $1::text::jsonb)`;
}

/** `delete from public."t"`. Rows go with the triggers off, so order does not matter, but children go first anyway. */
export const reverseDeleteSql = (table) => `delete from public.${q(table)}`;

/**
 * The statement that moves an identity sequence to the largest id: the next insert without an id gets
 * a larger one. An empty table leaves the sequence at its start.
 */
export function setvalSql(table, column) {
  const t = `public.${q(table)}`;
  const c = q(column);
  return `select setval(pg_get_serial_sequence('${t.replace(/'/g, "''")}', '${column.replace(/'/g, "''")}'), coalesce(max(${c}), 1), max(${c}) is not null) as v from ${t}`;
}

/**
 * Which columns the load writes for one table, from what Postgres has and what the D1 plan has.
 *   pgColumns: [{ name, notNull, hasDefault, identity ('' | 'a' | 'd'), generated ('' | 's') }]
 *   d1Columns: [names of the plan's D1 columns]
 *   d1Only:    names that D1 has and Postgres lacks on purpose (D1_ONLY_COLUMNS)
 * Returns { write, resetToDefault, identity } or { refusal }. Names only.
 */
export function columnPlan(table, pgColumns, d1Columns, d1Only = []) {
  const pg = new Map(pgColumns.map((c) => [c.name, c]));
  const write = [];
  for (const name of d1Columns) {
    const c = pg.get(name);
    if (!c) {
      if (d1Only.includes(name)) continue;
      return { refusal: `${table}.${name} exists in D1 and not in Postgres` };
    }
    // A generated column cannot be written; Postgres computes it.
    if (c.generated) continue;
    write.push(name);
  }
  const resetToDefault = [];
  for (const c of pgColumns) {
    if (d1Columns.includes(c.name) || c.generated) continue;
    if (c.notNull && !c.hasDefault && !c.identity) {
      return { refusal: `${table}.${c.name} is NOT NULL without a default in Postgres and D1 has no such column` };
    }
    resetToDefault.push(c.name);
  }
  const identity = write.filter((n) => pg.get(n).identity);
  return { write, resetToDefault, identity };
}

/** `ok` when both sides agree, else the numbers. Names and counts only. */
export function reverseDiffLine({ table, pgCount, d1Count, onlyD1, onlyPg, changed }) {
  const same = onlyD1 === 0 && onlyPg === 0 && changed === 0;
  return `${same ? "same" : "DIFF"} ${table.padEnd(30)} postgres=${String(pgCount).padStart(7)} d1=${String(d1Count).padStart(7)} only in d1=${onlyD1} only in postgres=${onlyPg} changed=${changed}`;
}

/**
 * One line for a row that exists only in Postgres (OPS-257): the table, the key and the creation time.
 * The key is printed only when it is an id (a UUID or whole number); anything else, an email for example, is
 * never printed. No other column is read. `stamp` is epoch milliseconds, or null when the table has no time.
 */
export function pgOnlyLine({ table, key, stampName, stamp }) {
  const k = typeof key === "string" || typeof key === "number" || typeof key === "bigint" ? String(key) : "";
  const shown = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(k) || /^[0-9]{1,20}$/.test(k) ? k : "[key not shown]";
  let when = "no time column";
  if (stampName && typeof stamp === "number" && Number.isFinite(stamp)) when = `${stampName}=${new Date(stamp).toISOString()}`;
  else if (stampName) when = `${stampName}=unreadable`;
  return `pg only: ${table} ${shown} ${when}`;
}

/**
 * Compare two sides by primary key: each is a Map from key to the canonical line of the key columns.
 * Returns the counts of keys only in the first, only in the second, and in both with another line.
 */
export function compareKeyMaps(d1Map, pgMap) {
  let onlyD1 = 0;
  let changed = 0;
  for (const [k, line] of d1Map) {
    const other = pgMap.get(k);
    if (other === undefined) onlyD1++;
    else if (other !== line) changed++;
  }
  let onlyPg = 0;
  for (const k of pgMap.keys()) if (!d1Map.has(k)) onlyPg++;
  return { onlyD1, onlyPg, changed };
}

/** The line one table prints after a load's read-back. */
export function reverseReportLine({ table, pgCount, d1Count, checksumEqual }) {
  const equal = pgCount === d1Count && checksumEqual;
  return `${equal ? "ok  " : "FAIL"} ${table.padEnd(30)} postgres=${String(pgCount).padStart(7)} d1=${String(d1Count).padStart(7)} checksum equal ${checksumEqual ? "yes" : "no"}`;
}

/**
 * What a Postgres error is reduced to: its code, and the table and constraint names the driver carries.
 * Never the server's message or detail (a constraint detail quotes the failing row).
 */
export function pgErrorCode(err) {
  const code = typeof err?.code === "string" && /^[0-9A-Z]{5}$/.test(err.code) ? err.code : "no sqlstate";
  const name = (v) => (typeof v === "string" && /^[\w.]+$/.test(v) ? v : null);
  const parts = [code];
  const t = name(err?.table_name);
  const c = name(err?.constraint_name);
  if (t) parts.push(`table ${t}`);
  if (c) parts.push(`constraint ${c}`);
  return parts.join(", ");
}
