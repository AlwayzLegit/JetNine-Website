import { d1Db, dbTarget } from "@/db";
import type { Aircraft, NewAircraft } from "@/db/schema/aircraft";
import type { Airport, Fbo, NewAirport, NewFbo } from "@/db/schema/airports";
import type { NewOperator, NewOperatorContact, Operator, OperatorContact } from "@/db/schema/operators";
import { d1ReferenceStore } from "./store-d1";
import { pgReferenceStore } from "./store-pg";

// The reference domain's one door to the database (OPS-112): operators,
// operator contacts, aircraft, airports and FBOs. Every query on those five
// tables goes through a ReferenceStore. There is one adapter per database,
// chosen per request by dbTarget(): Postgres until the move, D1 where
// DB_TARGET is "d1" (staging first; the code refuses "d1" in production, see
// src/db/target.mjs). Return types are the existing Postgres row types, so
// callers do not change. Schedule blocks and trips stay on Postgres: they
// belong to the trips domain, the last row of the move.

// ── operators ──
export type OperatorRow = {
  id: string;
  name: string;
  certNumber: string | null;
  homeAirportIcao: string | null;
  yearsPartner: number | null;
  isPreferred: boolean;
  status: Operator["status"];
  argusRating: Operator["argusRating"];
  wyvernWingman: boolean;
  isbaoStage: number | null;
  nextAuditOn: string | null;
  insuranceRenewsOn: string | null;
  suspendedReason: string | null;
};
export type OperatorRef = { id: string; name: string; certNumber: string | null };
export type ContactRef = { id: string; name: string; role: string | null; isEscalation: boolean };

// ── aircraft ──
export type AircraftListRow = {
  id: string;
  tailNumber: string;
  operatorId: string;
  operatorName: string;
  category: Aircraft["category"];
  makeModel: string;
  yearManufactured: number | null;
  seats: number;
  rangeNm: number;
  speedKt: number;
  wifiType: Aircraft["wifiType"];
  standupCabin: boolean;
  lieflatCapable: boolean;
  petFriendly: boolean;
  baseIcao: string | null;
  totalHours: number | null;
  status: Aircraft["status"];
};

/** The aircraft detail page's row: the aircraft joined to its operator. */
export type AircraftDetailRow = Omit<AircraftListRow, "operatorName"> & {
  cabinHeightIn: number | null;
  lavatoryEnclosed: boolean;
  flightAttendantStandard: boolean;
  lastCCheckOn: string | null;
  createdAt: Date;
  operatorName: string;
  operatorCertNumber: string | null;
  operatorStatus: Operator["status"];
  operatorArgus: Operator["argusRating"];
  operatorWyvern: boolean;
  operatorIsPreferred: boolean;
};

export type FleetBoardRow = {
  id: string;
  tailNumber: string;
  makeModel: string;
  category: Aircraft["category"];
  seats: number;
  status: Aircraft["status"];
  operatorName: string;
  isPreferred: boolean;
};

// ── airports ──
export type AirportRow = {
  id: string;
  icao: string;
  iata: string | null;
  name: string;
  city: string;
  region: string | null;
  countryIso2: string;
  category: string | null;
  customs: Airport["customs"];
  active: boolean;
  fboCount: number;
};
export type AirportRef = { id: string; icao: string; name: string };
export type FboRef = { id: string; name: string; isPrimary: boolean; isPreferred: boolean };
export type FboFlag = "isPrimary" | "isPreferred";

export type ReferenceTableCounts = { operators: number; aircraft: number; airports: number; fbos: number };

export interface ReferenceStore {
  // ── operators ──
  /** Every operator, preferred first, then by name without regard to case. */
  operatorRows(): Promise<OperatorRow[]>;
  /** Aircraft count per operator (operators with none are absent). */
  fleetCounts(): Promise<{ operatorId: string; n: number }[]>;
  /** Operators we may source from (not suspended, banned or on hold), by name. */
  sourcingOperators(): Promise<{ id: string; name: string }[]>;
  /** The sourcing-eligible operators plus `currentId` whatever its status, by name. */
  operatorOptions(currentId: string): Promise<{ id: string; name: string }[]>;
  operatorById(id: string): Promise<Operator | undefined>;
  operatorRef(id: string): Promise<OperatorRef | undefined>;
  /** The id and name of an operator, for the aircraft forms. */
  operatorName(id: string): Promise<{ id: string; name: string } | undefined>;
  operatorExists(id: string): Promise<boolean>;
  operatorIdByCert(certNumber: string): Promise<{ id: string } | undefined>;
  insertOperator(values: NewOperator): Promise<{ id: string; name: string }>;
  updateOperator(id: string, values: NewOperator): Promise<void>;
  contactsOf(operatorId: string): Promise<OperatorContact[]>;
  contactOf(operatorId: string, contactId: string): Promise<ContactRef | undefined>;
  insertContact(values: NewOperatorContact): Promise<{ id: string }>;
  deleteContact(id: string): Promise<void>;
  setContactEscalation(id: string, isEscalation: boolean): Promise<void>;

  // ── aircraft ──
  /** Every aircraft with its operator, by category then tail. */
  aircraftRows(): Promise<AircraftListRow[]>;
  aircraftById(id: string): Promise<Aircraft | undefined>;
  aircraftDetail(id: string): Promise<AircraftDetailRow | undefined>;
  /** An aircraft with this tail, ignoring `exceptId` when given. */
  aircraftIdByTail(tailNumber: string, exceptId?: string): Promise<{ id: string } | undefined>;
  insertAircraft(values: NewAircraft): Promise<{ id: string; tailNumber: string }>;
  updateAircraft(id: string, values: NewAircraft): Promise<void>;
  /** One operator's aircraft, by category then tail. */
  fleetOf(operatorId: string): Promise<Aircraft[]>;
  /** Every aircraft for the ops board, by category then tail. */
  fleetBoard(): Promise<FleetBoardRow[]>;

  // ── airports and FBOs ──
  /** Every airport with its FBO count, by country then ICAO. */
  airportRows(): Promise<AirportRow[]>;
  fboTotal(): Promise<number>;
  airportById(id: string): Promise<Airport | undefined>;
  airportRef(id: string): Promise<AirportRef | undefined>;
  /** An airport with this ICAO, ignoring `exceptId` when given. */
  airportIdByIcao(icao: string, exceptId?: string): Promise<{ id: string } | undefined>;
  insertAirport(values: NewAirport): Promise<{ id: string; icao: string }>;
  updateAirport(id: string, values: NewAirport): Promise<void>;
  /** Deletes the airport; its FBOs go with it (cascade). */
  deleteAirport(id: string): Promise<void>;
  /** An airport's FBOs, by name without regard to case. */
  fbosOf(airportId: string): Promise<Fbo[]>;
  fboOf(airportId: string, fboId: string): Promise<FboRef | undefined>;
  insertFbo(values: NewFbo): Promise<{ id: string }>;
  deleteFbo(id: string): Promise<void>;
  setFboFlag(id: string, field: FboFlag, value: boolean): Promise<void>;
  /** Clears isPrimary on every other FBO of the airport. */
  demoteOtherPrimaries(airportId: string, exceptFboId: string): Promise<void>;

  // ── counts ──
  counts(): Promise<ReferenceTableCounts>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function referenceStore(): ReferenceStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1ReferenceStore(client);
  }
  return pgReferenceStore();
}
