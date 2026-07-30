// components/auth/signup-form.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/api/auth";
import { getPasswordStrength, passwordsMatch } from "@/lib/validations/password";

import { PasswordStrengthMeter } from "./password-strength-meter";
import { PasswordInput } from "./passwordInput";
import { PasswordMismatchHint } from "./PasswordMismatchHint";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10";

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isValid: passwordValid } = getPasswordStrength(password);
  const matchOk = passwordsMatch(password, confirmPassword);

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordValid &&
    matchOk &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });

      router.push("/onboarding/role");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none"
    >
      <h1 className="text-lg font-heading text-text-primary">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Join the Nazaria community.</p>

      <div className="mt-7 space-y-5">
        <Field label="Full name" htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Priya Sharma"
            required
          />
        </Field>

        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            required
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
          <PasswordStrengthMeter password={password} />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
          <PasswordMismatchHint password={password} confirmPassword={confirmPassword} />
        </Field>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/15">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-7 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Sign up"}
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
    </div>
  );
}