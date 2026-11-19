import { d1Db, dbTarget } from "@/db";
import type { AiProvider, AiProviderKind, AiPurpose, AiRoute } from "@/db/schema/ai";
import { d1AiProviderStore } from "./ai-store-d1";
import { pgAiProviderStore } from "./ai-store-pg";

// The AI provider keys' one door to the database (OPS-166): the ai_providers
// and ai_routes tables behind Settings, AI (src/lib/ai-providers.ts) and the
// enabled-provider count on the reference page. There is one adapter per
// database, chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs).
//
// Keys are sealed by the app BEFORE they reach this store, and opened by the
// app after they leave it: the store only moves sealed text (apiKeyEnc) and
// never calls seal() or open(), so it never sees a usable key.

export type AiProviderRow = AiProvider;
export type AiRouteRow = AiRoute;

/** What a new provider row needs; the id and the dates are filled by the adapter. */
export type NewAiProvider = {
  provider: AiProviderKind;
  label: string;
  apiKeyEnc: string;
  apiKeyLast4: string;
  defaultModel: string;
  createdBy: string;
};

/** Columns an update may set. `updatedAt` is always given by the caller. */
export type AiProviderPatch = Partial<
  Pick<
    AiProviderRow,
    | "label"
    | "apiKeyEnc"
    | "apiKeyLast4"
    | "defaultModel"
    | "enabled"
    | "lastTestedAt"
    | "lastTestOk"
    | "lastTestNote"
    | "updatedAt"
  >
>;

export interface AiProviderStore {
  /** Every provider row, in no particular order (the caller sorts). */
  listProviders(): Promise<AiProviderRow[]>;
  /** The row for one vendor, or undefined when no key is stored for it. */
  providerByKind(kind: AiProviderKind): Promise<AiProviderRow | undefined>;
  /** Insert a provider and return the stored row. A second row for the same vendor fails (unique). */
  insertProvider(values: NewAiProvider): Promise<AiProviderRow>;
  /** Update one row by id and return it, or undefined when there is no such id. */
  updateProvider(id: string, patch: AiProviderPatch): Promise<AiProviderRow | undefined>;
  /** Update one row by vendor and return it, or undefined when there is none. */
  updateProviderByKind(kind: AiProviderKind, patch: AiProviderPatch): Promise<AiProviderRow | undefined>;
  /** Delete the vendor's row; routes that pointed at it are cleared (set null). Null when none. */
  deleteByKind(kind: AiProviderKind): Promise<{ id: string } | null>;
  /** The route for one purpose, or undefined when it was never set. */
  getRoute(purpose: AiPurpose): Promise<AiRouteRow | undefined>;
  /** Create the route, or on a second call replace its two providers and the time. */
  upsertRoute(
    purpose: AiPurpose,
    primaryProviderId: string | null,
    fallbackProviderId: string | null,
    updatedAt: Date,
  ): Promise<void>;
  /** How many providers are switched on. */
  countEnabled(): Promise<number>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function aiProviderStore(): AiProviderStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1AiProviderStore(client);
  }
  return pgAiProviderStore();
}
