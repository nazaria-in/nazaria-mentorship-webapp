// components/auth/forgot-password-form.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api/auth";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 dark:bg-white/5 dark:border-white/10";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send reset email. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <h1 className="text-lg font-heading text-text-primary">Check your email</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          If an account exists for <span className="text-text-primary">{email.trim()}</span>, we
          sent a link to reset your password.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-block text-sm font-medium text-text-accent hover:underline"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none"
    >
      <h1 className="text-lg font-heading text-text-primary">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <div className="mt-7">
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
          Email
        </label>
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
        {submitting ? "Sending…" : "Send reset link"}
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/auth/login" className="font-medium text-text-accent hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}