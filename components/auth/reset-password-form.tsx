// components/auth/reset-password-form.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updatePassword } from "@/lib/api/auth";
import { PasswordInput } from "./passwordInput";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { PasswordMismatchHint } from "./PasswordMismatchHint";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });

    // In case PASSWORD_RECOVERY already fired before this component mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      }
    });

    // If no session shows up after a few seconds, the link was likely
    // missing/expired/already used — tell the user instead of hanging.
    const timeout = setTimeout(() => {
      setSessionReady((ready) => {
        if (!ready) setLinkInvalid(true);
        return ready;
      });
    }, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const canSubmit =
    sessionReady && password.length >= 8 && password === confirmPassword && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => router.replace("/auth/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset password. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <h1 className="text-lg font-heading text-text-primary">Password updated</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Redirecting you to login…</p>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <h1 className="text-lg font-heading text-text-primary">Link expired or invalid</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This password reset link is no longer valid. Request a new one from the login page.
        </p>
      </div>
    );
  }

  // PasswordInput has no disabled prop, so while we wait for the recovery
  // session we don't render the real inputs at all — just a placeholder —
  // to avoid letting the user type into fields that can't submit yet.
  if (!sessionReady) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none">
        <h1 className="text-lg font-heading text-text-primary">Set a new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Verifying your reset link…</p>

        <div className="mt-7 space-y-5">
          <div className="h-[42px] animate-pulse rounded-lg bg-card-alt" />
          <div className="h-[42px] animate-pulse rounded-lg bg-card-alt" />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm dark:shadow-none"
    >
      <h1 className="text-lg font-heading text-text-primary">Set a new password</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choose a new password for your account.
      </p>

      <div className="mt-7 space-y-5">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-text-primary">
            New password
          </label>
          <PasswordInput
            id="new-password"
            name="new-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-text-primary">
            Confirm password
          </label>
          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
          <PasswordMismatchHint password={password} confirmPassword={confirmPassword} />
        </div>
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
        {submitting ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}