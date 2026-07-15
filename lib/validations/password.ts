// lib/validations/password.ts
/**
 * Password policy — mirrors the Supabase Auth dashboard setting
 * (Authentication → Policies → Password requirements).
 *
 * If you change the policy in the Supabase dashboard, update this file
 * to match, or signup will pass client validation and still get
 * rejected by the server.
 */

export const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
} as const;

export interface PasswordCheck {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_CHECKS: PasswordCheck[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_RULES.minLength} characters`,
    test: (pw) => pw.length >= PASSWORD_RULES.minLength,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    id: "number",
    label: "One number",
    test: (pw) => /[0-9]/.test(pw),
  },
  {
    id: "symbol",
    label: "One symbol (!@#$%^&* etc.)",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
];

export function getPasswordStrength(password: string): {
  passed: number;
  total: number;
  isValid: boolean;
  failedChecks: PasswordCheck[];
} {
  const failedChecks = PASSWORD_CHECKS.filter((c) => !c.test(password));
  return {
    passed: PASSWORD_CHECKS.length - failedChecks.length,
    total: PASSWORD_CHECKS.length,
    isValid: failedChecks.length === 0,
    failedChecks,
  };
}

export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}