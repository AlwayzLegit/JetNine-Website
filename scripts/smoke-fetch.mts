/**
 * Reads for the production smoke runner (scripts/smoke-prod.mts), kept apart
 * so the retry rule can be tested without a network (OPS-104).
 *
 * A transport error is a read that never produced a complete answer: the
 * connection was reset or closed, the body was cut off mid-stream, or the
 * timeout fired. It is the only kind of failure a read is retried for, and
 * only GET and HEAD. A wrong status, a wrong redirect, a missing string or a
 * wrong header is a wrong answer and fails at once.
 *
 * Every first failure is reported through `onRetry`, so a real cut-off for
 * visitors is never hidden by the retry: a retry is a warning to look at.
 */

export type Reply = { status: number; headers: Headers; text: string };
export type Served = { ray: string; cache: string };

export class TransportError extends Error {
  readonly url: string;
  readonly elapsedMs: number;
  constructor(url: string, err: unknown, elapsedMs: number, phase: "request" | "body", timeoutMs: number) {
    super(`${phase} failed: ${describeError(err, timeoutMs)} after ${elapsedMs}ms`);
    this.name = "TransportError";
    this.url = url;
    this.elapsedMs = elapsedMs;
  }
}

// undici puts the real reason (UND_ERR_SOCKET, ECONNRESET, ...) in err.cause;
// the top level message is only "fetch failed".
export function describeError(err: unknown, timeoutMs: number): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const parts = [err.name === "AbortError" ? `timeout after ${timeoutMs}ms (aborted)` : err.message];
  const detail = [cause?.code, cause?.message].filter(Boolean).join(" ");
  if (detail) parts.push(`cause ${detail}`);
  return parts.join(", ");
}

export type ReaderOptions = {
  timeoutMs: number;
  retryDelayMs: number;
  headers?: Record<string, string>;
  onRetry?: (url: string, err: TransportError, served: Served | undefined) => void;
  sleep?: (ms: number) => Promise<unknown>;
  fetchImpl?: typeof fetch;
};

export function createReader(opts: ReaderOptions) {
  const doFetch = opts.fetchImpl ?? fetch;
  const wait = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  // The data centre and cache state of the latest response, so a failure
  // names where it was served. cf-ray ends in the data centre code.
  let served: Served | undefined;

  async function once(url: string, init?: RequestInit): Promise<Reply> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    const t0 = Date.now();
    try {
      let res: Response;
      try {
        res = await doFetch(url, {
          ...init,
          signal: ctrl.signal,
          headers: { ...opts.headers, ...(init?.headers as Record<string, string> | undefined) },
        });
      } catch (err) {
        throw new TransportError(url, err, Date.now() - t0, "request", opts.timeoutMs);
      }
      served = { ray: res.headers.get("cf-ray") ?? "", cache: res.headers.get("x-edge-cache") ?? "" };
      let text: string;
      try {
        text = await res.text();
      } catch (err) {
        // A body cut off mid-stream is a transport error, not an empty page.
        throw new TransportError(url, err, Date.now() - t0, "body", opts.timeoutMs);
      }
      return { status: res.status, headers: res.headers, text };
    } finally {
      clearTimeout(t);
    }
  }

  async function read(url: string, init?: RequestInit): Promise<Reply> {
    const method = (init?.method ?? "GET").toUpperCase();
    const retryable = method === "GET" || method === "HEAD";
    try {
      return await once(url, init);
    } catch (err) {
      if (!(err instanceof TransportError) || !retryable) throw err;
      opts.onRetry?.(url, err, served);
      await wait(opts.retryDelayMs);
      return await once(url, init);
    }
  }

  return {
    read,
    resetServed: () => {
      served = undefined;
    },
    servedNote: () => {
      if (!served) return "";
      const bits = [served.ray && `cf-ray ${served.ray}`, served.cache && `edge-cache ${served.cache}`];
      return ` [${bits.filter(Boolean).join(", ")}]`;
    },
  };
}
