/**
 * Normalize a freeform phone string + country dial code into E.164
 * (`+CCXXXXXXXXXX`). Strips parentheses, spaces, dashes, dots.
 *
 * The quote-wizard form binds the phone field to whatever the user
 * typed (national format like "(818) 800-5678") and keeps the country
 * dial code in a separate field. Naive concatenation produces invalid
 * E.164 like "+1(818) 800-5678", which Twilio rejects with error
 * 21211. This helper canonicalizes both inputs into a Twilio-valid
 * shape so downstream callers (postQuoteMessage SMS, sendTripStatusSms,
 * etc.) don't have to repeat the cleanup.
 *
 * Returns null on inputs that can't be salvaged (no digits, country
 * code without leading +, etc.) — caller decides whether to surface
 * an error or skip the channel.
 */
export function toE164(phone: string | null | undefined, countryCode: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  if (digits.length === 0) return null;

  // Country code from the wizard is something like "+1" or "+44" or
  // (legacy) "1". Coerce to digits and ensure it's 1-3 digits.
  const ccDigits = (countryCode ?? "").replace(/\D+/g, "");
  if (ccDigits.length === 0 || ccDigits.length > 3) {
    // Caller didn't supply a usable country code. If the phone digits
    // already look like a full international number (11+ digits for
    // US/CA, longer for others), accept and prefix +. Otherwise reject.
    if (digits.length < 10) return null;
    return `+${digits}`;
  }

  // If the user typed the country code as part of the phone, don't
  // double-prefix. E.g. cc="+1", phone="+1 (818) 800-5678" → digits
  // already starts with "1" — strip it before prepending the cc.
  const trimmedDigits = digits.startsWith(ccDigits) ? digits.slice(ccDigits.length) : digits;
  if (trimmedDigits.length < 7) return null; // shortest valid subscriber number ~ 7 digits
  return `+${ccDigits}${trimmedDigits}`;
}

/**
 * Validate that a string is in E.164 shape. Cheap regex — Twilio does
 * the authoritative check, but this lets us fail fast before issuing
 * the SMS and stamping a `messages` row with `delivery_status='queued'`
 * that will then flip to `failed` for a totally avoidable reason.
 */
/**
 * E.164 from a single freeform field with no country selector.
 *
 * The empty-leg watchlist form is one box, so the country has to come
 * from the number itself. A leading + is taken at face value. Without
 * one the number is assumed NANP, because that is the market this desk
 * serves and because the alternative is actively dangerous: toE164()
 * with no country code turns the ten digits of a US number into
 * +4155551234, a Swiss number, and we would text a stranger in Zurich.
 *
 * Anything matching neither shape returns null so the caller can ask for
 * the country code rather than guess.
 *
 * The residual ambiguity is real and unavoidable in a single field: ten
 * bare digits could be a US number or a foreign one with the country
 * code left off, and "20 7946 0958" (London) becomes +12079460958
 * (Maine). Defaulting to NANP is the right trade for a US desk, but it
 * is why the form tells international users to include the country code
 * rather than leaving them to find out by not being texted.
 */
export function normalizeFreeformE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 0) return null;

  if (trimmed.startsWith("+")) {
    const candidate = `+${digits}`;
    return isE164(candidate) ? candidate : null;
  }
  // Bare NANP: ten digits, or eleven with the country code already on.
  if (digits.length === 10) {
    const candidate = `+1${digits}`;
    return isE164(candidate) ? candidate : null;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    const candidate = `+${digits}`;
    return isE164(candidate) ? candidate : null;
  }
  return null;
}

export function isE164(s: string | null | undefined): s is string {
  return typeof s === "string" && /^\+[1-9]\d{6,14}$/.test(s);
}
