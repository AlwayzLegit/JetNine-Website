import type { RunOutcome } from "@/domain/ops/registry";
import { ok, type Result } from "@/domain/result";
import type { RouteOutput } from "./handler";

/** Turn an op outcome into a route output: 200/201 with data, or 202 pending. */
export function opRouteOutput(outcome: RunOutcome, status?: number): Result<RouteOutput> {
  if (!outcome.ok) return outcome;
  if (outcome.value.kind === "pending") return ok({ data: null, pending: outcome.value.pending });
  return ok({ data: outcome.value.value, status });
}
