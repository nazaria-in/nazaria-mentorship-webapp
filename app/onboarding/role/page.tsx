// /app/onboarding/role/page.tsx
import { SessionLoadingGate } from "@/components/onboarding/session-loading-gate";
import { Suspense } from "react";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 dark:bg-background">
      <Suspense fallback={<p className="p-6 text-text-muted">Loading…</p>}>
      <SessionLoadingGate />
      </Suspense>
    </main>
  );
}