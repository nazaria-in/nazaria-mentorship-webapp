// app/onboarding/role/page.tsx
import { RoleChoice } from "@/components/onboarding/role-choice";

export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <RoleChoice />
    </main>
  );
}