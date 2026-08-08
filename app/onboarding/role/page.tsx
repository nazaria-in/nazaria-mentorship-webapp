// /app/onboarding/role/page.tsx
import { SessionLoadingGate } from "@/components/onboarding/session-loading-gate";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 dark:bg-background">
      <SessionLoadingGate />
    </main>
  );
}