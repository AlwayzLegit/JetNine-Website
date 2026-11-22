// Classifying a model provider's failure (OPS-235).
//
// Some failures will not clear within a call: the key is wrong or revoked
// (401), it may not use the model (403), or the account has no credit left
// (Anthropic answers 400 invalid_request_error "credit balance is too low";
// OpenAI answers 429 insufficient_quota). Retrying the turn only makes the
// caller repeat themselves into a model that cannot answer, so the session
// passes the call to a person at the first such failure. A 429 rate limit or
// a 5xx is still treated as transient.
//
// Only the status code and the provider name are carried on the marked
// error and logged. Nothing here reads, stores or prints a key.

export type ProviderName = "anthropic" | "openai";

export type MarkedProviderError = Error & {
  unrecoverable: true;
  provider: ProviderName;
  /** HTTP status the provider answered, when it answered. */
  providerStatus?: number;
};

type ErrorLike = {
  status?: unknown;
  code?: unknown;
  type?: unknown;
  message?: unknown;
  error?: unknown;
};

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** True when retrying the same call to this provider cannot help. */
export function isUnrecoverableProviderError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as ErrorLike;
  const status = typeof e.status === "number" ? e.status : undefined;
  if (status === 401 || status === 403) return true;

  const body = e.error && typeof e.error === "object" ? (e.error as ErrorLike) : undefined;
  const inner = body?.error && typeof body.error === "object" ? (body.error as ErrorLike) : undefined;
  const words = [e.message, body?.message, inner?.message].map(text).join(" ");
  const codes = [e.code, e.type, body?.code, body?.type, inner?.code, inner?.type].map(text);

  // OpenAI: out of quota is a 429 with its own code, unlike a rate limit.
  if (codes.includes("insufficient_quota")) return true;
  // Anthropic: a 400 whose message names the credit balance or billing.
  if (status === 400 && /credit balance|billing/i.test(words)) return true;
  return false;
}

/** Marks the error when it is unrecoverable; returns it unchanged otherwise. */
export function classifyProviderError(err: unknown, provider: ProviderName): unknown {
  if (!isUnrecoverableProviderError(err)) return err;
  const marked = (err instanceof Error ? err : new Error(String(err))) as Partial<MarkedProviderError> & Error;
  marked.unrecoverable = true;
  marked.provider = provider;
  const status = (err as ErrorLike).status;
  if (typeof status === "number") marked.providerStatus = status;
  return marked;
}

export function isMarkedUnrecoverable(err: unknown): err is MarkedProviderError {
  return !!err && typeof err === "object" && (err as { unrecoverable?: unknown }).unrecoverable === true;
}
