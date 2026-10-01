import type { ContactMethods, Consent, QuoteDraft } from "@/lib/quote-store";

// Option lists shared by the contact step (inputs) and the review step
// (labels). Kept verbatim from the previous contact page.

export const COUNTRIES = [
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
  { code: "+33", flag: "🇫🇷" },
  { code: "+41", flag: "🇨🇭" },
  { code: "+49", flag: "🇩🇪" },
  { code: "+971", flag: "🇦🇪" },
  { code: "+81", flag: "🇯🇵" },
  { code: "+65", flag: "🇸🇬" },
  { code: "+52", flag: "🇲🇽" },
] as const;

export const BEST_TIMES: { id: QuoteDraft["bestTime"]; label: string }[] = [
  { id: "any", label: "Any time" },
  { id: "morning", label: "Morning · 6–11" },
  { id: "midday", label: "Midday · 11–2" },
  { id: "afternoon", label: "Afternoon · 2–6" },
  { id: "evening", label: "Evening · 6–10" },
  { id: "latenight", label: "After 10" },
];

export function bestTimeLabel(id: QuoteDraft["bestTime"]): string {
  return BEST_TIMES.find((t) => t.id === id)?.label ?? "Any time";
}

export const SOURCES = [
  "Referred by a friend",
  "Search",
  "Social",
  "Press / article",
  "Saw a JetNine aircraft",
  "Other",
] as const;

export const CONTACT_METHODS: { k: keyof ContactMethods; name: string; desc: string; short: string }[] = [
  { k: "email", name: "Email", desc: "Quote PDF + itinerary link", short: "Email" },
  { k: "phone", name: "Phone call", desc: "Live walkthrough with dispatch", short: "Phone" },
  { k: "sms", name: "SMS", desc: "Real-time updates en-route", short: "SMS" },
];

export function methodSummary(m: ContactMethods): string {
  return (
    CONTACT_METHODS.filter((c) => m[c.k])
      .map((c) => c.short)
      .join(" + ") || "—"
  );
}

export const CONSENTS: { k: keyof Consent; required: boolean; sub: string }[] = [
  {
    k: "broker",
    required: true,
    sub: "JetNine acts as an indirect air carrier; flights are operated by FAA Part 135 certified carriers.",
  },
  {
    k: "contact",
    required: true,
    sub: "Quote-specific only. Marketing consent is separate, below.",
  },
  {
    k: "marketing",
    required: false,
    sub: "Unsubscribe any time. We never share your information.",
  },
];
