import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/watchlist-unsubscribe";

// RFC 8058 one-click unsubscribe. The List-Unsubscribe header on every
// alert email points here, and Gmail and Yahoo POST to it when someone
// uses their client's own unsubscribe button.
//
// POST only, and no confirmation step: the spec requires the single POST
// to be sufficient, and providers treat anything else as a broken
// unsubscribe. That is the opposite of the confirm flow next door, and
// correctly so — this direction only ever stops mail.
//
// Always 200, even for a token we do not recognise. A provider retrying
// after a timeout must not see a failure, and an error would also tell a
// prober which tokens are real.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await unsubscribeByToken(token, "email");
  if (!result.ok) {
    // A genuine failure at our end is worth a retry from the provider.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
