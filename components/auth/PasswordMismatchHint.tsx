// components/shared/PasswordMismatchHint.tsx
"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface PasswordMismatchHintProps {
  password: string;
  confirmPassword: string;
}

/**
 * Debounced inline message under the confirm-password field. Never disables
 * submit — the signup form's own submit handler must still validate the
 * match before calling the API. This is a UX hint only, not the source of
 * truth for validation.
 */
export function PasswordMismatchHint({
  password,
  confirmPassword,
}: PasswordMismatchHintProps) {
  const debouncedConfirm = useDebouncedValue(confirmPassword, 800);

  const showMismatch =
    debouncedConfirm.length > 0 && debouncedConfirm !== password;

  if (!showMismatch) return null;

  return (
    <p className="mt-1.5 text-xs text-destructive">Passwords don&apos;t match.</p>
  );
}