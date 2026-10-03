import { BLOG_OPS } from "@/domain/blog/ops";
import { REQUEST_OPS } from "@/domain/requests/ops";
import { TRIP_OPS } from "@/domain/trips/ops";
import type { OpDef } from "./registry";

/**
 * Every operation, by id. Approvals look ops up here when a person
 * approves; routes and Server Actions import the op they need directly.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyOp = OpDef<any, any>;

const ALL: AnyOp[] = [...REQUEST_OPS, ...TRIP_OPS, ...BLOG_OPS];

const byId = new Map<string, AnyOp>();
for (const op of ALL) {
  if (byId.has(op.id)) throw new Error(`Duplicate op id: ${op.id}`);
  byId.set(op.id, op);
}

export function getOp(id: string): AnyOp | undefined {
  return byId.get(id);
}

export function listOps(): AnyOp[] {
  return ALL;
}
