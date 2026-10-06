import { requireAdmin } from "@/lib/auth";
import { KEY_TEMPLATES, SCOPES, SCOPE_WORDS, maskedToken } from "@/lib/api-keys";
import { relativeTime } from "@/lib/request-format";
import { EXPIRY_CHOICES, legacyKeyUsage, listKeys, type KeyListRow, type LegacyKeyUsage } from "@/domain/api-keys/commands";
import { DeskRow, DotSentence } from "@/components/admin/desk-ui";
import { ApiKeysHeader, RevokeKey } from "@/components/admin/settings/api-key-forms";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" });

function state(k: KeyListRow, now: Date): { tone: "success" | "steel" | "danger" | "gold"; words: string } {
  if (k.revokedAt) return { tone: "steel", words: `Revoked ${DAY.format(k.revokedAt)}` };
  if (k.expiresAt && k.expiresAt <= now) return { tone: "steel", words: `Expired ${DAY.format(k.expiresAt)}` };
  if (k.expiresAt && k.expiresAt.getTime() - now.getTime() < 14 * 86_400_000) {
    return { tone: "gold", words: `Expires ${DAY.format(k.expiresAt)}` };
  }
  return { tone: "success", words: k.expiresAt ? `Works until ${DAY.format(k.expiresAt)}` : "Works until revoked" };
}

function scopeWords(scopes: KeyListRow["scopes"]): string {
  if (scopes.includes("admin")) return SCOPE_WORDS.admin.label;
  return scopes.map((s) => SCOPE_WORDS[s].label).join(", ");
}

export default async function ApiKeysPage() {
  await requireAdmin();
  const now = new Date();
  const [keys, legacy] = await Promise.all([listKeys(), legacyKeyUsage(now)]);
  const working = keys.filter((k) => !k.revokedAt && !(k.expiresAt && k.expiresAt <= now));
  const past = keys.filter((k) => !working.includes(k));

  return (
    <div>
      <ApiKeysHeader
        templates={KEY_TEMPLATES}
        scopes={SCOPES.map((s) => ({ scope: s, ...SCOPE_WORDS[s] }))}
        expiry={EXPIRY_CHOICES.map((c) => ({ value: c.days === null ? "never" : String(c.days), label: c.label }))}
      />

      {working.length === 0 ? (
        <p className="card bg-panel mt-6 p-6 text-[15px] text-bone-2">
          No working keys. Create one for the daily assistant or for your own scripts.
        </p>
      ) : (
        <div className="card mt-6 overflow-hidden">
          {working.map((k) => (
            <KeyRow key={k.id} k={k} now={now} />
          ))}
        </div>
      )}

      {past.length ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-[15px] text-bone-2">Revoked and expired ({past.length})</summary>
          <div className="card mt-3 overflow-hidden">
            {past.map((k) => (
              <KeyRow key={k.id} k={k} now={now} />
            ))}
          </div>
        </details>
      ) : null}

      <LegacyKeyCard usage={legacy} now={now} />

      <p className="mt-4 text-[14px] text-steel">
        A key acts as the owner who created it and can never do more than they can. Keys are shown once; we keep only a
        fingerprint. Keys that ask first can&apos;t contact clients, move money or change settings on their own. Full
        reference: <code className="text-bone-2">docs/API.md</code>.
      </p>
    </div>
  );
}

function KeyRow({ k, now }: { k: KeyListRow; now: Date }) {
  const s = state(k, now);
  const live = !k.revokedAt && !(k.expiresAt && k.expiresAt <= now);
  return (
    <DeskRow cols="md:grid-cols-[minmax(0,1fr)_260px_auto]">
      <div className="min-w-0">
        <div className="truncate text-[16px] font-medium text-bone">{k.name}</div>
        <div className="truncate font-mono text-[13px] text-steel">{maskedToken(k.prefix, k.last4)}</div>
        <div className="mt-1 text-[14px] text-bone-2">
          {scopeWords(k.scopes)}
          {k.requiresApproval ? <span className="text-steel"> · asks first</span> : null}
        </div>
        <div className="text-[14px] text-steel">
          Acts as {k.creatorName ?? "a removed teammate"} · created {DAY.format(k.createdAt)}
        </div>
        {k.revokeReason ? <div className="text-[14px] text-steel">Reason: {k.revokeReason}</div> : null}
      </div>
      <div className="text-[14px]">
        <DotSentence tone={s.tone} className="text-bone">
          {s.words}
        </DotSentence>
        <div className="mt-1 text-steel">
          {k.lastUsedAt ? `Last used ${relativeTime(k.lastUsedAt, now).toLowerCase()}${k.lastUsedIp ? ` from ${k.lastUsedIp}` : ""}` : "Never used"}
        </div>
        {k.calls24h ? (
          <div className="text-steel">
            {k.calls24h} {k.calls24h === 1 ? "call" : "calls"} today
            {k.errors24h ? <span className="text-danger"> · {k.errors24h} refused or failed</span> : null}
          </div>
        ) : null}
      </div>
      {live ? <RevokeKey id={k.id} name={k.name} /> : <span />}
    </DeskRow>
  );
}

/**
 * The old single blog key from the environment. Shown until it is removed,
 * so the owner can see the day it stops being used and retire it.
 */
function LegacyKeyCard({ usage, now }: { usage: LegacyKeyUsage; now: Date }) {
  if (!usage.configured && usage.calls30d === 0) return null;
  const used = usage.lastUsedAt ? `last used ${relativeTime(usage.lastUsedAt, now).toLowerCase()}` : "never used in the last 30 days";
  const calls = usage.calls7d ? `${usage.calls7d} ${usage.calls7d === 1 ? "call" : "calls"} in the last 7 days` : "no calls in the last 7 days";
  return (
    <div className="card bg-panel mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-medium text-bone">The old blog key</div>
          <div className="mt-1 text-[14px] text-bone-2">
            <code className="text-bone-2">BLOG_ADMIN_API_KEY</code> in Vercel · {usage.configured ? "still set" : "removed"} · {used} · {calls}
          </div>
        </div>
        <DotSentence tone={usage.retirable ? "success" : usage.configured ? "gold" : "steel"} className="text-[14px] text-bone">
          {usage.retirable ? "Safe to remove" : usage.configured ? "Still in use" : "Gone"}
        </DotSentence>
      </div>
      <p className="mt-3 text-[14px] text-steel">
        {usage.retirable
          ? "Nothing has used it for a week. Remove the variable in Vercel and delete the old Cowork task; the daily assistant runs on its own key."
          : usage.configured
            ? "The old Cowork task still posts with it. Once the daily assistant has run on its own key for a week and this shows no calls, remove the variable in Vercel."
            : "The variable is gone. The last calls above are the tail of the old task's log and will age out after 30 days."}
      </p>
    </div>
  );
}
