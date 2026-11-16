// Who a desk alert goes to (OPS-103). Pure, no imports, so `node --test`
// can load it (same pattern as src/lib/session/core.mjs).
//
// The shared dispatch inbox is always in the list, first: a page never
// depends on a preference read. Staff whose "A new request comes in" toggle
// is on are added after it, never in its place.

/**
 * Every incoming submission or message from outside (quote request, contact
 * form, guides lead, voicemail, text, email reply) pages the staff whose
 * "A new request comes in" setting is on. It is the one notification kind in
 * Settings, Notifications that stands for "something new reached the desk".
 */
export const DESK_ALERT_KIND = "newRequest";

/**
 * @param {string} inbox  The shared dispatch inbox address.
 * @param {string[] | undefined} extra  Staff addresses (from the database).
 * @returns {string | string[]} The inbox alone as a string when nobody else
 *   is added, else an array with the inbox first.
 */
export function mergeDeskRecipients(inbox, extra) {
  const base = String(inbox ?? "").trim();
  const baseKey = base.toLowerCase();
  const seen = new Set([baseKey]);
  const added = [];
  for (const raw of extra ?? []) {
    const a = String(raw ?? "").trim().toLowerCase();
    if (!a || !a.includes("@") || seen.has(a)) continue;
    seen.add(a);
    added.push(a);
  }
  return added.length === 0 ? base : [base, ...added];
}
