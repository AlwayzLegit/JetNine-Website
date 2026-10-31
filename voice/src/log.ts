// Pino-shaped logger (log.info(obj, msg)) over console, so the session and
// LLM code keep the call shape they had under Fastify. Workers Logs indexes
// the JSON lines.

type Fn = (obj: unknown, msg?: string) => void;
export type Logger = { debug: Fn; info: Fn; warn: Fn; error: Fn; child: (bindings: Record<string, unknown>) => Logger };

function serialise(obj: unknown): unknown {
  if (obj instanceof Error) return { message: obj.message, stack: obj.stack };
  if (obj && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v instanceof Error ? { message: v.message, stack: v.stack } : v]));
  }
  return obj;
}

export function makeLogger(bindings: Record<string, unknown> = {}): Logger {
  const at =
    (level: "debug" | "info" | "warn" | "error"): Fn =>
    (obj, msg) => {
      const line = JSON.stringify({ level, msg, ...bindings, ...(serialise(obj) as object) });
      console[level === "debug" ? "log" : level](line);
    };
  return {
    debug: at("debug"),
    info: at("info"),
    warn: at("warn"),
    error: at("error"),
    child: (more) => makeLogger({ ...bindings, ...more }),
  };
}

export const log = makeLogger({ service: "jetnine-voice" });
