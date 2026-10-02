import { requireAdmin } from "@/lib/auth";
import { KEY_TEMPLATES, SCOPES, SCOPE_WORDS, maskedToken } from "@/lib/api-keys";
import { relativeTime } from "@/lib/request-format";
import { EXPIRY_CHOICES, listKeys, type KeyListRow } from "@/domain/api-keys/commands";
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
  const keys = await listKeys();
  const now = new Date();
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
        <p className="card mt-6 p-6 text-[15px] text-bone-2">
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
