"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AircraftCategorySlug } from "@/lib/fleet";
import type { Leg, CateringTier, GroundType } from "@/lib/quote-pricing";

export type TripType = "roundtrip" | "oneway" | "multileg";

export type CabinFlags = {
  wifi: boolean;
  attendant: boolean;
  lavatory: boolean;
  standup: boolean;
  lieflat: boolean;
  pet: boolean;
};

export type ContactMethods = {
  email: boolean;
  phone: boolean;
  sms: boolean;
};

export type Consent = {
  broker: boolean;
  contact: boolean;
  marketing: boolean;
};

export type QuoteDraft = {
  // Step 1
  tripType: TripType;
  legs: Leg[];
  pax: number;

  // Step 2
  category: AircraftCategorySlug;
  cabin: CabinFlags;
  catering: CateringTier;
  ground: GroundType;
  kids: number;
  pets: number;
  bags: number;
  notes: string;

  // Step 3
  account: "new" | "returning";
  firstName: string;
  lastName: string;
  email: string;
  phoneCountry: string;
  phone: string;
  company: string;
  methods: ContactMethods;
  bestTime: "any" | "morning" | "midday" | "afternoon" | "evening" | "latenight";
  source: string | null;
  consent: Consent;

  // Meta
  savedAt: number | null;
  submittedRef: string | null;
  // Client-generated idempotency token, set on the review step before the
  // first submit. Lets the server short-circuit retries (network drops,
  // double-clicks) to the existing quote row instead of inserting a dupe.
  clientIdempotencyKey: string | null;
};

// Client-only — only called from event handlers, never during SSR.
function newLegId(): string {
  return `leg-${Math.random().toString(36).slice(2, 9)}`;
}

export function isoDateAheadDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeDefaultDraft(): QuoteDraft {
  // IMPORTANT: any value here must be deterministic across SSR/CSR. Date.now()
  // and Math.random() break hydration. Real defaults (dates, random ids) are
  // applied client-side via the wizard's onMount effect.
  return {
    tripType: "roundtrip",
    legs: [
      { id: "leg-1", time: "09:00" },
      { id: "leg-2", time: "17:00" },
    ],
    pax: 4,

    category: "midsize",
    cabin: { wifi: true, attendant: false, lavatory: true, standup: false, lieflat: false, pet: false },
    catering: "standard",
    ground: "sedan",
    kids: 0,
    pets: 0,
    bags: 0,
    notes: "",

    account: "new",
    firstName: "",
    lastName: "",
    email: "",
    phoneCountry: "+1",
    phone: "",
    company: "",
    methods: { email: true, phone: true, sms: false },
    bestTime: "any",
    source: null,
    consent: { broker: false, contact: false, marketing: false },

    savedAt: null,
    submittedRef: null,
    clientIdempotencyKey: null,
  };
}

// Generate-once helper. Called from the review step before submit. Uses
// crypto.randomUUID when available, falls back to Math.random for ancient
// browsers (which shouldn't reach the wizard anyway).
export function ensureIdempotencyKey(): string {
  const existing = useQuoteStore.getState().clientIdempotencyKey;
  if (existing) return existing;
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `jn-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  useQuoteStore.setState({ clientIdempotencyKey: key, savedAt: Date.now() });
  return key;
}

type QuoteActions = {
  // Mutators
  setTripType: (t: TripType) => void;
  setPax: (n: number) => void;
  updateLeg: (id: string, patch: Partial<Leg>) => void;
  addLeg: () => void;
  removeLeg: (id: string) => void;
  swapLeg: (id: string) => void;

  setCategory: (c: AircraftCategorySlug) => void;
  toggleCabin: (k: keyof CabinFlags) => void;
  setCatering: (c: CateringTier) => void;
  setGround: (g: GroundType) => void;
  setExtra: (k: "kids" | "pets" | "bags", n: number) => void;
  setNotes: (s: string) => void;

  setAccount: (a: "new" | "returning") => void;
  setContactField: <K extends keyof QuoteDraft>(k: K, v: QuoteDraft[K]) => void;
  toggleMethod: (k: keyof ContactMethods) => void;
  setBestTime: (t: QuoteDraft["bestTime"]) => void;
  setSource: (s: string | null) => void;
  toggleConsent: (k: keyof Consent) => void;

  submit: () => string;
  reset: () => void;

  // Selectors handled separately via component-level recompute.
};

export const useQuoteStore = create<QuoteDraft & QuoteActions>()(
  persist(
    (set, get) => ({
      ...makeDefaultDraft(),

      setTripType: (t) =>
        set((s) => {
          let legs = s.legs;
          if (t === "oneway") legs = legs.slice(0, 1);
          else if (t === "roundtrip" && legs.length < 2) {
            const a = legs[0];
            legs = [
              a,
              {
                id: newLegId(),
                fromIata: a.toIata,
                toIata: a.fromIata,
                fromCity: a.toCity,
                toCity: a.fromCity,
                fromName: a.toName,
                toName: a.fromName,
                distanceNm: a.distanceNm,
                date: isoDateAheadDays(18),
                time: "17:00",
              },
            ];
          }
          return { tripType: t, legs, savedAt: Date.now() };
        }),

      setPax: (n) => set({ pax: Math.max(1, Math.min(16, Math.round(n))), savedAt: Date.now() }),

      updateLeg: (id, patch) =>
        set((s) => ({
          legs: s.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          savedAt: Date.now(),
        })),

      addLeg: () =>
        set((s) => ({
          tripType: "multileg",
          legs: [
            ...s.legs,
            { id: newLegId(), date: isoDateAheadDays(20 + s.legs.length * 2), time: "10:00" },
          ],
          savedAt: Date.now(),
        })),

      removeLeg: (id) =>
        set((s) => ({
          legs: s.legs.length > 1 ? s.legs.filter((l) => l.id !== id) : s.legs,
          savedAt: Date.now(),
        })),

      swapLeg: (id) =>
        set((s) => ({
          legs: s.legs.map((l) =>
            l.id === id
              ? {
                  ...l,
                  fromIata: l.toIata,
                  toIata: l.fromIata,
                  fromCity: l.toCity,
                  toCity: l.fromCity,
                  fromName: l.toName,
                  toName: l.fromName,
                }
              : l,
          ),
          savedAt: Date.now(),
        })),

      setCategory: (c) => set({ category: c, savedAt: Date.now() }),
      toggleCabin: (k) =>
        set((s) => ({ cabin: { ...s.cabin, [k]: !s.cabin[k] }, savedAt: Date.now() })),
      setCatering: (c) => set({ catering: c, savedAt: Date.now() }),
      setGround: (g) => set({ ground: g, savedAt: Date.now() }),
      setExtra: (k, n) => set({ [k]: Math.max(0, Math.round(n)), savedAt: Date.now() } as Partial<QuoteDraft>),
      setNotes: (s) => set({ notes: s.slice(0, 800), savedAt: Date.now() }),

      setAccount: (a) => set({ account: a, savedAt: Date.now() }),
      setContactField: (k, v) => set({ [k]: v, savedAt: Date.now() } as Partial<QuoteDraft>),
      toggleMethod: (k) =>
        set((s) => ({ methods: { ...s.methods, [k]: !s.methods[k] }, savedAt: Date.now() })),
      setBestTime: (t) => set({ bestTime: t, savedAt: Date.now() }),
      setSource: (s) => set({ source: s, savedAt: Date.now() }),
      toggleConsent: (k) =>
        set((s) => ({ consent: { ...s.consent, [k]: !s.consent[k] }, savedAt: Date.now() })),

      submit: () => {
        const ref = `JN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
        set({ submittedRef: ref, savedAt: Date.now() });
        return ref;
      },

      reset: () => set({ ...makeDefaultDraft() }),
    }),
    {
      name: "jn_quote_draft_v1",
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      // Skip auto-hydration on mount; the wizard layout calls
      // useQuoteStore.persist.rehydrate() after a useEffect tick.
      // This eliminates the SSR/CSR mismatch window.
      skipHydration: true,
    },
  ),
);

// Helper: SSR-safe "is this step's prerequisites satisfied?"
export function isMissionComplete(s: QuoteDraft): boolean {
  return s.legs.every((l) => l.fromIata && l.toIata && l.date && l.time) && s.pax >= 1;
}

export function isAircraftComplete(s: QuoteDraft): boolean {
  return Boolean(s.category && s.catering && s.ground);
}

export function isContactComplete(s: QuoteDraft): boolean {
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email);
  const hasPhone = s.phone.replace(/\D/g, "").length >= 7;
  const hasMethod = s.methods.email || s.methods.phone || s.methods.sms;
  return (
    s.firstName.trim().length > 0 &&
    s.lastName.trim().length > 0 &&
    validEmail &&
    hasPhone &&
    hasMethod &&
    s.consent.broker &&
    s.consent.contact
  );
}
