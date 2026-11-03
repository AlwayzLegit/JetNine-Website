"use client";

import { useState } from "react";
import { PasswordField } from "./password-field";
import { PASSWORD_MIN_LENGTH, STRENGTH_WORDS, passwordStrength } from "@/lib/password-rules";

/**
 * "New password" + "Confirm" with the strength hint under the first and a
 * mismatch note under the second. Used by /auth/reset and the account's
 * Change password panel; the server action does the real validation.
 */
export function NewPasswordFields({ idPrefix, disabled }: { idPrefix: string; disabled?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const strength = password ? passwordStrength(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <>
      <PasswordField
        id={`${idPrefix}-password`}
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        disabled={disabled}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={strength === "short"}
        hint={
          strength ? (
            <span data-strength={strength}>{STRENGTH_WORDS[strength]}</span>
          ) : (
            `At least ${PASSWORD_MIN_LENGTH} characters. A few words you'll remember works well.`
          )
        }
      />
      <PasswordField
        id={`${idPrefix}-confirm`}
        name="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        disabled={disabled}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={mismatch}
        hint={mismatch ? "Those passwords don't match yet." : undefined}
      />
    </>
  );
}
