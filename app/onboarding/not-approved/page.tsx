// app/onboarding/not-approved/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CheckState = "checking" | "pending" | "error";

export default function PendingApprovalPage() {
  const router = useRouter();
  const [checkState, setCheckState] = useState<CheckState>("checking");

  // On mount, re-check this user's current approval_status. If a PM has
  // approved them since they last loaded this page (they were just told
  // to "check back shortly"), send them straight to the dashboard instead
  // of making them refresh manually.
  useEffect(() => {
    const controller = new AbortController();
    const supabase = createClient();

    async function checkApprovalStatus(): Promise<void> {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!controller.signal.aborted) router.push("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("approval_status")
        .eq("id", user.id)
        .single();

      if (controller.signal.aborted) return;

      if (error || !data) {
        setCheckState("error");
        return;
      }

      if (data.approval_status === "approved") {
        router.push("/dashboard");
        return;
      }

      setCheckState("pending");
    }

    void checkApprovalStatus();

    return () => controller.abort();
  }, [router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 dark:bg-surface">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center dark:border-border dark:bg-card">
        <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">
          {checkState === "checking" ? "Checking your status…" : "Awaiting approval"}
        </h1>
        <p className="text-sm text-text-muted dark:text-text-muted">
          {checkState === "error"
            ? "We couldn't check your approval status just now. Try refreshing, or sign out and back in."
            : "Your account is being reviewed. You'll be approved by a program manager soon — check back shortly."}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted dark:border-border dark:text-text-primary dark:hover:bg-white/5"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}