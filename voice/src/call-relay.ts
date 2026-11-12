import { DurableObject } from "cloudflare:workers";
import { CallSession, sessionFor } from "./relay/session.js";
import { log } from "./log.js";

// One CallRelay per call, addressed by CallSid (worker.ts routes
// /relay/<CallSid> here). It accepts the ConversationRelay WebSocket and
// runs the CallSession that used to live in the Fastify process. The
// socket is accepted directly (not hibernated) so the session's in-memory
// state survives the pauses between caller turns; the object stays alive
// for as long as the call does.
//
// A no-transfer call whose relay failed reconnects on the same CallSid, so
// it lands in this same object and session.ts picks up the carried
// conversation.

export class CallRelay extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("expected a WebSocket upgrade", { status: 426 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const callLog = log.child({ do: "CallRelay", id: this.ctx.id.name ?? this.ctx.id.toString() });
    const session = new CallSession(server, callLog);
    const decoder = new TextDecoder();
    server.addEventListener("message", (e) => {
      void session.handle(typeof e.data === "string" ? e.data : decoder.decode(e.data));
    });
    server.addEventListener("close", (e) => {
      callLog.info({ code: e.code, reason: String(e.reason).slice(0, 200) }, "relay: socket closed");
      try {
        server.close(1000, "closed");
      } catch {
        // Already closed.
      }
      this.ctx.waitUntil(session.onClose());
    });
    server.addEventListener("error", (e) => callLog.error({ err: String((e as ErrorEvent).message ?? e) }, "relay: socket error"));

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * /relay/action saw SessionStatus=failed: close out the live session (if
   * this object still holds it) before the caller is transferred or
   * reconnected. Returns whether a session was found, and its transfer number.
   */
  async relayFailed(
    callSid: string,
    detail: string,
    opts: { reconnecting?: boolean } = {},
  ): Promise<{ found: boolean; transferNumber?: string }> {
    const session = sessionFor(callSid);
    if (!session) return { found: false };
    await session.relayFailed(detail, opts);
    return { found: true, transferNumber: session.transferNumber };
  }
}
