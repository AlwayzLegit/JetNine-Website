// Shared by the server actions and the client hint so the two never drift.

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordStrength = "short" | "fair" | "good" | "strong";

/**
 * A simple, honest hint — not a policy. Length does most of the work;
 * mixing character classes nudges it up a notch.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return "short";
  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/\d/.test(password)) classes += 1;
  if (/[^A-Za-z0-9]/.test(password)) classes += 1;
  if (password.length >= 16 || (password.length >= 12 && classes >= 3)) return "strong";
  if (password.length >= 12 || classes >= 3) return "good";
  return "fair";
}

export const STRENGTH_WORDS: Record<PasswordStrength, string> = {
  short: `Too short — ${PASSWORD_MIN_LENGTH} characters minimum.`,
  fair: "Fair. Longer is stronger — a few words you'll remember beats symbols.",
  good: "Good.",
  strong: "Strong.",
};

/** Validate a new password + its confirmation. Returns the problem, or null. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Keep it under ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (password !== confirm) return "Those passwords don't match.";
  return null;
}
