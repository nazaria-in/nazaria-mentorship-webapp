// app/not-approved/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingApprovalPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-6 dark:bg-surface">
      <div className="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center dark:border-border dark:bg-card">
        <h1 className="font-heading text-lg font-semibold text-text-primary dark:text-text-primary">
          Awaiting approval
        </h1>
        <p className="text-sm text-text-muted dark:text-text-muted">
          Your account is being reviewed. You&apos;ll be approved by a program manager soon — check back shortly.
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